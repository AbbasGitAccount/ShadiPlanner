import { initializeAdminDatabase } from './adminDatabase.js';
import { User, MatrimonialProfile } from '../models/types.js';
import { db } from './db.js';
import { pool } from './postgres.js';
import { initializeProfileDatabase, saveProfile } from './profileDatabase.js';
import { initializeAdminMessagingDatabase } from './adminMessagingDatabase.js';
import { initializeSubscriptions } from './subscriptionDatabase.js';

export const initializeAuthDatabase = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_lower_unique
    ON auth_users (LOWER(email))
  `);
  await pool.query('ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone TEXT');
  await pool.query('ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE');
  await pool.query(`CREATE TABLE IF NOT EXISTS phone_test_challenges (
    user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
    challenge_id TEXT NOT NULL, phone TEXT NOT NULL, code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL, next_send_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS account_security_attempts (
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, window_started TIMESTAMPTZ NOT NULL DEFAULT NOW(), attempts INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, action)
  )`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(726320101)');
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const migration = await client.query("SELECT name FROM app_migrations WHERE name = 'legacy-auth-import-v1'");
    if (!migration.rowCount) {
      for (const user of db.users) await client.query(
        `INSERT INTO auth_users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [user.id, user.email.trim().toLowerCase(), user.passwordHash, user.role, user.createdAt]
      );
      await client.query("INSERT INTO app_migrations (name) VALUES ('legacy-auth-import-v1')");
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  const profiles = await initializeProfileDatabase(db.profiles);
  db.profiles.splice(0, db.profiles.length, ...profiles);
  await initializeAdminMessagingDatabase();
  await initializeSubscriptions(db.interests);
  await initializeAdminDatabase();
};

const mapUser = (row: {
  id: string;
  email: string;
  passwordHash: string;
  role: User['role'];
  createdAt: string;
  authVersion: number;
  suspended: boolean;
}): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  role: row.role,
  createdAt: row.createdAt,
  authVersion: row.authVersion,
  suspended: row.suspended,
});

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const result = await pool.query(
    `SELECT id, email, password_hash AS "passwordHash", role, created_at AS "createdAt", auth_version AS "authVersion", suspended
     FROM auth_users
     WHERE LOWER(email) = $1`,
    [email.trim().toLowerCase()]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
};

export const findUserById = async (id: string): Promise<User | undefined> => {
  const result = await pool.query(
    `SELECT id, email, password_hash AS "passwordHash", role, created_at AS "createdAt", auth_version AS "authVersion", suspended
     FROM auth_users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
};

export const createUser = async (user: User): Promise<void> => {
  await pool.query(
    `INSERT INTO auth_users (id, email, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, user.email, user.passwordHash, user.role, user.createdAt]
  );
};

export const createUserWithProfile = async (user: User, profile: MatrimonialProfile): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO auth_users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, user.email, user.passwordHash, user.role, user.createdAt]
    );
    await saveProfile(profile, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
