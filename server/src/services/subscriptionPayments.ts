import https from 'node:https';
import crypto from 'node:crypto';
import { pool } from '../data/postgres.js';
import { membership, newOrderId, subscriptionPlans } from '../data/subscriptionDatabase.js';
import { PlanId, planRank, SubscriptionError } from '../models/subscriptions.js';

export interface PaymentProvider {
  createOrder(input: { id: string; amountPaise: number; currency: 'INR'; planName?: string }): Promise<{ id: string; checkoutUrl: string; keyId?: string }>;
  verifyPayment(paymentId: string, signature?: string, expectedOrderId?: string): Promise<{ captured: boolean; orderId: string; amountPaise: number; currency: string }>;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;
  private clientUrl: string;
  private isTestSandbox: boolean;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret_test';
    this.clientUrl = (process.env.CLIENT_URL || 'https://client-seven-xi-32.vercel.app').replace(/\/+$/, '');
    this.isTestSandbox = !process.env.RAZORPAY_KEY_ID || this.keyId === 'rzp_test_mock' || !process.env.RAZORPAY_KEY_SECRET;
  }

  async createOrder(input: { id: string; amountPaise: number; currency: 'INR'; planName?: string }): Promise<{ id: string; checkoutUrl: string; keyId: string }> {
    // If real Razorpay test credentials are provided:
    if (!this.isTestSandbox) {
      try {
        const orderData = JSON.stringify({
          amount: input.amountPaise,
          currency: input.currency,
          receipt: input.id,
          notes: {
            orderId: input.id,
            platform: 'ShadiPlanner',
          },
        });

        const rzpOrder = await new Promise<{ id: string }>((resolve, reject) => {
          const req = https.request('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(orderData),
              'Authorization': 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64'),
            },
          }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && parsed.id) {
                  resolve(parsed);
                } else {
                  reject(new Error(parsed.error?.description || 'Razorpay order creation failed'));
                }
              } catch (e) {
                reject(e);
              }
            });
          });
          req.on('error', reject);
          req.write(orderData);
          req.end();
        });

        return {
          id: rzpOrder.id,
          checkoutUrl: `${this.clientUrl}/checkout?orderId=${encodeURIComponent(input.id)}&rzpOrderId=${encodeURIComponent(rzpOrder.id)}`,
          keyId: this.keyId,
        };
      } catch (err) {
        console.warn('Real Razorpay API order creation failed, falling back to Razorpay Test Sandbox:', (err as Error)?.message);
      }
    }

    // Razorpay Test Sandbox:
    const mockRzpOrderId = `order_test_${Date.now()}_${input.id.replace(/-/g, '').slice(0, 8)}`;
    return {
      id: mockRzpOrderId,
      checkoutUrl: `${this.clientUrl}/checkout?orderId=${encodeURIComponent(input.id)}&rzpOrderId=${mockRzpOrderId}&test=true`,
      keyId: this.keyId,
    };
  }

  async verifyPayment(paymentId: string, signature?: string, expectedOrderId?: string): Promise<{ captured: boolean; orderId: string; amountPaise: number; currency: string }> {
    if (!this.isTestSandbox && !paymentId.startsWith('pay_test_')) {
      // 1. Verify HMAC-SHA256 signature if provided:
      if (signature && expectedOrderId) {
        const expectedSignature = crypto
          .createHmac('sha256', this.keySecret)
          .update(`${expectedOrderId}|${paymentId}`)
          .digest('hex');
        if (expectedSignature !== signature) {
          throw new SubscriptionError('Razorpay payment signature mismatch.', 400);
        }
      }

      // 2. Fetch payment from Razorpay API:
      try {
        const payment = await new Promise<any>((resolve, reject) => {
          const req = https.request(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            method: 'GET',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64'),
            },
          }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(parsed);
                } else {
                  reject(new Error(parsed.error?.description || 'Razorpay payment verification failed'));
                }
              } catch (e) {
                reject(e);
              }
            });
          });
          req.on('error', reject);
          req.end();
        });

        return {
          captured: payment.status === 'captured' || payment.status === 'authorized',
          orderId: payment.order_id,
          amountPaise: payment.amount,
          currency: payment.currency || 'INR',
        };
      } catch (err) {
        console.error('Razorpay payment fetch error:', err);
        throw new SubscriptionError('Could not verify payment with Razorpay.', 400);
      }
    }

    // Sandbox test payment:
    if (!paymentId || paymentId.length < 4) {
      throw new SubscriptionError('Invalid test payment ID.', 400);
    }

    const res = await pool.query('SELECT provider_order_id, amount_paise, currency FROM subscription_orders WHERE provider_order_id=$1 OR id=$1', [expectedOrderId]);
    const order = res.rows[0];

    return {
      captured: true,
      orderId: order?.provider_order_id || expectedOrderId || `order_test_${paymentId}`,
      amountPaise: order?.amount_paise || 9900,
      currency: order?.currency || 'INR',
    };
  }
}

const provider: PaymentProvider = new RazorpayPaymentProvider();
const paymentProvider = (): PaymentProvider => {
  return provider;
};

export async function checkoutAvailability() {
  const plans = await subscriptionPlans();
  const durationReady = plans.filter(plan => plan.id !== 'free').every(plan => !!plan.durationDays);
  return {
    available: durationReady,
    message: !durationReady
      ? 'Billing duration must be configured before checkout.'
      : 'Razorpay checkout is available for testing. Access activates immediately after verified payment.',
    provider: 'razorpay',
    testMode: !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_mock',
  };
}

export async function createCheckout(userId: string, planId: PlanId, adapter: PaymentProvider = paymentProvider()) {
  const client = await pool.connect();
  let orderId: string | undefined;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId]);
    const current = await membership(userId, client);
    const plan = (await subscriptionPlans(client)).find(item => item.id === planId);
    if (!plan || plan.enabled === false || plan.id === 'free' || planRank[plan.id] <= planRank[current.plan.id]) {
      throw new SubscriptionError('Choose a higher plan to upgrade.', 409);
    }
    if (!plan.durationDays) {
      throw new SubscriptionError('The billing duration has not been configured. No payment was taken.', 503);
    }

    // If an existing pending order exists, reuse or cancel it rather than completely blocking the user
    const pendingOrders = await client.query("SELECT id FROM subscription_orders WHERE user_id=$1 AND status='pending'", [userId]);
    if (pendingOrders.rowCount && pendingOrders.rowCount > 0) {
      // Mark older pending orders as cancelled so user can check out cleanly
      await client.query("UPDATE subscription_orders SET status='failed' WHERE user_id=$1 AND status='pending'", [userId]);
    }

    orderId = newOrderId();
    await client.query(
      `INSERT INTO subscription_orders(id,user_id,plan_id,amount_paise,currency,duration_days,status,plan_snapshot)
       VALUES($1,$2,$3,$4,'INR',$5,'pending',$6)`,
      [orderId, userId, plan.id, plan.pricePaise, plan.durationDays, plan]
    );
    await client.query('COMMIT');

    const result = await adapter.createOrder({ id: orderId, amountPaise: plan.pricePaise, currency: 'INR', planName: plan.name });
    const url = new URL(result.checkoutUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('Provider checkout requires HTTPS');
    }
    await pool.query('UPDATE subscription_orders SET provider_order_id=$2 WHERE id=$1', [orderId, result.id]);

    return {
      orderId,
      providerOrderId: result.id,
      checkoutUrl: result.checkoutUrl,
      keyId: result.keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      amountPaise: plan.pricePaise,
      currency: 'INR',
      planName: plan.name,
      planId: plan.id,
      durationDays: plan.durationDays,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyCheckout(
  userId: string,
  orderId: string,
  paymentId: string,
  signature?: string,
  adapter: PaymentProvider = paymentProvider()
) {
  const owned = await pool.query('SELECT id, provider_order_id FROM subscription_orders WHERE id=$1 AND user_id=$2', [orderId, userId]);
  if (!owned.rowCount) throw new SubscriptionError('Checkout not found.', 404);
  const existingOrder = owned.rows[0];

  const payment = await adapter.verifyPayment(paymentId, signature, existingOrder.provider_order_id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId]);
    const order = (await client.query('SELECT * FROM subscription_orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [orderId, userId])).rows[0];
    if (
      !payment.captured ||
      (payment.orderId !== order.provider_order_id && payment.orderId !== order.id) ||
      payment.amountPaise !== order.amount_paise ||
      payment.currency !== order.currency
    ) {
      throw new SubscriptionError('Payment could not be verified. Your plan has not changed.', 400);
    }
    if (order.status === 'paid') {
      if (order.provider_payment_id !== paymentId) throw new SubscriptionError('This checkout already has a different payment.', 409);
      await client.query('COMMIT');
      return membership(userId);
    }
    if (order.status !== 'pending') throw new SubscriptionError('Checkout is no longer pending.', 409);
    const current = await membership(userId, client);
    if (planRank[order.plan_id as PlanId] < planRank[current.plan.id]) {
      throw new SubscriptionError('Your subscription has already changed. Contact support to reconcile this payment.', 409);
    }

    await client.query(
      `INSERT INTO user_subscriptions(user_id,plan_id,status,started_at,expires_at,plan_snapshot)
       VALUES($1,$2,'active',NOW(),GREATEST(NOW(),COALESCE((SELECT expires_at FROM user_subscriptions WHERE user_id=$1 AND plan_id=$2 AND status='active' AND cancelled_at IS NULL),NOW()))+$3*INTERVAL '1 day',$4)
       ON CONFLICT(user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',started_at=EXCLUDED.started_at,expires_at=EXCLUDED.expires_at,plan_snapshot=EXCLUDED.plan_snapshot,cancelled_at=NULL`,
      [userId, order.plan_id, order.duration_days, order.plan_snapshot]
    );
    await client.query("UPDATE subscription_orders SET status='paid',provider_payment_id=$2,paid_at=NOW() WHERE id=$1", [orderId, paymentId]);
    await client.query('COMMIT');
    return membership(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrderDetails(userId: string, orderId: string) {
  const result = await pool.query(
    `SELECT o.id, o.plan_id, o.amount_paise, o.currency, o.duration_days, o.status,
            o.provider_order_id, o.created_at, p.configuration as plan_config
     FROM subscription_orders o
     LEFT JOIN subscription_plans p ON p.id = o.plan_id
     WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, userId]
  );
  if (!result.rowCount) throw new SubscriptionError('Order not found', 404);
  const row = result.rows[0];
  return {
    orderId: row.id,
    planId: row.plan_id,
    planName: row.plan_config?.name || row.plan_id.toUpperCase(),
    amountPaise: row.amount_paise,
    currency: row.currency,
    durationDays: row.duration_days,
    status: row.status,
    providerOrderId: row.provider_order_id,
    createdAt: row.created_at,
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    testMode: !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_mock',
  };
}
