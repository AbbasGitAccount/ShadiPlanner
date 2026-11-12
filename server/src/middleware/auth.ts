import { pool } from '../data/postgres.js';
import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../data/authDatabase.js';
import { membership, Membership } from '../data/subscriptionDatabase.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required to start the server');
}

export const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    profileId?: string;
    authVersion?: number;
    membership?: Membership;
  };
}

function decodeToken(token: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || typeof decoded.id !== 'string' || !decoded.id ||
      decoded.authVersion !== undefined && (!Number.isInteger(decoded.authVersion) || decoded.authVersion < 0)) {
    throw new jwt.JsonWebTokenError('Invalid session claims');
  }
  return decoded;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) { res.status(401).json({ message: 'Please sign in to continue.' }); return; }
  let decoded: jwt.JwtPayload;
  try { decoded = decodeToken(token); }
  catch { res.status(401).json({ message: 'Your session has expired. Please sign in again.' }); return; }
  let user;
  try { user = await findUserById(decoded.id); }
  catch { res.status(503).json({ message: 'Sign-in is temporarily unavailable. Please try again shortly.' }); return; }
  if (!user || user.suspended || (decoded.authVersion ?? 0) !== (user.authVersion ?? 0)) {
    res.status(401).json({ message: 'Your session has ended. Please sign in again.' }); return;
  }
  req.user = { id: user.id, email: user.email, role: user.role, authVersion: user.authVersion, profileId: typeof decoded.profileId === 'string' ? decoded.profileId : undefined };
  try { req.user.membership = await membership(user.id); }
  catch { res.status(503).json({ message: 'Your plan could not be checked. Please try again.' }); return; }
  try { await pool.query("UPDATE auth_users SET last_active_at=NOW() WHERE id=$1 AND (last_active_at IS NULL OR last_active_at<NOW()-INTERVAL '5 minutes')",[user.id]); } catch { res.status(503).json({message:'Account activity could not be saved.'}); return; }
  next();
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) { next(); return; }
  let decoded: jwt.JwtPayload;
  try { decoded = decodeToken(token); } catch { next(); return; }
  try {
    const user = await findUserById(decoded.id);
    if (user && !user.suspended && (decoded.authVersion ?? 0) === (user.authVersion ?? 0)) {
      req.user = { id: user.id, email: user.email, role: user.role, authVersion: user.authVersion, profileId: typeof decoded.profileId === 'string' ? decoded.profileId : undefined };
    }
  } catch { res.status(503).json({ message: 'Sign-in is temporarily unavailable. Please try again shortly.' }); return; }
  next();
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // authenticateToken already loaded the current role from PostgreSQL.
  if (req.user?.role !== 'admin') { res.status(403).json({ message: 'Administrator access required' }); return; }
  next();
};
