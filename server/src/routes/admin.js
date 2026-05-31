import { Router } from 'express';
import Match from '../models/Match.js';
import League, { VALID_ENTRY_FEES } from '../models/League.js';
import ReferralCode from '../models/ReferralCode.js';
import { requireAdmin } from '../middleware/admin.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { scoreMatch } from '../services/scoring.js';
import { syncFixtures } from '../services/footballData.js';
import { KNOCKOUT_STAGES } from '../config/constants.js';

const router = Router();

router.use(requireAdmin);
router.use(adminLimiter);

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
    if (typeof code !== 'string' || code.length > 50 || !/^[A-Z0-9_-]+$/i.test(code)) {
      return res.status(400).json({ error: 'code must be 1–50 alphanumeric characters' });
    }
    if (!Number.isInteger(Number(maxUses)) || Number(maxUses) < 1 || Number(maxUses) > 10000) {
      return res.status(400).json({ error: 'maxUses must be an integer between 1 and 10000' });
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
    const { name, entryFee = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (name.length > 100) return res.status(400).json({ error: 'League name must be 100 characters or fewer' });
    if (!VALID_ENTRY_FEES.includes(Number(entryFee))) {
      return res.status(400).json({ error: `entryFee must be one of: ${VALID_ENTRY_FEES.join(', ')}` });
    }
    const league = await League.create({ name: name.trim(), entryFee: Number(entryFee), referralCodes: [], members: [], paidMembers: [] });
    res.status(201).json({ league: { id: league._id, name: league.name, entryFee: league.entryFee, memberCount: 0, referralCodes: [] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// List all leagues with member counts and paid status
router.get('/leagues', async (req, res) => {
  try {
    const leagues = await League.find()
      .populate('referralCodes', 'code maxUses usedCount')
      .populate('members', 'name')
      .lean();

    const result = leagues.map((l) => {
      const paidSet = new Set((l.paidMembers ?? []).map((id) => id.toString()));
      const members = (l.members ?? []).map((m) => ({
        id: m._id.toString(),
        name: m.name,
        paid: paidSet.has(m._id.toString()),
      }));
      return {
        id: l._id,
        name: l.name,
        entryFee: l.entryFee ?? 0,
        memberCount: members.length,
        paidMemberCount: paidSet.size,
        members,
        referralCodes: l.referralCodes,
        createdAt: l.createdAt,
      };
    });

    res.json({ leagues: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// Toggle a member's paid status within a league
router.patch('/leagues/:id/members/:userId/paid', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { paid } = req.body;
    if (typeof paid !== 'boolean') {
      return res.status(400).json({ error: 'paid must be a boolean' });
    }

    const league = await League.findById(id);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const isMember = league.members.some((m) => m.toString() === userId);
    if (!isMember) return res.status(404).json({ error: 'Member not found in this league' });

    const update = paid
      ? { $addToSet: { paidMembers: userId } }
      : { $pull: { paidMembers: userId } };

    await League.findByIdAndUpdate(id, update);
    res.json({ message: `Member marked as ${paid ? 'paid' : 'unpaid'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Bulk-sync all WC fixtures from football-data.org (single API call)
router.post('/fixtures/sync', async (req, res) => {
  try {
    const result = await syncFixtures();
    console.log(`[admin sync] created: ${result.created}, updated: ${result.updated}`);
    res.json({ message: 'Sync complete', ...result });
  } catch (err) {
    console.error('[admin sync] Failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;
