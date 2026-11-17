import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { pool } from './postgres.js';
import { InterestRequest } from '../models/types.js';
import { SubscriptionError, SubscriptionPlan } from '../models/subscriptions.js';

function setting(name: string, fallback: number | null): number | null {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) throw new Error(`${name} must be a positive database integer`);
  return value;
}
export async function initializeSubscriptions(legacy: InterestRequest[]): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_plans (id TEXT PRIMARY KEY CHECK(id IN ('free','gold','platinum')), configuration JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS user_subscriptions (user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES subscription_plans(id), status TEXT NOT NULL CHECK(status IN ('active','expired')),
      started_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at > started_at));
    CREATE TABLE IF NOT EXISTS subscription_orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES subscription_plans(id), amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), currency TEXT NOT NULL CHECK(currency='INR'),
      duration_days INTEGER NOT NULL CHECK(duration_days > 0), status TEXT NOT NULL CHECK(status IN ('pending','paid','failed')),
      provider_order_id TEXT UNIQUE, provider_payment_id TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_subscription_order ON subscription_orders(user_id) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS subscription_interests (id TEXT PRIMARY KEY, sender_user_id TEXT, sender_profile_id TEXT NOT NULL,
      receiver_profile_id TEXT NOT NULL, pair_key TEXT NOT NULL UNIQUE, sent_at TIMESTAMPTZ NOT NULL, payload JSONB NOT NULL);
    CREATE INDEX IF NOT EXISTS subscription_interest_usage ON subscription_interests(sender_profile_id, sent_at)`);
  await pool.query(`ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS plan_snapshot JSONB;
    ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS plan_snapshot JSONB;
    ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`);
  const duration = setting('SUBSCRIPTION_DURATION_DAYS', null);
  const base = { currency: 'INR' as const, enhancedVisibility: false, compatibleFirst: false, premiumBadge: false };
  const plans: SubscriptionPlan[] = [
    { ...base, id: 'free', name: 'Free', pricePaise: 0, durationDays: null, interestLimit: 5, browseLimit: setting('FREE_PROFILE_LIMIT', 20), advancedSearch: false, contactDetails: false, directMessaging: false, support: 'standard' },
    { ...base, id: 'gold', name: 'Gold', pricePaise: setting('GOLD_PRICE_PAISE', 99900)!, durationDays: duration, interestLimit: 50, browseLimit: null, advancedSearch: true, contactDetails: true, directMessaging: true, support: 'priority' },
    { ...base, id: 'platinum', name: 'Platinum', pricePaise: setting('PLATINUM_PRICE_PAISE', 199900)!, durationDays: duration, interestLimit: null, browseLimit: null, advancedSearch: true, contactDetails: true, directMessaging: true, support: 'dedicated', enhancedVisibility: true, compatibleFirst: true, premiumBadge: true },
  ];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(726320109)');
    for (const plan of plans) await client.query('INSERT INTO subscription_plans VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET configuration = jsonb_set(subscription_plans.configuration, \'{directMessaging}\', to_jsonb($3::boolean), true)', [plan.id, plan, plan.directMessaging]);
    // Preserve existing relationships once. PostgreSQL becomes authoritative for interests and quotas.
    const imported = await client.query("SELECT name FROM app_migrations WHERE name='subscription-interests-v1'");
    if (!imported.rowCount) {
      for (const item of legacy) await client.query(`INSERT INTO subscription_interests(id,sender_profile_id,receiver_profile_id,pair_key,sent_at,payload)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [item.id, item.senderProfileId, item.receiverProfileId, JSON.stringify([item.senderProfileId, item.receiverProfileId].sort()), item.sentAt, item]);
      await client.query("INSERT INTO app_migrations(name) VALUES('subscription-interests-v1')");
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
type Connection = Pick<PoolClient, 'query'>;
export async function subscriptionPlans(connection: Connection = pool): Promise<SubscriptionPlan[]> {
  return (await connection.query('SELECT configuration FROM subscription_plans ORDER BY CASE id WHEN \'free\' THEN 0 WHEN \'gold\' THEN 1 ELSE 2 END')).rows.map(row => row.configuration);
}
export async function membership(userId: string, connection: Connection = pool) {
  const result = await connection.query(`SELECT CASE WHEN s.status='active' AND s.expires_at>NOW() AND s.cancelled_at IS NULL THEN COALESCE(s.plan_snapshot,p.configuration) ELSE p.configuration END AS plan, s.plan_id, s.cancelled_at, s.started_at, s.expires_at,
    (SELECT COUNT(*)::int FROM subscription_interests i WHERE i.sender_profile_id IN (SELECT id FROM matrimonial_profiles WHERE user_id=$1)
      AND i.sent_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS used,
    (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC' AS reset
    FROM subscription_plans p LEFT JOIN user_subscriptions s ON s.user_id=$1
    WHERE p.id=COALESCE((SELECT plan_id FROM user_subscriptions WHERE user_id=$1 AND status='active' AND cancelled_at IS NULL AND expires_at>NOW()),'free')`, [userId]);
  const row = result.rows[0];
  if (!row) throw new Error('Subscription catalogue unavailable');
  const expiresAt = row?.expires_at?.toISOString() || null;
  const plan = row.plan as SubscriptionPlan;
  return { plan, status: plan.id === 'free' ? (row.cancelled_at ? 'cancelled' : row.plan_id ? 'expired' : 'free') : 'active', startedAt: row.started_at?.toISOString() || null, expiresAt,
    interestsUsed: row.used as number, interestsResetAt: row.reset.toISOString() as string };
}
export async function activeFeatureUsers(feature: 'premiumBadge' | 'enhancedVisibility'): Promise<Set<string>> {
  const result = await pool.query(`SELECT s.user_id FROM user_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE status='active' AND cancelled_at IS NULL AND expires_at>NOW() AND COALESCE(s.plan_snapshot,p.configuration)->>$1='true'`,[feature]);
  return new Set(result.rows.map(row => row.user_id));
}
export async function storedInterests(): Promise<InterestRequest[]> {
  return (await pool.query('SELECT payload FROM subscription_interests ORDER BY sent_at')).rows.map(row => row.payload);
}
export async function sendLimitedInterest(userId: string, interest: InterestRequest): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize every send/upgrade for this account, across processes and requests.
    await client.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId]);
    const current = await membership(userId, client);
    if (current.plan.interestLimit !== null && current.interestsUsed >= current.plan.interestLimit) throw new SubscriptionError('You have reached your monthly interest allowance. Explore plans for more interests.', 403);
    await client.query(`INSERT INTO subscription_interests(id,sender_user_id,sender_profile_id,receiver_profile_id,pair_key,sent_at,payload)
      VALUES($1,$2,$3,$4,$5,NOW(),$6)`, [interest.id, userId, interest.senderProfileId, interest.receiverProfileId, JSON.stringify([interest.senderProfileId, interest.receiverProfileId].sort()), interest]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); if ((error as {code?: string}).code === '23505') throw new SubscriptionError('An interest already exists between these profiles.', 409); throw error; }
  finally { client.release(); }
}
export async function respondStoredInterest(id: string, receiver: string, action: 'accepted' | 'declined'): Promise<InterestRequest> {
  const result = await pool.query(`UPDATE subscription_interests SET payload=payload || jsonb_build_object('status',$3::text,'respondedAt',$4::text)
    WHERE id=$1 AND receiver_profile_id=$2 AND payload->>'status'='pending' RETURNING payload`, [id, receiver, action, new Date().toISOString()]);
  if (!result.rowCount) throw new SubscriptionError('This request was already answered or is unavailable.', 409);
  return result.rows[0].payload;
}
export const newOrderId = () => randomUUID();
export type Membership = Awaited<ReturnType<typeof membership>>;
