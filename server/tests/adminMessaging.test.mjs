import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../dist/data/postgres.js';
import { createUser, createUserWithProfile } from '../dist/data/authDatabase.js';
import { initializeAdminMessagingDatabase, administratorConversations, memberAdministratorConversations, readAdministratorThread, replyToAdministrator, sendAdministratorMessage } from '../dist/data/adminMessagingDatabase.js';
import { buildRegistrationProfile } from '../dist/models/registration.js';
import { closeRedisCache } from '../dist/data/redisCache.js';
import { JWT_SECRET } from '../dist/middleware/auth.js';
import messageRoutes from '../dist/routes/messages.js';

after(async () => { await closeRedisCache(); await pool.end(); });

test('administrator messaging supports pending profiles without weakening member permissions', async t => {
  await initializeAdminMessagingDatabase();
  const users = ['admin', 'admin', 'user', 'user', 'user'].map(role => ({
    id: randomUUID(), email: `admin-chat-test-${randomUUID()}@example.invalid`, passwordHash: 'test-only-not-a-login', role, createdAt: new Date().toISOString(),
  }));
  const [admin, otherAdmin, pendingMember, approvedMember, stranger] = users;
  const profiles = [pendingMember, approvedMember, stranger].map((user, index) => ({
    ...buildRegistrationProfile({
      fullName: `Admin messaging test ${index}`, gender: 'Other', dateOfBirth: '2000-01-01', height: '165', maritalStatus: 'Never Married',
      religion: 'None', motherTongue: 'English', manglik: 'Prefer not to say', highestEducation: 'Diploma', profession: 'Student',
      annualIncome: '0', city: 'Test city', state: 'Test state', country: 'Test country', citizenship: 'Test citizenship',
      familyType: 'Joint', familyStatus: 'Prefer not to say', brothersCount: '0', sistersCount: '0', diet: 'Vegan', smoking: 'No', drinking: 'No',
      aboutMe: 'Temporary test profile.', phone: '+16505550100', minAge: '18', maxAge: '50', minHeight: '100', maxHeight: '250', minIncome: '0',
    }), id: randomUUID(), userId: user.id, email: user.email, isVerified: index === 1, createdAt: user.createdAt, updatedAt: user.createdAt,
  }));
  const [pending, approved] = profiles;
  const adminProfile = { ...approved, id: randomUUID(), userId: otherAdmin.id, email: otherAdmin.email, isVerified: false };
  let server;
  try {
    await createUser(admin); await createUserWithProfile(otherAdmin, adminProfile);
    for (let index = 0; index < profiles.length; index++) await createUserWithProfile(users[index + 2], profiles[index]);
    const app = express();
    app.use(express.json()); app.use('/messages', messageRoutes);
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${server.address().port}/messages`;
    const request = async (user, path, content) => {
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, authVersion: 0 }, JWT_SECRET);
      const response = await fetch(`${base}${path}`, { method: content === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(content === undefined ? {} : { body: JSON.stringify({ content }) }) });
      return { status: response.status, data: await response.json() };
    };

    await t.test('admin without matrimonial profile sees all recipients and can start a pending thread', async () => {
      const conversations = await request(admin, '/conversations');
      assert.equal(conversations.status, 200);
      assert.ok(conversations.data.some(item => item.partnerId === pending.id && !item.partner.isVerified));
      assert.ok(conversations.data.some(item => item.partnerId === approved.id && item.partner.isVerified));
      assert.equal((await pool.query('SELECT id FROM matrimonial_profiles WHERE user_id = $1', [admin.id])).rowCount, 0);
      const sent = await request(admin, `/${pending.id}`, 'Please update the details in your profile.');
      assert.equal(sent.status, 201);
      assert.equal(sent.data.senderId, `admin:${admin.id}`);
      assert.equal(sent.data.receiverId, pending.id);
      assert.equal((await sendAdministratorMessage(admin.id, approved.id, 'Hello from the administrator.')).senderId, `admin:${admin.id}`);
    });

    await t.test('pending member sees the administrator, can read and reply, and unread counts are correct', async () => {
      const inbox = await request(pendingMember, '/conversations');
      assert.equal(inbox.status, 200);
      const conversation = inbox.data.find(item => item.partnerId === `admin:${admin.id}`);
      assert.equal(conversation.partner.isAdministrator, true);
      assert.equal(conversation.unreadCount, 1);
      const thread = await request(pendingMember, `/admin%3A${admin.id}`);
      assert.equal(thread.status, 200);
      assert.equal(thread.data[0].isRead, true);
      const reply = await request(pendingMember, `/admin%3A${admin.id}`, 'I have updated my details.');
      assert.equal(reply.status, 201);
      assert.equal(reply.data.senderId, pending.id);
      const adminInbox = await administratorConversations(admin.id, profiles);
      assert.equal(adminInbox.find(item => item.partnerId === pending.id).unreadCount, 1);
      const adminThread = await readAdministratorThread(admin.id, true, admin.id, pending.id);
      assert.equal(adminThread.length, 2);
      assert.equal(adminThread[1].isRead, true);
      assert.equal((await memberAdministratorConversations(pending.id))[0].lastMessage.content, 'I have updated my details.');
    });

    await t.test('members cannot impersonate an administrator, read another member thread, or start unsolicited admin threads', async () => {
      await assert.rejects(sendAdministratorMessage(pendingMember.id, approved.id, 'Forbidden'), error => error.status === 403);
      await assert.rejects(replyToAdministrator(stranger.id, pending.id, admin.id, 'Forbidden'), error => error.status === 403);
      await assert.rejects(readAdministratorThread(otherAdmin.id, true, admin.id, pending.id), error => error.status === 404);
      assert.equal((await request(stranger, `/admin%3A${admin.id}`)).status, 404);
      assert.equal((await request(stranger, `/admin%3A${admin.id}`, 'Unsolicited message')).status, 403);
      assert.notEqual((await request(pendingMember, `/${approved.id}`, 'No accepted connection')).status, 201);
      assert.equal((await request(approvedMember, `/${pending.id}`, 'Pending target')).status, 404);
    });

    await t.test('an admin-owned pending profile can also receive and reply to another administrator', async () => {
      assert.equal((await request(admin, `/${adminProfile.id}`, 'Please review your profile.')).status, 201);
      const inbox = await request(otherAdmin, '/conversations');
      assert.ok(inbox.data.some(item => item.partnerId === `admin:${admin.id}`));
      assert.equal((await request(otherAdmin, `/admin%3A${admin.id}`)).status, 200);
      assert.equal((await request(otherAdmin, `/admin%3A${admin.id}`, 'Thank you, I will update it.')).status, 201);
    });

    await t.test('rejects empty and oversized messages and rechecks role from PostgreSQL', async () => {
      for (const content of ['', '  ', 'x'.repeat(4001), {}]) assert.equal((await request(admin, `/${pending.id}`, content)).status, 400);
      await pool.query("UPDATE auth_users SET role = 'user' WHERE id = $1", [otherAdmin.id]);
      assert.notEqual((await request(otherAdmin, `/${pending.id}`, 'Role was revoked')).status, 201);
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM matrimonial_profiles WHERE id = ANY($1::text[]) AND user_id = ANY($2::text[])', [[...profiles, adminProfile].map(profile => profile.id), users.map(user => user.id)]);
      await client.query("DELETE FROM auth_users WHERE id = ANY($1::text[]) AND email LIKE 'admin-chat-test-%@example.invalid'", [users.map(user => user.id)]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
});
