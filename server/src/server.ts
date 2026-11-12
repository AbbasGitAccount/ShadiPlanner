import adminRoutes from './routes/admin.js';
import matchConsentRoutes from './routes/matchConsent.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import accountSecurityRoutes from './routes/accountSecurity.js';
import profileRoutes from './routes/profiles.js';
import interactionRoutes from './routes/interactions.js';
import messageRoutes from './routes/messages.js';
import weddingRoutes from './routes/wedding.js';
import subscriptionRoutes from './routes/subscriptions.js';
import { initializeAuthDatabase } from './data/authDatabase.js';
import { initializeRedisCache, redisCacheStatus } from './data/redisCache.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Lazy / cached database initialization
let initPromise: Promise<void> | null = null;
export const ensureDatabaseInitialized = (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      await initializeAuthDatabase();
      await initializeRedisCache();
    })().catch((err) => {
      initPromise = null; // allow retry on subsequent requests if transient
      throw err;
    });
  }
  return initPromise;
};

// Health check (responds even if database is still connecting or encountering issues)
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    await ensureDatabaseInitialized();
  } catch (error: any) {
    dbStatus = `error: ${error?.message || 'Database unavailable'}`;
  }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    platform: 'ShadiPlanner Matrimony API',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    cache: redisCacheStatus(),
  });
});

// Ensure database is initialized before any business route handler executes
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  if (req.path === '/api/health') {
    return next();
  }
  try {
    await ensureDatabaseInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/account-security', accountSecurityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/match-consent', matchConsentRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/wedding', weddingRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Error handling middleware
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (error as { status?: number })?.status;
  if (status === 400 || status === 413) {
    res.status(status).json({ message: status === 413 ? 'This upload is too large. Please choose a smaller file.' : 'Please check the information you submitted.' });
    return;
  }
  console.error('Unhandled request error:', error);
  const errorMessage = (error as Error)?.message || '';
  if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('ENOTFOUND')) {
    res.status(503).json({
      message: 'Database connection failed. Please ensure DATABASE_URL is configured properly in environment variables.',
      detail: errorMessage,
    });
    return;
  }
  res.status(500).json({ message: 'We could not complete your request. Please try again.' });
});

// Start HTTP server only in standalone mode (not in Vercel / serverless environment)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (!isServerless) {
  ensureDatabaseInitialized()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(`🚀 ShadiPlanner Server running on port ${PORT}`);
        console.log(`👉 http://localhost:${PORT}/api/health`);
        console.log(`=========================================`);
      });
    })
    .catch((error: unknown) => {
      console.error('Could not initialize PostgreSQL authentication database:', error);
      process.exitCode = 1;
    });
}

export default app;
export { app };
