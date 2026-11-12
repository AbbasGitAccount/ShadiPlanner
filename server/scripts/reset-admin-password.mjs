import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Resolve configuration relative to this script, regardless of the terminal directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const email = args.find(arg => !arg.startsWith('--'))?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || args.some(arg => arg.startsWith('--') && arg !== '--check')) {
  console.error('Usage: npm run admin:reset-password -- admin@example.com [--check]');
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in server/.env before running this command.');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    if (checkOnly) {
      const result = await pool.query("SELECT email FROM auth_users WHERE LOWER(email) = $1 AND role = 'admin'", [email]);
      console.log(result.rowCount ? `Administrator account found: ${result.rows[0].email}. No changes made.` : 'No administrator account found for this email. No changes made.');
      if (!result.rowCount) process.exitCode = 1;
    } else {
      const password = randomBytes(18).toString('base64url');
      const hash = await bcrypt.hash(password, 12);
      await pool.query('ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0');
      // Never create an account or promote a member through password recovery.
      const result = await pool.query(
        "UPDATE auth_users SET password_hash = $1, auth_version = auth_version + 1 WHERE LOWER(email) = $2 AND role = 'admin' RETURNING email",
        [hash, email]
      );
      if (!result.rowCount) {
        console.error('No administrator account found for this email. No password was changed.');
        process.exitCode = 1;
      } else {
        console.log(`Administrator password reset for ${result.rows[0].email}.`);
        console.log(`New password: ${password}`);
        console.log('Save this password in your password manager. Sign in at /login.');
      }
    }
  } catch (error) {
    // Do not print the connection string or database credentials.
    console.error(`Could not complete administrator recovery${error.code ? ` (${error.code})` : ''}. Check your database connection and try again.`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
