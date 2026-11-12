import dotenv from 'dotenv';
import { createClient } from 'redis';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
if (!process.env.REDIS_URL) {
  console.error('REDIS_URL is missing from server/.env.');
  process.exitCode = 1;
} else {
  const client = createClient({ url: process.env.REDIS_URL, RESP: 2, socket: { connectTimeout: 1500, reconnectStrategy: false } });
  client.on('error', () => {});
  try {
    await client.connect();
    console.log(`Redis connection: ${await client.ping() === 'PONG' ? 'ready' : 'unavailable'}`);
  } catch {
    console.error('Redis is not running or cannot be reached. Start it with npm run redis:up from the project root, then try again.');
    process.exitCode = 1;
  } finally { client.destroy(); }
}
