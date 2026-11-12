import { pool } from './postgres.js';
import { PoolClient } from 'pg';

export async function initializeAdminDatabase() {
  await pool.query(`
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
    ALTER TABLE matrimonial_profiles ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS plan_snapshot JSONB;
    ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS plan_snapshot JSONB;
    ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS admin_audit (
      id BIGSERIAL PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL,
      target_id TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS admin_audit_target ON admin_audit(target_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1, window_started TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS account_activity (id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),action TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS account_activity_user ON account_activity(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS profile_reports (
      id BIGSERIAL PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES auth_users(id),
      profile_id TEXT NOT NULL REFERENCES matrimonial_profiles(id), reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS assisted_matches (
      id BIGSERIAL PRIMARY KEY, first_id TEXT NOT NULL REFERENCES matrimonial_profiles(id),
      second_id TEXT NOT NULL REFERENCES matrimonial_profiles(id), first_consent BOOLEAN, second_consent BOOLEAN,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(first_id < second_id), UNIQUE(first_id,second_id));
    UPDATE user_subscriptions s SET plan_snapshot=p.configuration FROM subscription_plans p WHERE p.id=s.plan_id AND s.plan_snapshot IS NULL;
    UPDATE subscription_orders o SET plan_snapshot=p.configuration FROM subscription_plans p WHERE p.id=o.plan_id AND o.plan_snapshot IS NULL;

    CREATE TABLE IF NOT EXISTS subscription_history (
      id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL,plan_id TEXT NOT NULL,status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL,cancelled_at TIMESTAMPTZ,
      plan_snapshot JSONB,recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS subscription_history_user ON subscription_history(user_id,recorded_at DESC);
    CREATE OR REPLACE FUNCTION shadiplanner_subscription_history() RETURNS trigger AS $$
      BEGIN
        IF ROW(OLD.plan_id,OLD.started_at,OLD.expires_at,OLD.cancelled_at) IS DISTINCT FROM ROW(NEW.plan_id,NEW.started_at,NEW.expires_at,NEW.cancelled_at) THEN
          INSERT INTO subscription_history(user_id,plan_id,status,started_at,expires_at,cancelled_at,plan_snapshot)
          VALUES(OLD.user_id,OLD.plan_id,OLD.status,OLD.started_at,OLD.expires_at,OLD.cancelled_at,OLD.plan_snapshot);
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql;
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='subscription_history' AND tgrelid='user_subscriptions'::regclass) THEN
        CREATE TRIGGER subscription_history BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION shadiplanner_subscription_history();
      END IF;
    END $$;

  `);
}
export async function audit(c: Pick<PoolClient, 'query'>, actor: string, action: string, target: string, details: unknown = {}) {
  await c.query('INSERT INTO admin_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)', [actor, action, target, details]);
}
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const value = await fn(c); await c.query('COMMIT'); return value; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
