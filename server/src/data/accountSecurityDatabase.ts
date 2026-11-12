import bcrypt from 'bcryptjs';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { pool } from './postgres.js';
import { AccountSecurityError, normalizePhone, phoneTestEnabled, validatePasswordChange } from '../models/accountSecurity.js';

export async function takeSecurityAttempt(userId: string, action: string): Promise<void> {
  const result = await pool.query(`INSERT INTO account_security_attempts (user_id, action) VALUES ($1, $2)
    ON CONFLICT (user_id, action) DO UPDATE SET
      attempts = CASE WHEN account_security_attempts.window_started < NOW() - INTERVAL '15 minutes' THEN 1 ELSE account_security_attempts.attempts + 1 END,
      window_started = CASE WHEN account_security_attempts.window_started < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE account_security_attempts.window_started END
    RETURNING attempts`, [userId, action]);
  if (result.rows[0].attempts > 5) throw new AccountSecurityError('Too many attempts. Please wait 15 minutes and try again.', 429);
}

export async function changeAccountEmail(userId: string, value: unknown, confirmation: unknown, currentPassword: unknown): Promise<void> {
  if (typeof value !== 'string' || value.length > 500 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new AccountSecurityError('Enter a complete email address.', 400, 'newEmail');
  const email = value.trim().toLowerCase();
  if (typeof confirmation !== 'string' || confirmation.trim().toLowerCase() !== email) throw new AccountSecurityError('The two email addresses must match.', 400, 'confirmEmail');
  if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword,'utf8') > 72) throw new AccountSecurityError('Enter your current password to change your email.', 400, 'emailPassword');
  await takeSecurityAttempt(userId, 'email');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT email,password_hash FROM auth_users WHERE id=$1 FOR UPDATE', [userId]);
    const user = result.rows[0];
    if (!user) throw new AccountSecurityError('Please sign in again.', 401);
    if (!await bcrypt.compare(currentPassword, user.password_hash)) throw new AccountSecurityError('Your current password is incorrect.', 400, 'emailPassword');
    if (email === user.email.toLowerCase()) throw new AccountSecurityError('This is already your current email address.', 400, 'newEmail');
    await client.query('UPDATE auth_users SET email=$1,auth_version=auth_version+1 WHERE id=$2', [email,userId]);
    await client.query('UPDATE matrimonial_profiles SET email=$1,is_verified=FALSE,verification_reviewed_by=NULL,verification_reviewed_at=NULL,updated_at=$3 WHERE user_id=$2', [email,userId,new Date().toISOString()]);
    await client.query('DELETE FROM phone_test_challenges WHERE user_id=$1',[userId]);
    await client.query("DELETE FROM account_security_attempts WHERE user_id=$1 AND action='email'",[userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as {code?:string}).code==='23505') throw new AccountSecurityError('This email is already registered. Use a different address.',409,'newEmail');
    throw error;
  } finally { client.release(); }
}

export async function changeAccountPassword(userId: string, currentPassword: unknown, newPassword: unknown, confirmation: unknown): Promise<void> {
  validatePasswordChange(currentPassword, newPassword, confirmation);
  await takeSecurityAttempt(userId, 'password');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT password_hash FROM auth_users WHERE id = $1 FOR UPDATE', [userId]);
    if (!result.rowCount) throw new AccountSecurityError('Please sign in again.', 401);
    if (!await bcrypt.compare(currentPassword as string, result.rows[0].password_hash)) throw new AccountSecurityError('Your current password is incorrect. Please try again.', 400, 'currentPassword');
    const hash = await bcrypt.hash(newPassword, 12);
    await client.query('UPDATE auth_users SET password_hash = $1, auth_version = auth_version + 1 WHERE id = $2', [hash, userId]);
    await client.query('DELETE FROM phone_test_challenges WHERE user_id = $1', [userId]);
    await client.query("DELETE FROM account_security_attempts WHERE user_id = $1 AND action = 'password'", [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function requirePhoneTest(): void {
  if (!phoneTestEnabled()) throw new AccountSecurityError('Phone verification testing is unavailable. Your number has not been changed.', 503);
}
function codeHash(userId: string, challengeId: string, phone: string, code: string): string {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return createHmac('sha256', process.env.JWT_SECRET).update(JSON.stringify([userId, challengeId, phone, code])).digest('hex');
}

export async function startPhoneTest(userId: string, value: unknown, currentPassword: unknown) {
  requirePhoneTest();
  const phone = normalizePhone(value);
  if (typeof currentPassword !== 'string' || !currentPassword) throw new AccountSecurityError('Enter your current password to change your number.', 400, 'phonePassword');
  await takeSecurityAttempt(userId, 'phone');
  const user = await pool.query('SELECT password_hash FROM auth_users WHERE id = $1', [userId]);
  if (!user.rowCount || !await bcrypt.compare(currentPassword, user.rows[0].password_hash)) throw new AccountSecurityError('Your current password is incorrect.', 400, 'phonePassword');
  const code = randomInt(0, 1000000).toString().padStart(6, '0');
  const challengeId = randomUUID();
  const result = await pool.query(`INSERT INTO phone_test_challenges (user_id, challenge_id, phone, code_hash, expires_at, next_send_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes', NOW() + INTERVAL '60 seconds')
    ON CONFLICT (user_id) DO UPDATE SET challenge_id = EXCLUDED.challenge_id, phone = EXCLUDED.phone,
      code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, next_send_at = EXCLUDED.next_send_at, attempts = 0
    WHERE phone_test_challenges.next_send_at <= NOW()
    RETURNING expires_at, next_send_at`, [userId, challengeId, phone, codeHash(userId, challengeId, phone, code)]);
  if (!result.rowCount) throw new AccountSecurityError('Please wait 60 seconds before requesting another test code.', 429);
  return { challengeId, phone, testCode: code, testOnly: true, expiresAt: result.rows[0].expires_at, resendAt: result.rows[0].next_send_at };
}

export async function confirmPhoneTest(userId: string, challengeId: unknown, code: unknown): Promise<string> {
  requirePhoneTest();
  if (typeof challengeId !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new AccountSecurityError('Enter the 6-digit test code shown on this screen.', 400, 'code');
  const client = await pool.connect();
  let completed = false;
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT *, expires_at <= NOW() AS expired FROM phone_test_challenges WHERE user_id = $1 FOR UPDATE', [userId]);
    const challenge = result.rows[0];
    if (!challenge || challenge.challenge_id !== challengeId) throw new AccountSecurityError('This test code is no longer active. Request a new code.', 400, 'code');
    if (challenge.expired) throw new AccountSecurityError('Your test code has expired. Request a new code.', 400, 'code');
    if (challenge.attempts >= 5) throw new AccountSecurityError('Too many incorrect codes. Request a new code after the resend timer ends.', 429, 'code');
    const expected = Buffer.from(challenge.code_hash, 'hex');
    const actual = Buffer.from(codeHash(userId, challengeId, challenge.phone, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await client.query('UPDATE phone_test_challenges SET attempts = attempts + 1 WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      completed = true;
      throw new AccountSecurityError('That test code is incorrect. Check the code shown on this screen.', 400, 'code');
    }
    // A sandbox code demonstrates the update flow; it never proves phone ownership.
    await client.query('UPDATE auth_users SET phone = $1, phone_verified = FALSE WHERE id = $2', [challenge.phone, userId]);
    await client.query('UPDATE matrimonial_profiles SET phone = $1, phone_verified = FALSE, is_verified = FALSE, updated_at = $2 WHERE user_id = $3', [challenge.phone, new Date().toISOString(), userId]);
    await client.query('DELETE FROM phone_test_challenges WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    completed = true;
    return challenge.phone;
  } catch (error) {
    if (!completed) await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function getAccountSecurity(userId: string) {
  const result = await pool.query(`SELECT u.email, COALESCE(u.phone, p.phone, '') AS phone,
    CASE WHEN u.phone IS NOT NULL THEN u.phone_verified ELSE COALESCE(p.phone_verified, FALSE) END AS "phoneVerified"
    FROM auth_users u LEFT JOIN matrimonial_profiles p ON p.user_id = u.id WHERE u.id = $1`, [userId]);
  if (!result.rowCount) throw new AccountSecurityError('Please sign in again.', 401);
  return { ...result.rows[0], phoneTestEnabled: phoneTestEnabled(), testOnly: true };
}
