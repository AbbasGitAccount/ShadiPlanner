import { pool } from './postgres.js';
import { ChatMessage, MatrimonialProfile } from '../models/types.js';
import { randomUUID } from 'node:crypto';

export class AdminMessagingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function initializeAdminMessagingDatabase(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_profile_messages (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES matrimonial_profiles(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'member')),
    content TEXT NOT NULL CHECK (LENGTH(BTRIM(content)) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    read_at TIMESTAMPTZ
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS admin_profile_messages_thread ON admin_profile_messages (admin_user_id, profile_id, created_at, id)');
  await pool.query('CREATE INDEX IF NOT EXISTS admin_profile_messages_member ON admin_profile_messages (profile_id, admin_user_id, created_at)');
}

interface MessageRow {
  id: string; admin_user_id: string; profile_id: string; sender_type: 'admin' | 'member';
  content: string; created_at: Date; read_at: Date | null; unread_count?: number;
}
function message(row: MessageRow): ChatMessage {
  return { id: row.id, senderId: row.sender_type === 'admin' ? `admin:${row.admin_user_id}` : row.profile_id,
    receiverId: row.sender_type === 'admin' ? row.profile_id : `admin:${row.admin_user_id}`,
    content: row.content, timestamp: new Date(row.created_at).toISOString(), isRead: !!row.read_at };
}
function validateContent(content: unknown): string {
  if (typeof content !== 'string' || !content.trim() || content.length > 4000) throw new AdminMessagingError('Enter a message between 1 and 4,000 characters.');
  return content.trim();
}

export async function sendAdministratorMessage(adminId: string, profileId: string, content: unknown): Promise<ChatMessage> {
  const text = validateContent(content);
  const result = await pool.query(`INSERT INTO admin_profile_messages (id, admin_user_id, profile_id, sender_type, content)
    SELECT $1, u.id, p.id, 'admin', $4 FROM auth_users u CROSS JOIN matrimonial_profiles p
    WHERE u.id = $2 AND u.role = 'admin' AND p.id = $3 AND p.user_id <> u.id RETURNING *`, [randomUUID(), adminId, profileId, text]);
  if (!result.rowCount) throw new AdminMessagingError('This profile is unavailable or administrator access is required.', 403);
  return message(result.rows[0]);
}

export async function replyToAdministrator(userId: string, profileId: string, adminId: string, content: unknown): Promise<ChatMessage> {
  const text = validateContent(content);
  const result = await pool.query(`INSERT INTO admin_profile_messages (id, admin_user_id, profile_id, sender_type, content)
    SELECT $1, u.id, p.id, 'member', $5 FROM auth_users u CROSS JOIN matrimonial_profiles p
    WHERE u.id = $2 AND u.role = 'admin' AND p.id = $3 AND p.user_id = $4
      AND EXISTS (SELECT 1 FROM admin_profile_messages m WHERE m.admin_user_id = u.id AND m.profile_id = p.id AND m.sender_type = 'admin')
    RETURNING *`, [randomUUID(), adminId, profileId, userId, text]);
  if (!result.rowCount) throw new AdminMessagingError('You can reply after an administrator has messaged your profile.', 403);
  return message(result.rows[0]);
}

export async function readAdministratorThread(viewerId: string, administrator: boolean, adminId: string, profileId: string): Promise<ChatMessage[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const access = await client.query(`SELECT p.id FROM matrimonial_profiles p JOIN auth_users a ON a.id = $1 AND a.role = 'admin'
      WHERE p.id = $2 AND (($3 = TRUE AND a.id = $4 AND p.user_id <> a.id) OR
        ($3 = FALSE AND p.user_id = $4 AND EXISTS (SELECT 1 FROM admin_profile_messages m WHERE m.admin_user_id = a.id AND m.profile_id = p.id AND m.sender_type = 'admin')))`, [adminId, profileId, administrator, viewerId]);
    if (!access.rowCount) throw new AdminMessagingError('Conversation not found.', 404);
    await client.query('UPDATE admin_profile_messages SET read_at = clock_timestamp() WHERE admin_user_id = $1 AND profile_id = $2 AND sender_type = $3 AND read_at IS NULL', [adminId, profileId, administrator ? 'member' : 'admin']);
    const result = await client.query('SELECT * FROM admin_profile_messages WHERE admin_user_id = $1 AND profile_id = $2 ORDER BY created_at, id', [adminId, profileId]);
    await client.query('COMMIT');
    return result.rows.map(message);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function administratorConversations(adminId: string, profiles: MatrimonialProfile[]) {
  const result = await pool.query(`SELECT DISTINCT ON (profile_id) *,
    (COUNT(*) FILTER (WHERE sender_type = 'member' AND read_at IS NULL) OVER (PARTITION BY profile_id))::INTEGER AS unread_count
    FROM admin_profile_messages WHERE admin_user_id = $1 ORDER BY profile_id, created_at DESC, id DESC`, [adminId]);
  const latest = new Map<string, MessageRow>(result.rows.map(row => [row.profile_id, row]));
  return profiles.filter(profile => profile.userId !== adminId).map(profile => {
    const last = latest.get(profile.id);
    return { partnerId: profile.id, partner: profile, lastMessage: last ? message(last) : null, unreadCount: last?.unread_count ?? 0 };
  });
}

export async function memberAdministratorConversations(profileId: string) {
  const result = await pool.query(`SELECT DISTINCT ON (m.admin_user_id) m.*,
    (COUNT(*) FILTER (WHERE sender_type = 'admin' AND read_at IS NULL) OVER (PARTITION BY admin_user_id))::INTEGER AS unread_count
    FROM admin_profile_messages m JOIN auth_users a ON a.id = m.admin_user_id AND a.role = 'admin'
    WHERE m.profile_id = $1 ORDER BY m.admin_user_id, m.created_at DESC, m.id DESC`, [profileId]);
  return result.rows.map((row: MessageRow) => ({
    partnerId: `admin:${row.admin_user_id}`,
    partner: { id: `admin:${row.admin_user_id}`, fullName: 'ShadiPlanner Administrator', profilePhoto: '/avatar-placeholder.svg', isAdministrator: true, profession: 'Profile support' },
    lastMessage: message(row), unreadCount: row.unread_count ?? 0,
  }));
}
