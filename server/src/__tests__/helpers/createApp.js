import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../routes/auth.js';
import matchRoutes from '../../routes/matches.js';
import predictionRoutes from '../../routes/predictions.js';
import leaderboardRoutes from '../../routes/leaderboard.js';
import adminRoutes from '../../routes/admin.js';
import leagueRoutes from '../../routes/leagues.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/predictions', predictionRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/leagues', leagueRoutes);
  return app;
}
