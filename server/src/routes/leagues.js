import { Router } from 'express';
import User from '../models/User.js';
import League from '../models/League.js';
import ReferralCode from '../models/ReferralCode.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/join', writeLimiter, authenticate, async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'referralCode is required' });

    const code = await ReferralCode.findOne({ code: referralCode.toUpperCase() });
    if (!code) return res.status(400).json({ error: 'Invalid referral code' });
    if (code.usedCount >= code.maxUses) {
      return res.status(400).json({ error: 'This referral code has reached its maximum uses' });
    }

    const user = await User.findById(req.user.id);
    if (user.leagues.some((l) => l.toString() === code.leagueId.toString())) {
      return res.status(409).json({ error: 'You are already a member of this league' });
    }

    code.usedCount += 1;
    await code.save();

    await League.findByIdAndUpdate(code.leagueId, { $addToSet: { members: user._id } });

    user.leagues.push(code.leagueId);
    await user.save();

    const league = await League.findById(code.leagueId).select('name entryFee').lean();

    const updatedUser = await User.findById(user._id)
      .select('-passwordHash')
      .populate('leagues', 'name')
      .lean();

    res.json({ message: `Joined ${league.name}!`, league, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join league' });
  }
});

export default router;
