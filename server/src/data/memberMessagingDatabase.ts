import { pool } from './postgres.js';
import { ChatMessage } from '../models/types.js';
import { randomUUID } from 'node:crypto';

export interface MemberMessageRow {
  id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  content: string;
  created_at: Date;
  read_at: Date | null;
}

function rowToChatMessage(row: MemberMessageRow): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_profile_id,
    receiverId: row.receiver_profile_id,
    content: row.content,
    timestamp: new Date(row.created_at).toISOString(),
    isRead: Boolean(row.read_at),
  };
}

export async function initializeMemberMessagingDatabase(legacyMessages: ChatMessage[]): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS member_messages (
    id TEXT PRIMARY KEY,
    sender_profile_id TEXT NOT NULL REFERENCES matrimonial_profiles(id) ON DELETE CASCADE,
    receiver_profile_id TEXT NOT NULL REFERENCES matrimonial_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (LENGTH(BTRIM(content)) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    read_at TIMESTAMPTZ
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS member_messages_thread ON member_messages (sender_profile_id, receiver_profile_id, created_at, id)');
  await pool.query('CREATE INDEX IF NOT EXISTS member_messages_receiver ON member_messages (receiver_profile_id, read_at)');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const migration = await client.query("SELECT name FROM app_migrations WHERE name = 'member-messages-v1'");
    if (!migration.rowCount) {
      for (const m of legacyMessages) {
        if (!m.id || !m.senderId || !m.receiverId || !m.content) continue;
        const createdAt = m.timestamp ? new Date(m.timestamp) : new Date();
        const readAt = m.isRead ? createdAt : null;
        await client.query(
          `INSERT INTO member_messages (id, sender_profile_id, receiver_profile_id, content, created_at, read_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [m.id, m.senderId, m.receiverId, m.content, createdAt, readAt]
        );
      }
      await client.query("INSERT INTO app_migrations (name) VALUES ('member-messages-v1')");
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not migrate legacy member messages to PostgreSQL:', error);
  } finally {
    client.release();
  }
}

export async function getMemberThread(viewerProfileId: string, partnerProfileId: string): Promise<ChatMessage[]> {
  try {
    await pool.query(
      `UPDATE member_messages
       SET read_at = clock_timestamp()
       WHERE receiver_profile_id = $1 AND sender_profile_id = $2 AND read_at IS NULL`,
      [viewerProfileId, partnerProfileId]
    );

    const result = await pool.query<MemberMessageRow>(
      `SELECT * FROM member_messages
       WHERE (sender_profile_id = $1 AND receiver_profile_id = $2)
          OR (sender_profile_id = $2 AND receiver_profile_id = $1)
       ORDER BY created_at ASC, id ASC`,
      [viewerProfileId, partnerProfileId]
    );

    return result.rows.map(rowToChatMessage);
  } catch (err) {
    console.error('getMemberThread query failed:', err);
    throw err;
  }
}

export async function sendMemberMessage(
  senderProfileId: string,
  receiverProfileId: string,
  content: string
): Promise<ChatMessage> {
  const text = content.trim();
  const id = randomUUID();
  const result = await pool.query<MemberMessageRow>(
    `INSERT INTO member_messages (id, sender_profile_id, receiver_profile_id, content, created_at)
     VALUES ($1, $2, $3, $4, clock_timestamp())
     RETURNING *`,
    [id, senderProfileId, receiverProfileId, text]
  );

  return rowToChatMessage(result.rows[0]);
}

export async function getMemberConversationsMap(profileId: string): Promise<Map<string, { lastMessage: ChatMessage; unreadCount: number }>> {
  const map = new Map<string, { lastMessage: ChatMessage; unreadCount: number }>();
  try {
    const result = await pool.query<MemberMessageRow & { partner_id: string; unread_count: number }>(
      `WITH thread_messages AS (
         SELECT *,
           CASE WHEN sender_profile_id = $1 THEN receiver_profile_id ELSE sender_profile_id END AS partner_id
         FROM member_messages
         WHERE sender_profile_id = $1 OR receiver_profile_id = $1
       ),
       latest_messages AS (
         SELECT DISTINCT ON (partner_id) *
         FROM thread_messages
         ORDER BY partner_id, created_at DESC, id DESC
       ),
       unread_counts AS (
         SELECT partner_id, COUNT(*)::INTEGER AS unread_count
         FROM thread_messages
         WHERE receiver_profile_id = $1 AND read_at IS NULL
         GROUP BY partner_id
       )
       SELECT l.*, COALESCE(u.unread_count, 0) AS unread_count
       FROM latest_messages l
       LEFT JOIN unread_counts u ON l.partner_id = u.partner_id`,
      [profileId]
    );

    for (const row of result.rows) {
      map.set(row.partner_id, {
        lastMessage: rowToChatMessage(row),
        unreadCount: row.unread_count || 0,
      });
    }
  } catch (err) {
    console.error('getMemberConversationsMap failed:', err);
  }
  return map;
}
