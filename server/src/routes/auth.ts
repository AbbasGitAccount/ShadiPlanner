import { loginLimit } from '../middleware/loginLimit.js';
import { pool } from '../data/postgres.js';
import { loadProfiles } from '../data/profileDatabase.js';
import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../data/db.js';
import { createUserWithProfile, findUserByEmail, findUserById } from '../data/authDatabase.js';
import { AuthenticatedRequest, JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import { User, MatrimonialProfile } from '../models/types.js';
import { buildRegistrationProfile, RegistrationValidationError } from '../models/registration.js';

const router = Router();

// Login
router.post('/login', loginLimit, async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user || user.suspended) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    await pool.query("INSERT INTO account_activity(user_id,action) VALUES($1,'login')",[user.id]);
    const profile = (await loadProfiles()).find((p) => p.userId === user.id);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        authVersion: user.authVersion ?? 0,
        profileId: profile?.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      profile: profile || null,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

// Register
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 500) {
      throw new RegistrationValidationError('Enter a complete email address, such as name@example.com.', 'email');
    }
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new RegistrationValidationError('Use at least 6 characters for your password. If it is very long, please shorten it.', 'password');
    }

    const profileDetails = buildRegistrationProfile(req.body);
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      res.status(409).json({ message: 'This email is already registered. Log in or use a different email address.', fieldErrors: { email: 'This email is already registered. Log in or use a different email address.' } });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUserId = randomUUID();
    const newProfileId = randomUUID();

    const newUser: User = {
      id: newUserId,
      email: normalizedEmail,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    const newProfile: MatrimonialProfile = {
      ...profileDetails,
      id: newProfileId,
      userId: newUserId,
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createUserWithProfile(newUser, newProfile);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({ message: 'This email is already registered. Log in or use a different email address.', fieldErrors: { email: 'This email is already registered. Log in or use a different email address.' } });
        return;
      }
      throw error;
    }

    db.profiles.push(newProfile);
    db.saveProfileMirror();

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        authVersion: 0,
        profileId: newProfile.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      profile: newProfile,
    });
  } catch (error) {
    if (error instanceof RegistrationValidationError) {
      res.status(400).json({ message: error.message, ...(error.field ? { fieldErrors: { [error.field]: error.message } } : {}) });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ message: 'We could not complete registration right now. Please try again.' });
  }
});

// Current User Me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const user = userId ? await findUserById(userId) : undefined;
    if (!user || user.suspended) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const profile = (await loadProfiles()).find((p) => p.userId === userId);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      profile: profile || null,
    });
  } catch (error) {
    console.error('Current user lookup error:', error);
    res.status(500).json({ message: 'Internal server error while loading the current user' });
  }
});

export default router;
