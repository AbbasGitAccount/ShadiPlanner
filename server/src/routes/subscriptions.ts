import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { membership, subscriptionPlans } from '../data/subscriptionDatabase.js';
import { checkoutAvailability, createCheckout, verifyCheckout, getOrderDetails } from '../services/subscriptionPayments.js';
import { SubscriptionError } from '../models/subscriptions.js';

const router = Router();
const perform = (res: Response, operation: () => Promise<unknown>) => {
  void operation().then(value => res.json(value)).catch(error => {
    if (error instanceof SubscriptionError) { res.status(error.status).json({ message: error.message }); return; }
    console.error('Subscription operation failed:', error);
    res.status(503).json({ message: 'Subscription information is temporarily unavailable. Please try again.' });
  });
};

router.get('/plans', (_req, res) => perform(res, async () => ({
  plans: (await subscriptionPlans()).filter(p => p.enabled !== false),
  checkout: await checkoutAvailability(),
})));

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => perform(res, () => membership(req.user!.id)));

router.get('/order/:orderId', authenticateToken, (req: AuthenticatedRequest, res) => perform(res, () => {
  return getOrderDetails(req.user!.id, req.params.orderId);
}));

router.post('/checkout', authenticateToken, (req: AuthenticatedRequest, res) => perform(res, async () => {
  if (req.user!.role === 'admin') throw new SubscriptionError('Subscriptions are for member accounts.', 403);
  if (req.body?.planId !== 'gold' && req.body?.planId !== 'platinum') throw new SubscriptionError('Choose Gold or Platinum.', 400);
  return createCheckout(req.user!.id, req.body.planId);
}));

router.post('/verify', authenticateToken, (req: AuthenticatedRequest, res) => perform(res, async () => {
  if (req.user!.role === 'admin') throw new SubscriptionError('Subscriptions are for member accounts.', 403);
  const { orderId, paymentId, signature } = req.body || {};
  if (![orderId, paymentId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 200)) {
    throw new SubscriptionError('Valid order and payment references are required.', 400);
  }
  return verifyCheckout(req.user!.id, orderId, paymentId, signature);
}));

export default router;
