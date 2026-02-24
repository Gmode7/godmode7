import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';

import {
  authMiddleware,
  globalRateLimiter,
  planBasedLimiter,
  errorHandler,
} from './middlewares/index.js';
import adminRoutes from './routes/admin.js';
import intakeRoutes from './routes/intake.js';
import pmRoutes from './routes/pm.js';
import techRoutes from './routes/tech.js';
import engRoutes from './routes/eng.js';
import qaRoutes from './routes/qa.js';
import securityRoutes from './routes/security.js';
import docsRoutes from './routes/docs.js';
import pipelineRoutes from './routes/pipeline.js';
import projectRoutes from './routes/projects.js';
import jobRoutes from './routes/jobs.js';
import gateRoutes from './routes/gates.js';
import artifactRoutes from './routes/artifacts.js';
import chatRoutes from './routes/chat.js';

// ═══════════════════════════════════════════════════════
// 0. Global Error Handlers
// ═══════════════════════════════════════════════════════

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════
// 1. Global Security Middleware
// ═══════════════════════════════════════════════════════

app.use(helmet());

// Hardcoded CORS for Vercel + Replit
const corsOrigins = ['https://gm-7.vercel.app', 'http://localhost:5000', 'http://localhost:5173'];
const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
corsOrigins.push(...envOrigins);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsOrigins.length === 0 && !isProduction) return cb(null, true);
    return corsOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked: ' + origin), false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ═══════════════════════════════════════════════════════
// 2. Health Check (no auth) — with DB connectivity
// ═══════════════════════════════════════════════════════

app.get('/health', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', version: '1.3.0', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', version: '1.3.0', time: new Date().toISOString() });
  }
});

// ═══════════════════════════════════════════════════════
// 3. API v1 — Auth + Rate Limiting Pipeline
// ═══════════════════════════════════════════════════════

app.use('/api/v1', globalRateLimiter);
app.use('/api/v1', authMiddleware);
app.use('/api/v1', planBasedLimiter('global'));

// ═══════════════════════════════════════════════════════
// 4. Route Mounts
// ═══════════════════════════════════════════════════════

app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', intakeRoutes);
app.use('/api/v1', pmRoutes);
app.use('/api/v1', techRoutes);
app.use('/api/v1', engRoutes);
app.use('/api/v1', qaRoutes);
app.use('/api/v1', securityRoutes);
app.use('/api/v1', docsRoutes);
app.use('/api/v1', pipelineRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/gates', gateRoutes);
app.use('/api/v1/artifacts', artifactRoutes);
app.use('/api/v1/chat', chatRoutes);

// ═══════════════════════════════════════════════════════
// 5. Serve frontend in production
// ═══════════════════════════════════════════════════════

const webDist = path.join(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ═══════════════════════════════════════════════════════
// 6. Error handler (must be last)
// ═══════════════════════════════════════════════════════

app.use(errorHandler);

// ═══════════════════════════════════════════════════════
// 7. Start with graceful shutdown
// ═══════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  console.log('API Server: http://0.0.0.0:' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
  if (!process.env.NODE_ENV) {
    console.warn('WARNING: NODE_ENV is not set. Defaulting to development. Set NODE_ENV=production in production.');
  }
  console.log('CORS origins: ' + (corsOrigins.length > 0 ? corsOrigins.join(', ') : 'all (dev)'));
});

function shutdown(signal: string) {
  console.log('\n' + signal + ' received. Shutting down gracefully...');
  server.close(() => {
    Promise.all([prisma.$disconnect(), disconnectRedis()]).then(() => {
      console.log('Server shut down.');
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
