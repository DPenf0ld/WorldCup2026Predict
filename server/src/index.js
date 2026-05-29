import 'dotenv/config';

console.log('[startup] SendGrid key loaded:', !!process.env.SENDGRID_API_KEY);

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';
import predictionRoutes from './routes/predictions.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';
import leagueRoutes from './routes/leagues.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeBody } from './middleware/sanitize.js';

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

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`Kickoff server running on port ${port}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
