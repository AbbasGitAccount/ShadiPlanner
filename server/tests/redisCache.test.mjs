import test from 'node:test';
import assert from 'node:assert/strict';
import { JsonCache } from '../dist/data/redisCache.js';

const valid = value => Array.isArray(value) && value.every(item => typeof item === 'string');
function transport() {
  const stored = new Map();
  const writes = [];
  return { stored, writes, async get(key) { return stored.get(key) ?? null; }, async set(key, value, options) { stored.set(key, value); writes.push({ key, options }); } };
}

test('caches successful reads in Redis with a finite expiry and reuses the stored value', async () => {
  const redis = transport();
  const cache = new JsonCache(async () => redis, 'test', 60);
  let loads = 0;
  const load = async () => { loads++; return ['profile-one']; };
  assert.deepEqual(await cache.readThrough('profiles:1', load, valid), ['profile-one']);
  assert.deepEqual(await cache.readThrough('profiles:1', load, valid), ['profile-one']);
  assert.equal(loads, 1);
  assert.deepEqual(redis.writes, [{ key: 'test:profiles:1', options: { EX: 60 } }]);
});

test('a committed database revision makes earlier profile values unreachable', async () => {
  const redis = transport();
  const cache = new JsonCache(async () => redis, 'test');
  await cache.readThrough('profiles:1', async () => ['approved'], valid);
  assert.deepEqual(await cache.readThrough('profiles:2', async () => ['pending-review'], valid), ['pending-review']);
  assert.equal(redis.stored.has('test:profiles:1'), true, 'old keys may expire naturally but are not reused');
});

test('uses PostgreSQL when Redis is absent, unreachable, or returns corrupt data', async () => {
  for (const provider of [async () => null, async () => { throw new Error('offline'); }, async () => ({ get: async () => { throw new Error('offline'); } })]) {
    const cache = new JsonCache(provider, 'test');
    assert.deepEqual(await cache.readThrough('profiles:1', async () => ['database'], valid), ['database']);
  }
  for (const invalid of ['{invalid-json', '{"unexpected":"data"}']) {
    const redis = transport();
    redis.stored.set('test:profiles:1', invalid);
    const cache = new JsonCache(async () => redis, 'test');
    assert.deepEqual(await cache.readThrough('profiles:1', async () => ['database'], valid), ['database']);
    assert.deepEqual(JSON.parse(redis.stored.get('test:profiles:1')), ['database']);
  }
});

test('a cache write failure never fails a completed database read', async () => {
  const cache = new JsonCache(async () => ({ get: async () => null, set: async () => { throw new Error('full'); } }), 'test');
  assert.deepEqual(await cache.readThrough('profiles:1', async () => ['database'], valid), ['database']);
});

test('propagates database failures without caching a fabricated result or retrying writes', async () => {
  const redis = transport();
  const cache = new JsonCache(async () => redis, 'test');
  let loads = 0;
  await assert.rejects(cache.readThrough('profiles:1', async () => { loads++; throw new Error('database offline'); }, valid), /database offline/);
  assert.equal(loads, 1);
  assert.equal(redis.writes.length, 0);
});
