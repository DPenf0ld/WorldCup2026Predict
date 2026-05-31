import { Router } from 'express';
import Match from '../models/Match.js';
import Prediction from '../models/Prediction.js';
import League from '../models/League.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { generalLimiter, writeLimiter } from '../middleware/rateLimiter.js';
import { KNOCKOUT_STAGES } from '../config/constants.js';

const router = Router();

router.post('/', writeLimiter, authenticate, async (req, res) => {
  try {
    const { matchId, predictedHomeScore, predictedAwayScore, predictedPenaltyWinner } = req.body;

    if (matchId === undefined || predictedHomeScore === undefined || predictedAwayScore === undefined) {
      return res.status(400).json({ error: 'matchId, predictedHomeScore, and predictedAwayScore are required' });
    }

    if (
      !Number.isInteger(predictedHomeScore) ||
      !Number.isInteger(predictedAwayScore) ||
      predictedHomeScore < 0 ||
      predictedAwayScore < 0
    ) {
      return res.status(400).json({ error: 'Scores must be non-negative integers' });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    if (new Date() >= match.predictionDeadline) {
      return res.status(403).json({ error: 'Prediction deadline has passed for this match' });
    }

    const isKnockout = KNOCKOUT_STAGES.has(match.stage);
    const isDraw = predictedHomeScore === predictedAwayScore;

    if (isKnockout && isDraw) {
      if (!predictedPenaltyWinner || !['home', 'away'].includes(predictedPenaltyWinner)) {
        return res.status(400).json({
          error: 'You must pick a penalty winner when predicting a draw in a knockout match',
        });
      }
    }

    const updateFields = {
      predictedHomeScore,
      predictedAwayScore,
      predictedPenaltyWinner: isKnockout && isDraw ? predictedPenaltyWinner : null,
    };

    const prediction = await Prediction.findOneAndUpdate(
      { userId: req.user.id, matchId },
      updateFields,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ prediction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save prediction' });
  }
});

router.get('/mine', generalLimiter, authenticate, async (req, res) => {
  try {
    const predictions = await Prediction.find({ userId: req.user.id })
      .populate('matchId', 'homeTeam awayTeam stage group kickoffTime predictionDeadline homeScore awayScore penaltyWinner resultEntered')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ predictions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// FLAGGED: League.members has no index — League.findOne({ members: { $all: [...] } })
// will full-scan as the league collection grows. Add an index on League.members in
// the League model if this endpoint sees meaningful traffic.
router.get('/user/:userId', generalLimiter, authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    const sharedLeague = await League.findOne({
      members: { $all: [req.user.id, userId] },
    });
    if (!sharedLeague) {
      return res.status(403).json({ error: 'You do not share a league with this user' });
    }

    const targetUser = await User.findById(userId).select('name').lean();
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const predictions = await Prediction.find({ userId })
      .populate({
        path: 'matchId',
        match: { resultEntered: true },
        select: 'homeTeam awayTeam stage kickoffTime homeScore awayScore penaltyWinner resultEntered',
      })
      .sort({ createdAt: -1 })
      .lean();

    const scored = predictions.filter((p) => p.matchId !== null);

    res.json({ user: targetUser, predictions: scored });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user predictions' });
  }
});

export default router;
