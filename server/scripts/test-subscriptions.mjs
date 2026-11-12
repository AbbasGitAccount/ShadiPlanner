import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

// Every write is confined to a new schema; existing accounts/data are untouched.
const schema = `subscription_test_${randomUUID().replaceAll('-', '')}`;
const administration = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
let pool;
let server;
try {
  await administration.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  // Neon transaction poolers reject startup search_path; use its direct endpoint
  // for the isolated schema. The application's configured connection is unchanged.
  url.hostname = url.hostname.replace('-pooler.', '.');
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET = 'isolated-subscription-test-secret';
  delete process.env.REDIS_URL;
  delete process.env.SUBSCRIPTION_DURATION_DAYS;
  process.env.GOLD_PRICE_PAISE = '99900'; process.env.PLATINUM_PRICE_PAISE = '199900'; process.env.FREE_PROFILE_LIMIT = '20';
  ({ pool } = await import('../dist/data/postgres.js'));
  await pool.query(`CREATE TABLE auth_users(id TEXT PRIMARY KEY,email TEXT,password_hash TEXT,role TEXT,created_at TEXT,auth_version INTEGER DEFAULT 0,phone TEXT,phone_verified BOOLEAN DEFAULT FALSE);
    CREATE TABLE app_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ DEFAULT NOW())`);
  const { initializeProfileDatabase, saveProfile } = await import('../dist/data/profileDatabase.js');
  const { initializeSubscriptions, membership, sendLimitedInterest, respondStoredInterest } = await import('../dist/data/subscriptionDatabase.js');
  const { SEED_PROFILES } = await import('../dist/data/mockData.js');
  const { db } = await import('../dist/data/db.js');
  // API view tracking still has a legacy mirror. Never write that real file in tests.
  db.save = () => {};
  db.saveProfileMirror = () => {};
  await initializeProfileDatabase([]);
  await initializeSubscriptions([]);
  await (await import('../dist/data/adminDatabase.js')).initializeAdminDatabase();
  for (const id of ['free-user', 'duplicate-user', 'gold-user', 'platinum-user']) await pool.query(`INSERT INTO auth_users(id,email,role,created_at) VALUES($1,$2,'user',$3)`, [id, `${id}@example.com`, new Date().toISOString()]);
  const template = SEED_PROFILES[0];
  const fixtures = await pool.connect();
  try {
    await fixtures.query('BEGIN');
    for (const id of ['free-user', 'duplicate-user', 'gold-user', 'platinum-user']) await saveProfile({ ...template, id: `own-${id}`, userId: id, gender: 'Male', isVerified: true }, fixtures);
    for (let i = 0; i < 30; i++) await saveProfile({ ...template, id: `target-${String(i).padStart(2, '0')}`, userId: `target-user-${i}`, gender: 'Female', isVerified: true }, fixtures);
    await fixtures.query('COMMIT');
  } finally { fixtures.release(); }
  console.log('Isolated schema and fixtures ready.');
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const subscriptionRoutes = (await import('../dist/routes/subscriptions.js')).default;
  const profileRoutes = (await import('../dist/routes/profiles.js')).default;
  const interactionRoutes = (await import('../dist/routes/interactions.js')).default;
  const app = express(); app.use(express.json());
  app.use('/subscriptions', subscriptionRoutes); app.use('/profiles', profileRoutes); app.use('/interactions', interactionRoutes);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, user = 'free-user', body) => {
    const response = await fetch(root + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const catalogue = await request('/subscriptions/plans', null);
  assert.deepEqual(catalogue.data.plans.map(plan => plan.pricePaise), [0,99900,199900]);
  assert.equal(catalogue.data.plans[1].durationDays, null);
  assert.equal(catalogue.data.checkout.available, false);
  assert.equal((await request('/subscriptions/me', null)).status, 401);
  assert.equal((await request('/profiles?city=Mumbai')).status, 403);
  const browse = await request('/profiles');
  assert.equal(browse.status, 200);
  assert.ok(browse.data.profiles.length <= 20);
  const allowed = browse.data.profiles.map(profile => profile.id);
  assert.equal((await request('/profiles/target-29')).status, 404);
  const sends = await Promise.all(allowed.slice(0,10).map(target => request(`/interactions/interest/${target}`, 'free-user', { message: 'Test request' })));
  assert.equal(sends.filter(result => result.status === 201).length, 5);
  assert.equal(sends.filter(result => result.status === 403).length, 5);
  assert.equal((await membership('free-user')).interestsUsed, 5);
  const makeInterest = (user, target) => ({ id: randomUUID(), senderProfileId: `own-${user}`, receiverProfileId: target, status: 'pending', sentAt: new Date().toISOString(), message: 'Test' });
  const duplicate = await Promise.allSettled([sendLimitedInterest('duplicate-user', makeInterest('duplicate-user','target-01')), sendLimitedInterest('duplicate-user', makeInterest('duplicate-user','target-01'))]);
  assert.equal(duplicate.filter(result => result.status === 'fulfilled').length,1);
  assert.equal((await membership('duplicate-user')).interestsUsed,1);
  await pool.query(`INSERT INTO user_subscriptions(user_id,plan_id,status,started_at,expires_at) VALUES('gold-user','gold','active',NOW(),NOW()+INTERVAL '1 day'),('platinum-user','platinum','active',NOW(),NOW()+INTERVAL '1 day')`);
  const priorUsage = [...Array.from({length:49},(_,i) => makeInterest('gold-user',`prior-gold-${i}`)), ...Array.from({length:55},(_,i) => makeInterest('platinum-user',`prior-platinum-${i}`))];
  await pool.query(`INSERT INTO subscription_interests(id,sender_profile_id,receiver_profile_id,pair_key,sent_at,payload)
    SELECT item->>'id',item->>'senderProfileId',item->>'receiverProfileId',item->>'id',NOW(),item FROM jsonb_array_elements($1::jsonb) item`, [JSON.stringify(priorUsage)]);
  const gold = await Promise.allSettled(Array.from({length:3},(_,i) => sendLimitedInterest('gold-user',makeInterest('gold-user',`quota-${i}`))));
  assert.equal(gold.filter(result => result.status === 'fulfilled').length,1);
  assert.equal((await membership('gold-user')).interestsUsed,50);
  const platinum = await Promise.allSettled(Array.from({length:5},(_,i) => sendLimitedInterest('platinum-user',makeInterest('platinum-user',`quota-${i}`))));
  assert.equal(platinum.filter(result => result.status === 'fulfilled').length,5);
  assert.equal((await membership('platinum-user')).interestsUsed,60);
  const sent = sends.find(result => result.status === 201).data.interest;
  await respondStoredInterest(sent.id, sent.receiverProfileId, 'accepted');
  assert.equal((await request(`/profiles/${sent.receiverProfileId}`)).data.isContactUnlocked,false);
  await pool.query(`INSERT INTO user_subscriptions(user_id,plan_id,status,started_at,expires_at) VALUES('free-user','gold','active',NOW(),NOW()+INTERVAL '1 day')`);
  assert.equal((await request(`/profiles/${sent.receiverProfileId}`)).data.isContactUnlocked,true);
  assert.equal((await membership('free-user')).interestsUsed,5); // An upgrade cannot reset usage.
  await pool.query(`UPDATE user_subscriptions SET started_at=NOW()-INTERVAL '2 days', expires_at=NOW()-INTERVAL '1 day' WHERE user_id IN ('free-user','gold-user')`);
  assert.equal((await membership('gold-user')).plan.id,'free');
  assert.equal((await request(`/profiles/${sent.receiverProfileId}`)).data.isContactUnlocked,false);
  await assert.rejects(sendLimitedInterest('gold-user',makeInterest('gold-user','over-expired-quota')), error => error.status === 403);
  assert.equal((await request('/subscriptions/checkout','free-user',{planId:'platinum',price:1,status:'active'})).status,503);
  assert.equal((await request('/subscriptions/verify','free-user',{orderId:'forged',paymentId:'forged',success:true})).status,503);
  assert.equal((await membership('free-user')).plan.id,'free');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM subscription_orders')).rows[0].n,0);
  console.log('PASS: quota concurrency, browsing, contact privacy, expiry, and blocked forged activation.');
  await pool.query(`UPDATE subscription_interests SET sent_at=date_trunc('month',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - INTERVAL '1 day' WHERE sender_profile_id='own-free-user'`);
  assert.equal((await membership('free-user')).interestsUsed,0);
  await assert.rejects(pool.query(`INSERT INTO user_subscriptions(user_id,plan_id,status,started_at,expires_at) VALUES('free-user','gold','active',NOW(),NOW()+INTERVAL '1 day')`), error => error.code === '23505');
  // Exercise the actual activation path using a server-side test adapter only.
  // Public API routes still have no provider and cannot access this adapter.
  const { createCheckout, verifyCheckout } = await import('../dist/services/subscriptionPayments.js');
  process.env.SUBSCRIPTION_DURATION_DAYS='30';
  await pool.query("UPDATE subscription_plans SET configuration=jsonb_set(configuration,'{durationDays}','30') WHERE id<>'free'");
  await initializeSubscriptions([]);
  let providerOrder;
  let verifiedPayment;
  const adapter = {
    async createOrder(input) { providerOrder = { ...input, providerId: `provider-${input.id}` }; return { id: providerOrder.providerId, checkoutUrl: 'https://example.com/isolated-checkout' }; },
    async verifyPayment() { return verifiedPayment; },
  };
  const order = await createCheckout('free-user','gold',adapter);
  await assert.rejects(createCheckout('free-user','gold',adapter), error => error.status===409);
  await assert.rejects(verifyCheckout('duplicate-user',order.orderId,'payment-1',adapter), error => error.status===404);
  verifiedPayment = { captured: true, orderId: providerOrder.providerId, amountPaise: 1, currency: 'INR' };
  await assert.rejects(verifyCheckout('free-user',order.orderId,'payment-1',adapter), error => error.status===400);
  assert.equal((await membership('free-user')).plan.id,'free');
  verifiedPayment.amountPaise=providerOrder.amountPaise; verifiedPayment.captured=false;
  await assert.rejects(verifyCheckout('free-user',order.orderId,'payment-1',adapter), error => error.status===400);
  verifiedPayment.captured=true; verifiedPayment.currency='USD';
  await assert.rejects(verifyCheckout('free-user',order.orderId,'payment-1',adapter), error => error.status===400);
  verifiedPayment.currency='INR';
  const activated = await verifyCheckout('free-user',order.orderId,'payment-1',adapter);
  assert.equal(activated.plan.id,'gold');
  assert.equal((await verifyCheckout('free-user',order.orderId,'payment-1',adapter)).expiresAt, activated.expiresAt);
  await assert.rejects(verifyCheckout('free-user',order.orderId,'different-payment',adapter), error => error.status===409);
  process.env.GOLD_PRICE_PAISE='123456';
  await initializeSubscriptions([]);
  assert.equal((await request('/subscriptions/plans',null)).data.plans[1].pricePaise,99900);
  console.log('PASS: configurable prices, verified activation, order ownership, amount/currency/capture validation, duplicate checkout prevention and idempotent verification.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  if (!/^subscription_test_[a-f0-9]+$/.test(schema)) throw new Error('Invalid test schema');
  await administration.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await administration.end();
}
