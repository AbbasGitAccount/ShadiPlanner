import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../dist/data/postgres.js';
import { saveProfile, profileFields, bumpProfileRevision, isProfileSnapshot, editProfile, reviewProfile } from '../dist/data/profileDatabase.js';
import { createUserWithProfile } from '../dist/data/authDatabase.js';
import { buildRegistrationProfile } from '../dist/models/registration.js';
import profileRoutes from '../dist/routes/profiles.js';
import { closeRedisCache } from '../dist/data/redisCache.js';
import { JWT_SECRET } from '../dist/middleware/auth.js';
import { db } from '../dist/data/db.js';

after(async () => { await closeRedisCache(); await pool.end(); });
const makeProfile = () => ({
  ...buildRegistrationProfile({
    fullName: 'Database roundtrip test', gender: 'Other', dateOfBirth: '2000-11-07', height: '165.5',
    maritalStatus: 'Divorced', motherTongue: 'Kannada', religion: 'No religious affiliation',
    community: '', languagesKnown: 'Kannada, English', highestEducation: 'Diploma', collegeUniversity: 'Test college',
    profession: 'Student', annualIncome: '0', city: 'Mysuru', state: 'Karnataka', country: 'India', citizenship: 'Indian',
    familyType: 'Joint', familyStatus: 'Prefer not to say', brothersCount: '0', sistersCount: '2',
    manglik: 'Prefer not to say', diet: 'Vegan', smoking: 'No', drinking: 'Occasionally',
    fatherOccupation: 'Retired', aboutFamily: 'Family information.', hobbies: 'Cycling, Painting',
    aboutMe: 'My own introduction.', phone: '+91 90000 00000',
    minAge: '22', maxAge: '35', minHeight: '140', maxHeight: '200', minIncome: '0',
    preferredLocations: 'Mysuru, Bengaluru', preferredReligions: 'Jain, Buddhist', preferredDiet: 'Vegan',
  }, new Date('2026-11-06T12:00:00Z')),
  id: randomUUID(), userId: randomUUID(), email: `db-test-${randomUUID()}@example.invalid`,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

test('rejects incomplete or malformed cached profile data before it reaches the UI', () => {
  const profile = makeProfile();
  assert.equal(isProfileSnapshot([profile]), true);
  assert.equal(isProfileSnapshot([{ id: profile.id, userId: profile.userId, isVerified: true, partnerPreferences: {} }]), false);
  assert.equal(isProfileSnapshot([{ ...profile, partnerPreferences: { ...profile.partnerPreferences, religions: null } }]), false);
  assert.equal(isProfileSnapshot([{ ...profile, hobbies: 'invalid' }]), false);
});

test('all biodata fields roundtrip through named PostgreSQL columns, including arrays and preferences', async () => {
  const profile = makeProfile();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await client.query('SELECT revision FROM profile_cache_state WHERE id = TRUE');
    await saveProfile(profile, client);
    const after = await client.query('SELECT revision FROM profile_cache_state WHERE id = TRUE');
    assert.ok(BigInt(after.rows[0].revision) > BigInt(before.rows[0].revision), 'profile and cache revision change in the same transaction');
    const { rows: [row] } = await client.query('SELECT * FROM matrimonial_profiles WHERE id = $1', [profile.id]);
    for (const key of Object.keys(profileFields)) {
      const column = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      assert.deepEqual(row[column], profile[key] ?? null, `stored ${key}`);
    }
    const edited = { ...profile, city: 'Bengaluru', isVerified: true, verificationReviewedBy: 'test-admin', verificationReviewedAt: profile.updatedAt };
    await saveProfile(edited, client);
    const { rows: [view] } = await client.query('SELECT * FROM member_registration_details WHERE id = $1', [profile.id]);
    assert.equal(view.city, 'Bengaluru');
    assert.equal(view.is_verified, true);
    assert.equal(view.partner_min_age, '22');
    assert.equal(view.partner_max_height, '200');
    assert.deepEqual(JSON.parse(view.partner_locations), ['Mysuru', 'Bengaluru']);
    assert.equal(view.password_hash, undefined);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  const { rowCount } = await pool.query('SELECT id FROM matrimonial_profiles WHERE id = $1', [profile.id]);
  assert.equal(rowCount, 0, 'test profiles are rolled back');
});

test('registration rolls back its login account when the biodata write fails', async () => {
  const profile = makeProfile();
  const user = { id: profile.userId, email: profile.email, passwordHash: 'test-only-not-a-login', role: 'user', createdAt: profile.createdAt };
  await assert.rejects(createUserWithProfile(user, { ...profile, height: null }), error => error.code === '23502');
  const accounts = await pool.query('SELECT id FROM auth_users WHERE id = $1', [user.id]);
  const profiles = await pool.query('SELECT id FROM matrimonial_profiles WHERE id = $1', [profile.id]);
  assert.equal(accounts.rowCount, 0);
  assert.equal(profiles.rowCount, 0);
});

test('profile requests read committed data and reflect approvals without restarting server memory', async () => {
  const profile = makeProfile();
  const user = { id: profile.userId, email: profile.email, passwordHash: 'test-only-not-a-login', role: 'user', createdAt: profile.createdAt };
  await createUserWithProfile(user, profile);
  const viewerId = randomUUID();
  const viewerEmail = `profile-viewer-${viewerId}@example.invalid`;
  await pool.query('INSERT INTO auth_users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)', [viewerId, viewerEmail, 'test-only-not-a-login', 'user', profile.createdAt]);
  const viewerToken = jwt.sign({ id: viewerId, role: 'user', email: viewerEmail, authVersion: 0 }, JWT_SECRET);
  const viewerOptions = { headers: { Authorization: `Bearer ${viewerToken}` } };
  const app = express();
  app.use(express.json());
  app.use('/profiles', profileRoutes);
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const endpoint = `http://127.0.0.1:${server.address().port}/profiles/${profile.id}`;
  try {
    assert.equal((await fetch(endpoint)).status, 401, 'signed-out users cannot open profiles');
    assert.equal((await fetch(endpoint.slice(0, endpoint.lastIndexOf('/')))).status, 401, 'signed-out users cannot search');
    assert.equal((await fetch(`${endpoint.slice(0, endpoint.lastIndexOf('/'))}/stats`)).status, 200, 'aggregate home-page statistics remain public');
    assert.equal((await fetch(endpoint, viewerOptions)).status, 404, 'pending profiles are hidden');
    await saveProfile({ ...profile, isVerified: true });
    const publicResponse = await fetch(endpoint, viewerOptions);
    assert.equal(publicResponse.status, 200, 'approval is visible on the next request');
    const publicProfile = await publicResponse.json();
    assert.equal(publicProfile.phone, 'Connect to Unlock Phone Number');
    assert.equal(publicProfile.email, 'Connect to Unlock Email ID');
    const search = await (await fetch(endpoint.slice(0, endpoint.lastIndexOf('/')), viewerOptions)).json();
    const listed = search.profiles.find(item => item.id === profile.id);
    assert.equal(listed.phone, 'Connect to Unlock Phone Number');
    assert.equal(listed.email, 'Connect to Unlock Email ID');
    await saveProfile({ ...profile, isVerified: false });
    assert.equal((await fetch(endpoint, viewerOptions)).status, 404, 'hidden profiles cannot leak through earlier snapshots');
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email, authVersion: 0 }, JWT_SECRET);
    const own = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(own.status, 200);
    assert.equal((await own.json()).fullName, profile.fullName, 'owners can still inspect pending biodata');
    const invalidEdit = await fetch(endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ annualIncome: -5 }) });
    assert.equal(invalidEdit.status, 400, 'invalid edits never reach storage');
    const originalSave = db.save;
    db.save = () => { throw new Error('simulated local mirror failure'); };
    try {
      const committedEdit = await fetch(endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ city: 'Committed despite mirror failure' }) });
      assert.equal(committedEdit.status, 200, 'a committed PostgreSQL edit remains successful if its optional JSON mirror fails');
      assert.equal((await committedEdit.json()).city, 'Committed despite mirror failure');
    } finally { db.save = originalSave; }
    const initial = await editProfile(profile.id, user.id, { city: 'Updated city' });
    await pool.query('UPDATE matrimonial_profiles SET phone = $1, phone_verified = FALSE WHERE id = $2', ['+16505550109', profile.id]);
    const edited = await editProfile(profile.id, user.id, { profession: 'Updated profession', phone: profile.phone, isVerified: true });
    assert.equal(edited.phone, '+16505550109', 'stale client fields cannot undo a phone update');
    assert.equal(edited.city, initial.city, 'unrelated edits are merged with the latest database row');
    assert.equal(edited.isVerified, false);
    await assert.rejects(reviewProfile(profile.id, true, 'test-reviewer', initial.updatedAt), error => error.status === 409);
    const reviewed = await reviewProfile(profile.id, true, 'test-reviewer', edited.updatedAt);
    assert.equal(reviewed.isVerified, true);
  } finally {
    const mirrorIndex = db.profiles.findIndex(item => item.id === profile.id);
    if (mirrorIndex >= 0) db.profiles.splice(mirrorIndex, 1);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM matrimonial_profiles WHERE id = $1 AND user_id = $2', [profile.id, user.id]);
      await bumpProfileRevision(client);
      await client.query('DELETE FROM auth_users WHERE id = $1 AND email = $2', [user.id, user.email]);
      await client.query('DELETE FROM auth_users WHERE id = $1 AND email = $2', [viewerId, viewerEmail]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
});

test('direct SQL changes advance the cache revision inside the same transaction', async () => {
  const profile = makeProfile();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await saveProfile(profile, client);
    const before = await client.query('SELECT revision FROM profile_cache_state WHERE id = TRUE');
    await client.query('UPDATE matrimonial_profiles SET is_verified = TRUE WHERE id = $1', [profile.id]);
    const after = await client.query('SELECT revision FROM profile_cache_state WHERE id = TRUE');
    assert.ok(BigInt(after.rows[0].revision) > BigInt(before.rows[0].revision));
    await client.query('DELETE FROM matrimonial_profiles WHERE id = $1', [profile.id]);
    const removed = await client.query('SELECT revision FROM profile_cache_state WHERE id = TRUE');
    assert.ok(BigInt(removed.rows[0].revision) > BigInt(after.rows[0].revision));
  } finally { await client.query('ROLLBACK'); client.release(); }
});
