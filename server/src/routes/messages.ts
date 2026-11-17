import { presentProfile, profilesConnected } from '../models/profilePresentation.js';
import { randomUUID } from 'node:crypto';
import { profileSnapshot, requestProfiles } from '../middleware/profileSnapshot.js';
import { Router, Response } from 'express';
import { db } from '../data/db.js';
import { pool } from '../data/postgres.js';
import { loadProfiles } from '../data/profileDatabase.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { ChatMessage } from '../models/types.js';
import {
  AdminMessagingError,
  administratorConversations,
  memberAdministratorConversations,
  readAdministratorThread,
  replyToAdministrator,
  sendAdministratorMessage,
} from '../data/adminMessagingDatabase.js';
import {
  getMemberThread,
  sendMemberMessage,
  getMemberConversationsMap,
} from '../data/memberMessagingDatabase.js';

const router = Router();
router.use(authenticateToken, profileSnapshot);

function administratorOperation(res: Response, operation: () => Promise<unknown>, status = 200): void {
  void operation().then(result => res.status(status).json(result)).catch(error => {
    if (error instanceof AdminMessagingError) { res.status(error.status).json({ message: error.message }); return; }
    console.error('Administrator conversation failed:', error);
    res.status(503).json({ message: 'We could not load or save this conversation. Please try again.' });
  });
}
function sortConversations<T extends { lastMessage: ChatMessage | null }>(items: T[]): T[] {
  return items.sort((a, b) => Date.parse(b.lastMessage?.timestamp || '1970-01-01') - Date.parse(a.lastMessage?.timestamp || '1970-01-01'));
}

// Get conversation summaries
router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (req.user?.role === 'admin') {
    administratorOperation(res, async () => {
      const ownProfile = requestProfiles(req).find(profile => profile.userId === userId);
      return sortConversations([...await administratorConversations(userId!, requestProfiles(req)), ...(ownProfile ? await memberAdministratorConversations(ownProfile.id) : [])]);
    });
    return;
  }
  const userProfile = requestProfiles(req).find((p) => p.userId === userId);

  if (!userProfile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  // Find all profile IDs that this user has exchanged messages with OR has accepted interest connection with
  const partnerIds = new Set<string>();

  // Fetch conversations from PostgreSQL
  const pgConversationsMap = await getMemberConversationsMap(userProfile.id);
  for (const partnerId of pgConversationsMap.keys()) {
    partnerIds.add(partnerId);
  }

  db.messages.forEach((m) => {
    if (m.senderId === userProfile.id) partnerIds.add(m.receiverId);
    if (m.receiverId === userProfile.id) partnerIds.add(m.senderId);
  });

  // Also include accepted interest connections so they can start chatting right away!
  db.interests.forEach((i) => {
    if (i.status === 'accepted') {
      if (i.senderProfileId === userProfile.id) partnerIds.add(i.receiverProfileId);
      if (i.receiverProfileId === userProfile.id) partnerIds.add(i.senderProfileId);
    }
  });

  const conversations = Array.from(partnerIds).map((partnerId) => {
    const partner = requestProfiles(req).find((p) => p.id === partnerId && p.isVerified);
    const pgData = pgConversationsMap.get(partnerId);

    let lastMessage = pgData ? pgData.lastMessage : null;
    let unreadCount = pgData ? pgData.unreadCount : 0;

    if (!lastMessage) {
      const thread = db.messages.filter(
        (m) =>
          (m.senderId === userProfile.id && m.receiverId === partnerId) ||
          (m.senderId === partnerId && m.receiverId === userProfile.id)
      );

      thread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;
      unreadCount = thread.filter((m) => m.receiverId === userProfile.id && !m.isRead).length;
    }

    return {
      partnerId,
      partner: partner && profilesConnected(userProfile, partner, db.interests) ? presentProfile(partner, req.user, requestProfiles(req), db.interests) : undefined,
      lastMessage,
      unreadCount,
    };
  }).filter(c => Boolean(c.partner));

  // Sort by latest message timestamp
  conversations.sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  administratorOperation(res, async () => sortConversations([...conversations, ...await memberAdministratorConversations(userProfile.id)]));
});

// Get messages for a specific conversation
router.get('/:partnerProfileId', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { partnerProfileId } = req.params;
  const userProfile = requestProfiles(req).find((p) => p.userId === userId);
  if (partnerProfileId.startsWith('admin:')) {
    if (!userProfile) { res.status(404).json({ message: 'Profile not found' }); return; }
    administratorOperation(res, () => readAdministratorThread(userId!, false, partnerProfileId.slice(6), userProfile.id));
    return;
  }
  if (req.user?.role === 'admin') {
    administratorOperation(res, () => readAdministratorThread(userId!, true, userId!, partnerProfileId));
    return;
  }

  if (!userProfile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  let partner = requestProfiles(req).find((p) => p.id === partnerProfileId);
  if (!partner) {
    const all = await loadProfiles();
    partner = all.find((p) => p.id === partnerProfileId && p.isVerified);
  }

  if (!partner) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  if (!userProfile.isVerified || !partner.isVerified) {
    res.status(403).json({ message: 'Both profiles must be approved before messaging' });
    return;
  }

  const isConnected = profilesConnected(userProfile, partner, db.interests);
  const hasHistory = await pool.query(
    'SELECT 1 FROM member_messages WHERE (sender_profile_id = $1 AND receiver_profile_id = $2) OR (sender_profile_id = $2 AND receiver_profile_id = $1) LIMIT 1',
    [userProfile.id, partnerProfileId]
  ).then(r => (r.rowCount || 0) > 0).catch(() => false) || db.messages.some(m => (m.senderId === userProfile.id && m.receiverId === partnerProfileId) || (m.senderId === partnerProfileId && m.receiverId === userProfile.id));

  if (!isConnected && !hasHistory) {
    res.status(403).json({ message: 'Accept a connection request before messaging.' });
    return;
  }

  try {
    const thread = await getMemberThread(userProfile.id, partnerProfileId);
    res.json(thread);
    return;
  } catch (err) {
    console.warn('Could not read PostgreSQL thread; using local mirror:', (err as Error)?.message);
  }

  const thread = db.messages.filter(
    (m) =>
      (m.senderId === userProfile.id && m.receiverId === partnerProfileId) ||
      (m.senderId === partnerProfileId && m.receiverId === userProfile.id)
  );

  // Mark received messages as read
  thread.forEach((m) => {
    if (m.receiverId === userProfile.id) {
      m.isRead = true;
    }
  });
  db.save();

  thread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  res.json(thread);
});

// Send message
router.post('/:partnerProfileId', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { partnerProfileId } = req.params;
  const { content } = req.body || {};

  if (typeof content !== 'string' || !content.trim() || content.length > 4000) {
    res.status(400).json({ message: 'Message content is required' });
    return;
  }

  const userProfile = requestProfiles(req).find((p) => p.userId === userId);
  if (partnerProfileId.startsWith('admin:')) {
    if (!userProfile) { res.status(404).json({ message: 'Profile not found' }); return; }
    administratorOperation(res, () => replyToAdministrator(userId!, userProfile.id, partnerProfileId.slice(6), content), 201);
    return;
  }
  if (req.user?.role === 'admin') {
    administratorOperation(res, () => sendAdministratorMessage(userId!, partnerProfileId, content), 201);
    return;
  }

  let partnerProfile = requestProfiles(req).find((p) => p.id === partnerProfileId && p.isVerified);
  if (!partnerProfile) {
    const all = await loadProfiles();
    partnerProfile = all.find((p) => p.id === partnerProfileId && p.isVerified);
  }

  if (!userProfile) {
    res.status(404).json({ message: 'Sender profile not found' });
    return;
  }
  if (!partnerProfile) {
    res.status(404).json({ message: 'Receiver profile not found' });
    return;
  }

  if (!userProfile.isVerified) {
    res.status(403).json({ message: 'Your profile must be approved before messaging' });
    return;
  }

  const isConnected = profilesConnected(userProfile, partnerProfile, db.interests);
  const hasHistory = await pool.query(
    'SELECT 1 FROM member_messages WHERE (sender_profile_id = $1 AND receiver_profile_id = $2) OR (sender_profile_id = $2 AND receiver_profile_id = $1) LIMIT 1',
    [userProfile.id, partnerProfileId]
  ).then(r => (r.rowCount || 0) > 0).catch(() => false) || db.messages.some(m => (m.senderId === userProfile.id && m.receiverId === partnerProfileId) || (m.senderId === partnerProfileId && m.receiverId === userProfile.id));

  if (!isConnected && !hasHistory) {
    res.status(403).json({ message: 'Accept a connection request before messaging.' });
    return;
  }

  let newMsg: ChatMessage;
  try {
    newMsg = await sendMemberMessage(userProfile.id, partnerProfileId, content);
  } catch (err) {
    console.warn('Could not persist message to PostgreSQL; using local mirror:', (err as Error)?.message);
    newMsg = {
      id: randomUUID(),
      senderId: userProfile.id,
      receiverId: partnerProfileId,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      isRead: false,
    };
  }

  // Mirror to in-memory store
  if (!db.messages.some(m => m.id === newMsg.id)) {
    db.messages.push(newMsg);
    db.save();
  }

  res.status(201).json(newMsg);
});

export default router;
