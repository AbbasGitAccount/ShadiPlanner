import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../dist/data/postgres.js';
import { createUserWithProfile } from '../dist/data/authDatabase.js';
import { changeAccountPassword, startPhoneTest, confirmPhoneTest, getAccountSecurity } from '../dist/data/accountSecurityDatabase.js';
import { authenticateToken, optionalAuth, JWT_SECRET } from '../dist/middleware/auth.js';
import { validatePasswordChange, normalizePhone, phoneTestEnabled } from '../dist/models/accountSecurity.js';
import { buildRegistrationProfile } from '../dist/models/registration.js';
import { bumpProfileRevision } from '../dist/data/profileDatabase.js';

const originalMode = process.env.PHONE_VERIFICATION_MODE;
const originalNodeEnv = process.env.NODE_ENV;
process.env.PHONE_VERIFICATION_MODE = 'test';
process.env.NODE_ENV = 'test';
after(async () => {
  if (originalMode === undefined) delete process.env.PHONE_VERIFICATION_MODE; else process.env.PHONE_VERIFICATION_MODE = originalMode;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
  await pool.end();
});

const oldPassword = 'Original-test-password-123';
async function withAccount(role, run, withProfile = false) {
  const id = randomUUID();
  const email = `account-security-test-${id}@example.invalid`;
  const profileId = randomUUID();
  const user = { id, email, role, passwordHash: await bcrypt.hash(oldPassword, 10), createdAt: new Date().toISOString() };
  if (withProfile) {
    const details = buildRegistrationProfile({
      fullName: 'Security test', gender: 'Other', dateOfBirth: '2000-01-01', height: '165', maritalStatus: 'Never Married',
      religion: 'None', motherTongue: 'English', manglik: 'Prefer not to say', highestEducation: 'Diploma', profession: 'Student',
      annualIncome: '0', city: 'Test city', state: 'Test state', country: 'Test country', citizenship: 'Test citizenship',
      familyType: 'Joint', familyStatus: 'Prefer not to say', brothersCount: '0', sistersCount: '0',
      diet: 'Vegan', smoking: 'No', drinking: 'No', aboutMe: 'Test only.', phone: '+16505550100',
      minAge: '18', maxAge: '50', minHeight: '100', maxHeight: '250', minIncome: '0',
    });
    await createUserWithProfile(user, { ...details, id: profileId, userId: id, email, isVerified: true, createdAt: user.createdAt, updatedAt: user.createdAt });
  } else {
    await pool.query('INSERT INTO auth_users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)', [id, email, user.passwordHash, role, user.createdAt]);
  }
  try { await run({ ...user, profileId }); }
  finally {
    await pool.query('DELETE FROM matrimonial_profiles WHERE id = $1 AND user_id = $2', [profileId, id]);
    await bumpProfileRevision(pool);
    await pool.query('DELETE FROM auth_users WHERE id = $1 AND email = $2', [id, email]);
  }
}

function tokenRequest(user, version = 0) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, authVersion: version }, JWT_SECRET);
  return { headers: { authorization: `Bearer ${token}` } };
}
function response() { return { code: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }

test('validates password confirmation, length, reuse, and country codes', () => {
  for (const values of [['', 'new-password', 'new-password'], ['old', 'short', 'short'], ['old', 'new-password', 'different'], ['same-password', 'same-password', 'same-password'], ['old', '\u00e9'.repeat(37), '\u00e9'.repeat(37)]]) {
    assert.throws(() => validatePasswordChange(...values));
  }
  assert.equal(normalizePhone('+1 (650) 555-0100'), '+16505550100');
  assert.throws(() => normalizePhone('9876543210'));
});

for (const role of ['admin', 'user']) test(`changes ${role} password and invalidates previous sessions`, () => withAccount(role, async user => {
  const request = tokenRequest(user);
  let authenticated = false;
  await authenticateToken(request, response(), () => { authenticated = true; });
  assert.equal(authenticated, true);
  await assert.rejects(changeAccountPassword(user.id, 'wrong-password', 'New-password-456', 'New-password-456'), error => error.field === 'currentPassword');
  await changeAccountPassword(user.id, oldPassword, 'New-password-456', 'New-password-456');
  const { rows: [stored] } = await pool.query('SELECT password_hash, auth_version FROM auth_users WHERE id = $1', [user.id]);
  assert.equal(await bcrypt.compare('New-password-456', stored.password_hash), true);
  assert.equal(await bcrypt.compare(oldPassword, stored.password_hash), false);
  assert.equal(stored.auth_version, 1);
  const oldResponse = response();
  await authenticateToken(tokenRequest(user), oldResponse, () => assert.fail('old session was accepted'));
  assert.equal(oldResponse.code, 401);
  const optional = tokenRequest(user);
  await optionalAuth(optional, response(), () => {});
  assert.equal(optional.user, undefined);
  let accepted = false;
  await authenticateToken(tokenRequest(user, 1), response(), () => { accepted = true; });
  assert.equal(accepted, true);
}));

test('limits repeated current-password guesses', () => withAccount('user', async user => {
  for (let index = 0; index < 5; index++) await assert.rejects(changeAccountPassword(user.id, 'wrong', 'New-password-456', 'New-password-456'), error => error.field === 'currentPassword');
  await assert.rejects(changeAccountPassword(user.id, oldPassword, 'New-password-456', 'New-password-456'), error => error.status === 429);
}));

test('test OTP updates account and biodata together, stays unverified, and cannot be reused', () => withAccount('user', async user => {
  const challenge = await startPhoneTest(user.id, '+1 (650) 555-0101', oldPassword);
  assert.equal(challenge.testOnly, true);
  assert.match(challenge.testCode, /^\d{6}$/);
  assert.equal((await getAccountSecurity(user.id)).phone, '+16505550100', 'number stays unchanged before confirmation');
  const { rows: [stored] } = await pool.query('SELECT code_hash FROM phone_test_challenges WHERE user_id = $1', [user.id]);
  assert.notEqual(stored.code_hash, challenge.testCode);
  await assert.rejects(startPhoneTest(user.id, '+16505550102', oldPassword), error => error.status === 429);
  await confirmPhoneTest(user.id, challenge.challengeId, challenge.testCode);
  const account = await getAccountSecurity(user.id);
  assert.equal(account.phone, '+16505550101');
  assert.equal(account.phoneVerified, false);
  const { rows: [profile] } = await pool.query('SELECT phone, phone_verified, is_verified FROM matrimonial_profiles WHERE user_id = $1', [user.id]);
  assert.equal(profile.phone, account.phone);
  assert.equal(profile.phone_verified, false);
  assert.equal(profile.is_verified, false);
  await assert.rejects(confirmPhoneTest(user.id, challenge.challengeId, challenge.testCode));
}, true));

test('supports an administrator without matrimonial biodata', () => withAccount('admin', async user => {
  const challenge = await startPhoneTest(user.id, '+16505550103', oldPassword);
  await confirmPhoneTest(user.id, challenge.challengeId, challenge.testCode);
  assert.equal((await getAccountSecurity(user.id)).phone, '+16505550103');
}));

test('rejects expired codes and locks after five incorrect attempts', () => withAccount('user', async user => {
  const challenge = await startPhoneTest(user.id, '+16505550104', oldPassword);
  const wrongCode = challenge.testCode === '000000' ? '111111' : '000000';
  for (let index = 0; index < 5; index++) await assert.rejects(confirmPhoneTest(user.id, challenge.challengeId, wrongCode));
  await assert.rejects(confirmPhoneTest(user.id, challenge.challengeId, challenge.testCode), error => error.status === 429);
  await pool.query("UPDATE phone_test_challenges SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [user.id]);
  await assert.rejects(confirmPhoneTest(user.id, challenge.challengeId, challenge.testCode), /expired/);
  assert.equal((await getAccountSecurity(user.id)).phone, '');
}));

test('binds codes to the account and cancels pending codes when its password changes', () => withAccount('user', async first => {
  const challenge = await startPhoneTest(first.id, '+16505550105', oldPassword);
  await withAccount('user', async second => {
    await assert.rejects(confirmPhoneTest(second.id, challenge.challengeId, challenge.testCode));
  });
  await changeAccountPassword(first.id, oldPassword, 'New-password-456', 'New-password-456');
  await assert.rejects(confirmPhoneTest(first.id, challenge.challengeId, challenge.testCode));
}));

test('phone test mode is always disabled in production', () => withAccount('user', async user => {
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(phoneTestEnabled(), false);
    await assert.rejects(startPhoneTest(user.id, '+16505550106', oldPassword), error => error.status === 503);
    await assert.rejects(confirmPhoneTest(user.id, randomUUID(), '123456'), error => error.status === 503);
  } finally { process.env.NODE_ENV = 'test'; }
}));
