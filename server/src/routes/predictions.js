import { Router } from 'express';
import Match from '../models/Match.js';
import Prediction from '../models/Prediction.js';
import { authenticate } from '../middleware/auth.js';
import { KNOCKOUT_STAGES } from '../config/constants.js';

const router = Router();

router.post('/', authenticate, async (req, res) => {
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

router.get('/mine', authenticate, async (req, res) => {
  try {
    const predictions = await Prediction.find({ userId: req.user.id })
      .populate('matchId', 'homeTeam awayTeam stage kickoffTime homeScore awayScore penaltyWinner resultEntered')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ predictions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

export default router;
