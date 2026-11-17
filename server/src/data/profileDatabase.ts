import { PoolClient } from 'pg';
import { pool } from './postgres.js';
import { MatrimonialProfile } from '../models/types.js';
import { profileCache } from './redisCache.js';
import { ProfileUpdateError, validateProfilePatch } from '../models/profileUpdate.js';
import { activeFeatureUsers } from './subscriptionDatabase.js';

// One named PostgreSQL column for every biodata field; lists use text arrays.
export const profileFields = {
  id: 'TEXT PRIMARY KEY', userId: 'TEXT NOT NULL UNIQUE', fullName: 'TEXT NOT NULL',
  gender: 'TEXT NOT NULL', dateOfBirth: 'TEXT NOT NULL', age: 'INTEGER NOT NULL',
  height: 'DOUBLE PRECISION NOT NULL', heightFormatted: 'TEXT NOT NULL', maritalStatus: 'TEXT NOT NULL',
  motherTongue: 'TEXT NOT NULL', languagesKnown: 'TEXT[] NOT NULL', religion: 'TEXT NOT NULL',
  community: 'TEXT NOT NULL', subCommunity: 'TEXT', gothram: 'TEXT', manglik: 'TEXT NOT NULL', rashi: 'TEXT', nakshatra: 'TEXT',
  highestEducation: 'TEXT NOT NULL', collegeUniversity: 'TEXT', profession: 'TEXT NOT NULL', company: 'TEXT',
  annualIncome: 'DOUBLE PRECISION NOT NULL', annualIncomeFormatted: 'TEXT NOT NULL', workLocation: 'TEXT NOT NULL',
  city: 'TEXT NOT NULL', state: 'TEXT NOT NULL', country: 'TEXT NOT NULL', citizenship: 'TEXT NOT NULL',
  familyType: 'TEXT NOT NULL', familyStatus: 'TEXT NOT NULL', fatherOccupation: 'TEXT NOT NULL', motherOccupation: 'TEXT NOT NULL',
  brothersCount: 'INTEGER NOT NULL', sistersCount: 'INTEGER NOT NULL', familyLocation: 'TEXT NOT NULL',
  diet: 'TEXT NOT NULL', smoking: 'TEXT NOT NULL', drinking: 'TEXT NOT NULL', hobbies: 'TEXT[] NOT NULL',
  profilePhoto: 'TEXT NOT NULL', galleryPhotos: 'TEXT[] NOT NULL', aboutMe: 'TEXT NOT NULL', aboutFamily: 'TEXT',
  isVerified: 'BOOLEAN NOT NULL', verificationReviewedBy: 'TEXT', verificationReviewedAt: 'TEXT',
  phoneVerified: 'BOOLEAN NOT NULL', govtIdVerified: 'BOOLEAN NOT NULL', premiumMember: 'BOOLEAN NOT NULL',
  partnerPreferences: 'JSONB NOT NULL', phone: 'TEXT NOT NULL', email: 'TEXT NOT NULL', createdAt: 'TEXT NOT NULL', updatedAt: 'TEXT NOT NULL',
} satisfies Record<Exclude<keyof MatrimonialProfile, 'enhancedVisibility' | 'isContactUnlocked' | 'isPhotoUnlocked'>, string>;

const fields = Object.keys(profileFields) as (keyof typeof profileFields)[];
const column = (key: string): string => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const columns = fields.map(column);
const insertSql = `INSERT INTO matrimonial_profiles (${columns.join(', ')}) VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})`;
const values = (profile: MatrimonialProfile) => fields.map(key => profile[key] ?? null);
const upsertSql = `${insertSql} ON CONFLICT (id) DO UPDATE SET ${columns.filter(name => name !== 'id').map(name => `${name} = EXCLUDED.${name}`).join(', ')}`;
const selectFields = fields.map(key => `${column(key)} AS "${key}"`).join(', ');

export async function bumpProfileRevision(connection: Pick<PoolClient, 'query'>): Promise<void> {
  await connection.query('UPDATE profile_cache_state SET revision = revision + 1 WHERE id = TRUE');
}

export async function saveProfile(profile: MatrimonialProfile, connection?: Pick<PoolClient, 'query'>): Promise<MatrimonialProfile> {
  if (connection) {
    const result = await connection.query(`${upsertSql} RETURNING ${selectFields}`, values(profile));
    return result.rows[0] as MatrimonialProfile;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saved = await saveProfile(profile, client);
    await client.query('COMMIT');
    return saved;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

// Re-read under a row lock before applying edits so stale Redis/request snapshots
// cannot overwrite a concurrent phone update or verification review.
export async function editProfile(id: string, userId: string, input: unknown): Promise<MatrimonialProfile> {
  const patch = validateProfilePatch(input);
  return mutateProfile(id, profile => {
    if (profile.userId !== userId) throw new ProfileUpdateError('You cannot edit this profile.', 403);
    return { ...profile, ...patch, isVerified: false, verificationReviewedBy: undefined, verificationReviewedAt: undefined, updatedAt: new Date().toISOString() };
  });
}

export async function reviewProfile(id: string, verified: boolean, reviewer: string, expectedUpdatedAt: unknown): Promise<MatrimonialProfile> {
  return mutateProfile(id, profile => {
    if (typeof expectedUpdatedAt !== 'string' || profile.updatedAt !== expectedUpdatedAt) throw new ProfileUpdateError('This profile changed since you opened it. Refresh and review the latest details before approving.', 409);
    return { ...profile, isVerified: verified, verificationReviewedBy: reviewer, verificationReviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
}

async function mutateProfile(id: string, update: (profile: MatrimonialProfile) => MatrimonialProfile): Promise<MatrimonialProfile> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT ${selectFields} FROM matrimonial_profiles WHERE id = $1 FOR UPDATE`, [id]);
    if (!result.rowCount) throw new ProfileUpdateError('Profile not found.', 404);
    const profile = update(result.rows[0]);
    const saved = await saveProfile(profile, client);
    await client.query('COMMIT');
    return { ...saved, premiumMember: (await activeFeatureUsers('premiumBadge')).has(saved.userId) };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export function isProfileSnapshot(value: unknown): value is MatrimonialProfile[] {
  if (!Array.isArray(value)) return false;
  return value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const profile = item as Record<string, unknown>;
    return fields.every(key => {
      const field = profile[key];
      const type = profileFields[key];
      if (field === null || field === undefined) return !type.includes('NOT NULL') && !type.includes('PRIMARY KEY');
      if (type.startsWith('TEXT[]')) return Array.isArray(field) && field.every(value => typeof value === 'string');
      if (type.startsWith('TEXT')) return typeof field === 'string';
      if (type.startsWith('BOOLEAN')) return typeof field === 'boolean';
      if (type.startsWith('INTEGER')) return typeof field === 'number' && Number.isInteger(field);
      if (type.startsWith('DOUBLE')) return typeof field === 'number' && Number.isFinite(field);
      if (key === 'partnerPreferences') {
        if (!field || typeof field !== 'object' || Array.isArray(field)) return false;
        const prefs = field as Record<string, unknown>;
        return ['minAge', 'maxAge', 'minHeight', 'maxHeight', 'minIncome'].every(name => typeof prefs[name] === 'number' && Number.isFinite(prefs[name])) &&
          ['maritalStatus', 'religions', 'communities', 'motherTongues', 'educationLevels', 'occupations', 'locations', 'diet'].every(name => Array.isArray(prefs[name]) && (prefs[name] as unknown[]).every(value => typeof value === 'string'));
      }
      return false;
    });
  });
}

export async function loadProfiles(): Promise<MatrimonialProfile[]> {
  // The revision is committed with each edit. Older cache keys can never hide new approvals or edits.
  const revision = await pool.query('SELECT revision::text FROM profile_cache_state WHERE id = TRUE');
  const profiles = await profileCache.readThrough(`profiles:${revision.rows[0].revision}`, async () => {
    const result = await pool.query(`SELECT ${fields.map(key => `${column(key)} AS "${key}"`).join(', ')} FROM matrimonial_profiles ORDER BY id`);
    return result.rows as MatrimonialProfile[];
  }, isProfileSnapshot);
  const [badges,boosted]=await Promise.all([activeFeatureUsers('premiumBadge'),activeFeatureUsers('enhancedVisibility')]);
  return profiles.map(profile => ({ ...profile, premiumMember: badges.has(profile.userId), enhancedVisibility:boosted.has(profile.userId) }));
}

export async function initializeProfileDatabase(legacyProfiles: MatrimonialProfile[]): Promise<MatrimonialProfile[]> {
  // Legacy demo profiles may have no auth account. Preserve them without creating login credentials.
  await pool.query(`CREATE TABLE IF NOT EXISTS matrimonial_profiles (${fields.map(key => `${column(key)} ${profileFields[key]}`).join(', ')})`);
  await pool.query('CREATE TABLE IF NOT EXISTS profile_cache_state (id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id), revision BIGINT NOT NULL DEFAULT 0)');
  await pool.query('INSERT INTO profile_cache_state (id) VALUES (TRUE) ON CONFLICT DO NOTHING');
  await pool.query(`CREATE OR REPLACE FUNCTION shadiplanner_bump_profile_cache_revision() RETURNS trigger AS $$
    BEGIN
      UPDATE profile_cache_state SET revision = revision + 1 WHERE id = TRUE;
      RETURN NULL;
    END;
  $$ LANGUAGE plpgsql`);
  await pool.query(`CREATE OR REPLACE FUNCTION shadiplanner_profile_modified() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
      RETURN NEW;
    END;
  $$ LANGUAGE plpgsql`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(726320101)');
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'matrimonial_profiles_modified' AND tgrelid = 'matrimonial_profiles'::regclass) THEN
        CREATE TRIGGER matrimonial_profiles_modified BEFORE UPDATE ON matrimonial_profiles
        FOR EACH ROW EXECUTE FUNCTION shadiplanner_profile_modified();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'matrimonial_profiles_cache_revision' AND tgrelid = 'matrimonial_profiles'::regclass) THEN
        CREATE TRIGGER matrimonial_profiles_cache_revision AFTER INSERT OR UPDATE OR DELETE ON matrimonial_profiles
        FOR EACH ROW EXECUTE FUNCTION shadiplanner_bump_profile_cache_revision();
      END IF;
    END $$`);
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const migration = await client.query("SELECT name FROM app_migrations WHERE name = 'legacy-profile-import-v1'");
    if (!migration.rowCount) {
      for (const profile of legacyProfiles) await client.query(`${insertSql} ON CONFLICT DO NOTHING`, values(profile));
      await client.query("INSERT INTO app_migrations (name) VALUES ('legacy-profile-import-v1')");
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Explicit profile columns keep the view's column order stable when later migrations
  // add table columns. PostgreSQL rejects CREATE OR REPLACE VIEW if existing columns shift.
  // A convenient read-only view also exposes partner preferences as individual columns.
  const preferences = ['minAge', 'maxAge', 'minHeight', 'maxHeight', 'minIncome', 'maritalStatus', 'religions', 'communities', 'motherTongues', 'educationLevels', 'occupations', 'locations', 'diet', 'manglikPreference'];
  await pool.query(`CREATE OR REPLACE VIEW member_registration_details AS
    SELECT ${columns.map(name => `p.${name}`).join(', ')}, u.id AS account_id, u.email AS login_email, u.role AS account_role, u.created_at AS account_created_at,
      ${preferences.map(key => `p.partner_preferences ->> '${key}' AS partner_${column(key)}`).join(', ')},
      u.phone AS account_phone, u.phone_verified AS account_phone_verified
    FROM auth_users u FULL JOIN matrimonial_profiles p ON p.user_id = u.id`);

  const result = await pool.query(`SELECT ${fields.map(key => `${column(key)} AS "${key}"`).join(', ')} FROM matrimonial_profiles`);
  return result.rows as MatrimonialProfile[];
}
