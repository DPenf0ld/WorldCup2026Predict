import 'dotenv/config';

console.log('[startup] SendGrid key loaded:', !!process.env.SENDGRID_API_KEY);
console.log('[startup] Football-data key loaded:', !!process.env.API_FOOTBALL_KEY);

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cron from 'node-cron';

import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';
import predictionRoutes from './routes/predictions.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';
import leagueRoutes from './routes/leagues.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { syncFixtures } from './services/footballData.js';
import Match from './models/Match.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
if (!process.env.CLIENT_URL) {
  console.error('FATAL: CLIENT_URL env var is not set');
  process.exit(1);
}
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(apiLimiter);
app.use(sanitizeBody);

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leagues', leagueRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ── Fixture auto-sync cron ──────────────────────────────────────────────────
// Runs every 5 minutes. Syncs immediately if any match is live; otherwise
// waits 6 hours between syncs to stay within the free-tier request budget.

let syncing = false;
let lastSyncAt = 0;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function runScheduledSync() {
  if (syncing) {
    console.log('[sync] Skipping tick — previous sync still in progress');
    return;
  }

  if (!process.env.API_FOOTBALL_KEY) return; // key not configured — skip silently

  try {
    const liveCount = await Match.countDocuments({ status: { $in: ['IN_PLAY', 'PAUSED'] } });
    const hasLive = liveCount > 0;

    if (!hasLive && Date.now() - lastSyncAt < SIX_HOURS_MS) return;

    syncing = true;
    const label = hasLive ? 'live match in progress' : 'scheduled 6h sync';
    console.log(`[sync] Starting (${label})`);

    const { created, updated } = await syncFixtures();
    lastSyncAt = Date.now();
    console.log(`[sync] Done — created: ${created}, updated: ${updated}`);
  } catch (err) {
    console.error('[sync] Failed:', err.message);
  } finally {
    syncing = false;
  }
}

// ── MongoDB + server startup ─────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`Kickoff server running on port ${port}`));

    // Start cron — every 5 minutes; sync logic controls actual API call frequency
    cron.schedule('*/5 * * * *', runScheduledSync);
    console.log('[sync] Cron scheduled (*/5 * * * *)');
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
