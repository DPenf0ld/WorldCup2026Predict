import { Router } from 'express';
import Match from '../models/Match.js';
import League from '../models/League.js';
import ReferralCode from '../models/ReferralCode.js';
import { requireAdmin } from '../middleware/admin.js';
import { scoreMatch } from '../services/scoring.js';
import { KNOCKOUT_STAGES } from '../config/constants.js';

const router = Router();

router.use(requireAdmin);

// List all matches (admin view — no user JWT required)
router.get('/matches', async (req, res) => {
  try {
    const { stage } = req.query;
    const filter = stage ? { stage } : {};
    const matches = await Match.find(filter).sort({ kickoffTime: 1 }).lean();
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Enter result for a match and trigger scoring
router.post('/matches/:id/result', async (req, res) => {
  try {
    const { homeScore, awayScore, penaltyWinner } = req.body;

    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: 'homeScore and awayScore are required' });
    }
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      return res.status(400).json({ error: 'Scores must be non-negative integers' });
    }

    const existing = await Match.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Match not found' });

    if (KNOCKOUT_STAGES.has(existing.stage) && homeScore === awayScore) {
      if (!penaltyWinner || !['home', 'away'].includes(penaltyWinner)) {
        return res.status(400).json({
          error: 'penaltyWinner ("home" or "away") is required when scores are level in a knockout match',
        });
      }
    }

    const updateFields = { homeScore, awayScore, resultEntered: true };
    if (penaltyWinner && ['home', 'away'].includes(penaltyWinner)) {
      updateFields.penaltyWinner = penaltyWinner;
    } else {
      updateFields.penaltyWinner = null;
    }

    const match = await Match.findByIdAndUpdate(req.params.id, updateFields, { new: true });

    await scoreMatch(match._id);

    res.json({ message: 'Result entered and predictions scored', match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enter result' });
  }
});

// Create a referral code linked to a league
router.post('/referral-codes', async (req, res) => {
  try {
    const { code, leagueId, maxUses } = req.body;

    if (!code || !leagueId || !maxUses) {
      return res.status(400).json({ error: 'code, leagueId, and maxUses are required' });
    }

    const league = await League.findById(leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const referralCode = await ReferralCode.create({ code, leagueId, maxUses });
    league.referralCodes.push(referralCode._id);
    await league.save();

    res.status(201).json({ referralCode });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Referral code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create referral code' });
  }
});

// Create a new league
router.post('/leagues', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const league = await League.create({ name: name.trim(), referralCodes: [], members: [] });
    res.status(201).json({ league: { id: league._id, name: league.name, memberCount: 0, referralCodes: [] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// List all leagues with member counts
router.get('/leagues', async (req, res) => {
  try {
    const leagues = await League.find()
      .populate('referralCodes', 'code maxUses usedCount')
      .lean();

    const result = leagues.map((l) => ({
      id: l._id,
      name: l.name,
      memberCount: l.members.length,
      referralCodes: l.referralCodes,
      createdAt: l.createdAt,
    }));

    res.json({ leagues: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// Stub: sync results from football-data.org
// To activate, set API_FOOTBALL_KEY in .env and uncomment the fetch logic below.
router.post('/sync-results', async (req, res) => {
  /*
  const BASE = 'https://api.football-data.org/v4';
  const headers = { 'X-Auth-Token': process.env.API_FOOTBALL_KEY };

  // FIFA World Cup 2026 competition ID — verify at football-data.org/v4/competitions
  const COMPETITION_ID = 2000;

  const r = await fetch(`${BASE}/competitions/${COMPETITION_ID}/matches?status=FINISHED`, { headers });
  const data = await r.json();

  for (const fixtureData of data.matches) {
    const { id, score, homeTeam, awayTeam } = fixtureData;
    const homeScore = score.fullTime.home;
    const awayScore = score.fullTime.away;
    if (homeScore === null || awayScore === null) continue;

    // Match on team names — you may want to store an externalId on Match instead
    const match = await Match.findOne({
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      resultEntered: false,
    });
    if (!match) continue;

    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.resultEntered = true;
    await match.save();
    await scoreMatch(match._id);
  }
  */

  res.json({ message: 'Sync stub — uncomment fetch logic in admin.js to activate' });
});

export default router;
