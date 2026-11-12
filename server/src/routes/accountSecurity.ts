import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { changeAccountEmail, changeAccountPassword, confirmPhoneTest, getAccountSecurity, startPhoneTest } from '../data/accountSecurityDatabase.js';
import { AccountSecurityError } from '../models/accountSecurity.js';
import { db } from '../data/db.js';

const router = Router();
router.use(authenticateToken);
const failure = (res: Response, error: unknown) => {
  if (error instanceof AccountSecurityError) {
    res.status(error.status).json({ message: error.message, ...(error.field ? { fieldErrors: { [error.field]: error.message } } : {}) });
  } else {
    console.error('Account security update failed:', error);
    res.status(500).json({ message: 'We could not complete this update. Please try again.' });
  }
};
router.get('/', async (req: AuthenticatedRequest, res) => {
  try { res.json(await getAccountSecurity(req.user!.id)); }
  catch (error) { failure(res, error); }
});
router.post('/password', async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    await changeAccountPassword(req.user!.id, currentPassword, newPassword, confirmPassword);
    res.json({ message: 'Your password has been changed. Sign in with your new password. All previous sessions have ended.' });
  } catch (error) { failure(res, error); }
});
router.post('/email', async (req: AuthenticatedRequest, res) => {
  try {
    await changeAccountEmail(req.user!.id, req.body?.newEmail, req.body?.confirmEmail, req.body?.currentPassword);
    res.json({ message: 'Your email address has changed. Sign in with your new email. All previous sessions have ended.' });
  } catch (error) { failure(res,error); }
});
router.post('/phone/test-code', async (req: AuthenticatedRequest, res) => {
  try { res.json(await startPhoneTest(req.user!.id, req.body?.phone, req.body?.currentPassword)); }
  catch (error) { failure(res, error); }
});
router.post('/phone/confirm-test', async (req: AuthenticatedRequest, res) => {
  try {
    const phone = await confirmPhoneTest(req.user!.id, req.body?.challengeId, req.body?.code);
    const profile = db.profiles.find(profile => profile.userId === req.user!.id);
    if (profile) {
      profile.phone = phone;
      profile.phoneVerified = false;
      profile.isVerified = false;
      profile.updatedAt = new Date().toISOString();
      db.saveProfileMirror();
    }
    res.json({ phone, phoneVerified: false, testOnly: true, message: 'Test completed. Your number was updated, but remains unverified. No SMS was sent.' });
  } catch (error) { failure(res, error); }
});
export default router;
