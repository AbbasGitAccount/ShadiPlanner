import { pool } from '../data/postgres.js';
import { Request, Response, NextFunction } from 'express';
import { MatrimonialProfile } from '../models/types.js';
import { loadProfiles } from '../data/profileDatabase.js';
import { db } from '../data/db.js';
import { storedInterests } from '../data/subscriptionDatabase.js';
import { AuthenticatedRequest } from './auth.js';

const snapshots = new WeakMap<Request, MatrimonialProfile[]>();
export const profileSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [allProfiles, interests, blocked] = await Promise.all([loadProfiles(), storedInterests(), pool.query('SELECT id FROM auth_users WHERE suspended=TRUE')]);
    const blockedIds = new Set(blocked.rows.map(r=>r.id));
    const profiles = allProfiles.filter(p=>!blockedIds.has(p.userId));
    const user = (req as AuthenticatedRequest).user;
    const limit = user?.role === 'admin' ? null : user?.membership?.plan.browseLimit;
    if (limit !== null && limit !== undefined) {
      const own = profiles.find(profile => profile.userId === user?.id);
      const available = profiles.filter(profile => profile.isVerified && profile.id !== own?.id)
        .sort((a, b) => Number(!!b.enhancedVisibility) - Number(!!a.enhancedVisibility) || a.id.localeCompare(b.id));
      const allowed = new Set(available.slice(0, limit).map(profile => profile.id));
      // Existing mutual connections stay accessible when a paid plan expires.
      for (const interest of interests) if (interest.status === 'accepted') {
        if (interest.senderProfileId === own?.id) allowed.add(interest.receiverProfileId);
        if (interest.receiverProfileId === own?.id) allowed.add(interest.senderProfileId);
      }
      if (own) {
        for (const msg of db.messages) {
          if (msg.senderId === own.id) allowed.add(msg.receiverId);
          if (msg.receiverId === own.id) allowed.add(msg.senderId);
        }
        try {
          const msgPartners = await pool.query<{ partner_id: string }>(
            `SELECT DISTINCT CASE WHEN sender_profile_id = $1 THEN receiver_profile_id ELSE sender_profile_id END AS partner_id
             FROM member_messages
             WHERE sender_profile_id = $1 OR receiver_profile_id = $1`,
            [own.id]
          );
          for (const row of msgPartners.rows) {
            allowed.add(row.partner_id);
          }
        } catch {
          // ignore query error
        }
      }
      snapshots.set(req, profiles.filter(profile => profile.userId === user?.id || allowed.has(profile.id)));
    } else snapshots.set(req, profiles);
    db.interests.splice(0, db.interests.length, ...interests);
    next();
  }
  catch (error) {
    console.error('Could not load profile data:', error);
    res.status(503).json({ message: 'We could not load profiles right now. Please try again.' });
  }
};
export const requestProfiles = (req: Request): MatrimonialProfile[] => {
  const profiles = snapshots.get(req);
  if (!profiles) throw new Error('Profile snapshot middleware is required');
  return profiles;
};

// This is only the legacy JSON mirror; requests read PostgreSQL/Redis snapshots.
export const rememberProfile = (profile: MatrimonialProfile): void => {
  const index = db.profiles.findIndex(item => item.id === profile.id);
  if (index < 0) db.profiles.push(profile); else db.profiles[index] = profile;
};
