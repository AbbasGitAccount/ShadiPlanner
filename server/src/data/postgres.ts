import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to start the server. Please set it in your environment variables.');
}

if (/@HOST(\b|[:/?])/i.test(process.env.DATABASE_URL) || /USERNAME:PASSWORD@/i.test(process.env.DATABASE_URL)) {
  throw new Error(
    "DATABASE_URL contains the template placeholder 'HOST'. Please replace it with your actual PostgreSQL connection string in your environment variables (e.g. Neon, Supabase, Vercel Postgres, or AWS RDS)."
  );
}

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
}

export const pool = new Pool({ connectionString });
pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));
