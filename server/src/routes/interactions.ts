import { presentProfile, profilesConnected } from '../models/profilePresentation.js';
import { randomUUID } from 'node:crypto';
import { profileSnapshot, requestProfiles } from '../middleware/profileSnapshot.js';
import { Router, Response } from 'express';
import { db } from '../data/db.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { InterestRequest, ShortlistRecord } from '../models/types.js';
import { respondStoredInterest, sendLimitedInterest, membership } from '../data/subscriptionDatabase.js';
import { SubscriptionError } from '../models/subscriptions.js';

const router = Router();
router.use(authenticateToken, profileSnapshot);

// Send Interest / Connect Request
router.post('/interest/:targetProfileId', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetProfileId } = req.params;
  const { message } = req.body || {};
  if (message !== undefined && (typeof message !== 'string' || message.length > 1000)) {
    res.status(400).json({ message: 'Please use a message of up to 1,000 characters.' }); return;
  }

  const senderProfile = requestProfiles(req).find((p) => p.userId === userId);
  const targetProfile = requestProfiles(req).find((p) => p.id === targetProfileId && p.isVerified);

  if (!senderProfile) {
    res.status(404).json({ message: 'Sender profile not found' });
    return;
  }
  if (!targetProfile) {
    res.status(404).json({ message: 'Target profile not found' });
    return;
  }
  if (senderProfile.id === targetProfile.id) {
    res.status(400).json({ message: 'Cannot send interest to yourself' });
    return;
  }

  if (!senderProfile.isVerified) {
    res.status(403).json({ message: 'Your profile must be approved before sending interests' });
    return;
  }

  // Check if already sent
  const existing = db.interests.find(
    (i) =>
      (i.senderProfileId === senderProfile.id && i.receiverProfileId === targetProfile.id) ||
      (i.senderProfileId === targetProfile.id && i.receiverProfileId === senderProfile.id)
  );

  if (existing) {
    res.status(400).json({
      message: 'An interest request already exists between these profiles',
      interest: existing,
    });
    return;
  }

  const defaultGreeting = `Hello ${targetProfile.fullName}, I reviewed your profile and felt a genuine connection. Let us connect!`;
  const standardGreetings = [
    defaultGreeting,
    `Namaste ${targetProfile.fullName}, I went through your profile on ShadiPlanner and found our values and preferences aligned. I would be honored to connect and take conversations forward.`,
    `Namaste! I admired your education and background. Would love to introduce myself and connect.`,
    `Hello! Our family backgrounds and life outlook seem deeply compatible. Looking forward to speaking!`,
    `Hi! We share a passion for similar goals and culture. Let us connect and start a conversation.`,
  ];

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const isCustomPersonalMessage = Boolean(trimmedMessage && !standardGreetings.includes(trimmedMessage));
  let finalMessage = trimmedMessage || defaultGreeting;

  if (isCustomPersonalMessage) {
    try {
      const userMembership = await membership(userId!);
      const hasPaidPlan = req.user?.role === 'admin' || (userMembership.status === 'active' && userMembership.plan.id !== 'free');
      if (!hasPaidPlan) {
        res.status(403).json({
          message: 'Sending custom communication or personal messages requires a paid membership plan. You can express standard interest or upgrade your plan.',
          code: 'PLAN_REQUIRED',
          upgradeUrl: '/subscriptions'
        });
        return;
      }
    } catch (err) {
      console.error('Membership check error during interest message:', err);
    }
  }

  const newInterest: InterestRequest = {
    id: randomUUID(),
    senderProfileId: senderProfile.id,
    receiverProfileId: targetProfile.id,
    status: 'pending',
    sentAt: new Date().toISOString(),
    message: finalMessage,
  };

  try {
    await sendLimitedInterest(userId!, newInterest);
  } catch (error) {
    res.status(error instanceof SubscriptionError ? error.status : 503).json({ message: error instanceof SubscriptionError ? error.message : 'Could not send your interest. Please try again.' }); return;
  }
  db.interests.push(newInterest);
  // The PostgreSQL record is durable even if the optional legacy mirror fails.

  res.status(201).json({
    message: 'Interest request sent successfully',
    interest: newInterest,
  });
});

// Respond to interest (Accept / Decline)
router.put('/interest/:interestId/respond', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { interestId } = req.params;
  const { action } = req.body; // 'accepted' or 'declined'

  if (!['accepted', 'declined'].includes(action)) {
    res.status(400).json({ message: 'Action must be "accepted" or "declined"' });
    return;
  }

  const userProfile = requestProfiles(req).find((p) => p.userId === userId);
  if (!userProfile) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  const interest = db.interests.find((i) => i.id === interestId);
  if (!interest) {
    res.status(404).json({ message: 'Interest request not found' });
    return;
  }

  if (interest.receiverProfileId !== userProfile.id) {
    res.status(403).json({ message: 'You are not authorized to respond to this request' });
    return;
  }

  if (!userProfile.isVerified || !requestProfiles(req).some((p) => p.id === interest.senderProfileId && p.isVerified)) {
    res.status(403).json({ message: 'Both profiles must be approved before connecting' });
    return;
  }

  if (interest.status !== 'pending') { res.status(409).json({ message: 'This request has already been answered.' }); return; }
  try { Object.assign(interest, await respondStoredInterest(interestId, userProfile.id, action)); }
  catch (error) { res.status(error instanceof SubscriptionError ? error.status : 503).json({ message: error instanceof SubscriptionError ? error.message : 'Could not respond right now. Please try again.' }); return; }

  // If accepted, generate a welcome greeting in chat
  if (action === 'accepted') {
    const welcomeMsg = {
      id: randomUUID(),
      senderId: userProfile.id,
      receiverId: interest.senderProfileId,
      content: `Hello! I have accepted your connection request. Looking forward to knowing each other better.`,
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    db.messages.push(welcomeMsg);
    db.save();
  }

  res.json({
    message: `Request ${action} successfully`,
    interest,
  });
});

// List all interests for logged-in user (Received, Sent, Connected)
router.get('/interests', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userProfile = requestProfiles(req).find((p) => p.userId === userId);

  if (!userProfile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const received = db.interests
    .filter((i) => i.receiverProfileId === userProfile.id)
    .map((item) => {
      const sender = requestProfiles(req).find((p) => p.id === item.senderProfileId && p.isVerified);
      return { ...item, sender: sender && presentProfile(sender, req.user, requestProfiles(req), db.interests) };
    });

  const sent = db.interests
    .filter((i) => i.senderProfileId === userProfile.id)
    .map((item) => {
      const receiver = requestProfiles(req).find((p) => p.id === item.receiverProfileId && p.isVerified);
      return { ...item, receiver: receiver && presentProfile(receiver, req.user, requestProfiles(req), db.interests) };
    });

  const connected = db.interests
    .filter((i) => (i.senderProfileId === userProfile.id || i.receiverProfileId === userProfile.id) && i.status === 'accepted')
    .map((item) => {
      const otherProfileId = item.senderProfileId === userProfile.id ? item.receiverProfileId : item.senderProfileId;
      const matchedProfile = requestProfiles(req).find((p) => p.id === otherProfileId && p.isVerified);
      return { ...item, matchedProfile: matchedProfile && presentProfile(matchedProfile, req.user, requestProfiles(req), db.interests) };
    });

  res.json({
    received: received.filter((item) => item.sender),
    sent: sent.filter((item) => item.receiver),
    connected: connected.filter((item) => item.matchedProfile),
  });
});

// Toggle shortlist / favorite
router.post('/shortlist/:targetProfileId', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetProfileId } = req.params;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!requestProfiles(req).some((p) => p.id === targetProfileId && p.isVerified)) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const existingIndex = db.shortlists.findIndex(
    (s) => s.userId === userId && s.profileId === targetProfileId
  );

  if (existingIndex > -1) {
    db.shortlists.splice(existingIndex, 1);
    db.save();
    res.json({ shortlisted: false, message: 'Removed from shortlist' });
  } else {
    const newShortlist: ShortlistRecord = {
      id: randomUUID(),
      userId,
      profileId: targetProfileId,
      savedAt: new Date().toISOString(),
    };
    db.shortlists.push(newShortlist);
    db.save();
    res.json({ shortlisted: true, message: 'Added to shortlist' });
  }
});

// Get all shortlisted profiles
router.get('/shortlists', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const records = db.shortlists.filter((s) => s.userId === userId);
  const profiles = records
    .map((r) => requestProfiles(req).find((p) => p.id === r.profileId && p.isVerified))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
    .map(profile => presentProfile(profile, req.user, requestProfiles(req), db.interests));

  res.json(profiles);
});

// Who viewed my profile
router.get('/views', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userProfile = requestProfiles(req).find((p) => p.userId === userId);

  if (!userProfile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const viewRecords = db.views.filter((v) => v.viewedProfileId === userProfile.id);
  const viewers = viewRecords
    .map((v) => {
      const viewer = requestProfiles(req).find((p) => p.id === v.viewerProfileId && p.isVerified);
      return {
        ...v,
        viewer: viewer && presentProfile(viewer, req.user, requestProfiles(req), db.interests),
      };
    })
    .filter((item) => Boolean(item.viewer))
    .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());

  res.json(viewers);
});

export default router;

