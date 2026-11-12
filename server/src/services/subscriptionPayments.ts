import { pool } from '../data/postgres.js';
import { membership, newOrderId, subscriptionPlans } from '../data/subscriptionDatabase.js';
import { PlanId, planRank, SubscriptionError } from '../models/subscriptions.js';

// A future provider adapter must create idempotent orders and fetch captured payment
// details from the provider's authenticated server API. Never trust client success flags.
export interface PaymentProvider {
  createOrder(input: { id: string; amountPaise: number; currency: 'INR' }): Promise<{ id: string; checkoutUrl: string }>;
  verifyPayment(paymentId: string): Promise<{ captured: boolean; orderId: string; amountPaise: number; currency: string }>;
}
const provider: PaymentProvider | null = null;
const paymentProvider = (): PaymentProvider => {
  if (!provider) throw new SubscriptionError('Online payments are not available yet. Your current plan has not changed.', 503);
  return provider;
};
export async function checkoutAvailability() {
  const plans = await subscriptionPlans();
  const durationReady = plans.filter(plan => plan.id !== 'free').every(plan => !!plan.durationDays);
  return { available: !!provider && durationReady,
    message: !provider ? 'Paid subscriptions are not available for purchase yet. No payment will be taken.' : !durationReady ? 'Billing duration must be configured before checkout.' : 'Checkout is available. Access activates after verified payment.' };
}
// Adapter arguments are server-only integration/test seams. Routes never read them
// from request data; their default is the configured authenticated provider.
export async function createCheckout(userId: string, planId: PlanId, adapter: PaymentProvider = paymentProvider()) {
  const client = await pool.connect();
  let orderId: string | undefined;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId]);
    const current = await membership(userId, client);
    const plan = (await subscriptionPlans(client)).find(item => item.id === planId);
    if (!plan || plan.enabled === false || plan.id === 'free' || planRank[plan.id] <= planRank[current.plan.id]) throw new SubscriptionError('Choose a higher plan to upgrade.', 409);
    if (!plan.durationDays) throw new SubscriptionError('The billing duration has not been configured. No payment was taken.', 503);
    if ((await client.query("SELECT id FROM subscription_orders WHERE user_id=$1 AND status='pending'", [userId])).rowCount) throw new SubscriptionError('A checkout is already pending for your account. Contact support before trying again.', 409);
    orderId = newOrderId();
    await client.query(`INSERT INTO subscription_orders(id,user_id,plan_id,amount_paise,currency,duration_days,status,plan_snapshot) VALUES($1,$2,$3,$4,'INR',$5,'pending',$6)`, [orderId, userId, plan.id, plan.pricePaise, plan.durationDays, plan]);
    await client.query('COMMIT');
    // Provider retries must use this order id as their idempotency key.
    const result = await adapter.createOrder({ id: orderId, amountPaise: plan.pricePaise, currency: 'INR' });
    const url = new URL(result.checkoutUrl);
    if (url.protocol !== 'https:') throw new Error('Provider checkout requires HTTPS');
    await pool.query('UPDATE subscription_orders SET provider_order_id=$2 WHERE id=$1', [orderId, result.id]);
    return { orderId, checkoutUrl: result.checkoutUrl };
  } catch (error) {
    await client.query('ROLLBACK');
    // Keep an uncertain provider order pending, preventing another charge until reconciled.
    throw error;
  } finally { client.release(); }
}
export async function verifyCheckout(userId: string, orderId: string, paymentId: string, adapter: PaymentProvider = paymentProvider()) {
  const owned = await pool.query('SELECT id FROM subscription_orders WHERE id=$1 AND user_id=$2', [orderId, userId]);
  if (!owned.rowCount) throw new SubscriptionError('Checkout not found.', 404);
  const payment = await adapter.verifyPayment(paymentId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId]);
    const order = (await client.query('SELECT * FROM subscription_orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [orderId, userId])).rows[0];
    if (!payment.captured || payment.orderId !== order.provider_order_id || payment.amountPaise !== order.amount_paise || payment.currency !== order.currency) throw new SubscriptionError('Payment could not be verified. Your plan has not changed.', 400);
    if (order.status === 'paid') {
      if (order.provider_payment_id !== paymentId) throw new SubscriptionError('This checkout already has a different payment.', 409);
      await client.query('COMMIT'); return membership(userId);
    }
    if (order.status !== 'pending') throw new SubscriptionError('Checkout is no longer pending.', 409);
    const current = await membership(userId, client);
    if (planRank[order.plan_id as PlanId] < planRank[current.plan.id]) throw new SubscriptionError('Your subscription has already changed. Contact support to reconcile this payment.', 409);
    await client.query(`INSERT INTO user_subscriptions(user_id,plan_id,status,started_at,expires_at,plan_snapshot) VALUES($1,$2,'active',NOW(),GREATEST(NOW(),COALESCE((SELECT expires_at FROM user_subscriptions WHERE user_id=$1 AND plan_id=$2 AND status='active' AND cancelled_at IS NULL),NOW()))+$3*INTERVAL '1 day',$4)
      ON CONFLICT(user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',started_at=EXCLUDED.started_at,expires_at=EXCLUDED.expires_at,plan_snapshot=EXCLUDED.plan_snapshot,cancelled_at=NULL`, [userId, order.plan_id, order.duration_days, order.plan_snapshot]);
    await client.query("UPDATE subscription_orders SET status='paid',provider_payment_id=$2,paid_at=NOW() WHERE id=$1", [orderId, paymentId]);
    await client.query('COMMIT');
    return membership(userId);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
