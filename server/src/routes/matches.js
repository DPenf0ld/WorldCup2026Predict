import { Router } from 'express';
import Match from '../models/Match.js';
import Prediction from '../models/Prediction.js';
import { authenticate } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { STAGES } from '../config/constants.js';

const router = Router();

router.get('/', generalLimiter, authenticate, async (req, res) => {
  try {
    const { stage } = req.query;
    const filter = stage && STAGES[stage] ? { stage } : {};

    const matches = await Match.find(filter).sort({ kickoffTime: 1 }).lean();

    const predictions = await Prediction.find({
      userId: req.user.id,
      matchId: { $in: matches.map((m) => m._id) },
    }).lean();

    const predMap = new Map(predictions.map((p) => [p.matchId.toString(), p]));
    const now = new Date();

    const enriched = matches.map((match) => ({
      ...match,
      deadlinePassed: now >= match.predictionDeadline,
      userPrediction: predMap.get(match._id.toString()) ?? null,
    }));

    res.json({ matches: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

export default router;
