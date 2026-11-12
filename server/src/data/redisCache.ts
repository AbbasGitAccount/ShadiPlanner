import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';

export interface CacheTransport {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
}

// Cache failures must never turn a successful database read into a failed request.
export class JsonCache {
  constructor(private transport: () => Promise<CacheTransport | null>, private prefix: string, private ttl = 60) {}
  async readThrough<T>(key: string, load: () => Promise<T>, valid: (value: unknown) => value is T): Promise<T> {
    let transport: CacheTransport | null = null;
    try {
      transport = await this.transport();
      const cached = transport && await transport.get(`${this.prefix}:${key}`);
      if (cached) {
        try { const value: unknown = JSON.parse(cached); if (valid(value)) return value; } catch { /* Replace invalid cached data. */ }
      }
    } catch { transport = null; }
    const value = await load();
    if (transport) {
      try { await transport.set(`${this.prefix}:${key}`, JSON.stringify(value), { EX: this.ttl }); } catch { /* PostgreSQL already succeeded. */ }
    }
    return value;
  }
}

let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<void> | undefined;
let nextRetry = 0;
let lastWarning = 0;
const warning = () => {
  if (Date.now() - lastWarning > 30000) {
    lastWarning = Date.now();
    console.warn('Redis is unavailable; profile reads are using PostgreSQL.');
  }
};

async function getRedis(): Promise<CacheTransport | null> {
  if (!process.env.REDIS_URL) return null;
  if (!client?.isReady) {
    if (Date.now() < nextRetry) return null;
    if (!connecting) {
      connecting = (async () => {
        try {
          client?.destroy();
          client = createClient({ url: process.env.REDIS_URL, RESP: 2, disableOfflineQueue: true, socket: { connectTimeout: 1000, reconnectStrategy: false } });
          client.on('error', warning);
          await client.connect();
        } catch {
          nextRetry = Date.now() + 30000;
          client?.destroy();
          client = undefined;
          warning();
        }
      })().finally(() => { connecting = undefined; });
    }
    await connecting;
  }
  if (!client?.isReady) return null;
  const ready = client;
  const run = async <T>(command: () => Promise<T>): Promise<T> => {
    try { return await command(); }
    catch (error) {
      nextRetry = Date.now() + 30000;
      if (client === ready) { ready.destroy(); client = undefined; }
      warning();
      throw error;
    }
  };
  return {
    get: key => run(() => ready.withCommandOptions({ abortSignal: AbortSignal.timeout(500) }).get(key)),
    set: (key, value, options) => run(() => ready.withCommandOptions({ abortSignal: AbortSignal.timeout(500) }).set(key, value, options)),
  };
}

const databaseNamespace = createHash('sha256').update(process.env.DATABASE_URL || 'local').digest('hex').slice(0, 16);
export const profileCache = new JsonCache(getRedis, `shadiplanner:${databaseNamespace}:v1`, 60);
export const initializeRedisCache = async (): Promise<void> => { await getRedis(); };
export const redisCacheStatus = () => !process.env.REDIS_URL ? 'disabled' : client?.isReady ? 'connected' : 'unavailable';
export const closeRedisCache = async (): Promise<void> => { await connecting; client?.destroy(); client = undefined; };
