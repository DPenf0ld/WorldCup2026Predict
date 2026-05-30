import { Router } from 'express';
import mongoose from 'mongoose';
import League from '../models/League.js';
import Prediction from '../models/Prediction.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { leagueId } = req.query;
    if (!leagueId) return res.status(400).json({ error: 'leagueId query param is required' });

    const league = await League.findById(leagueId).populate('members', 'name email');
    if (!league) return res.status(404).json({ error: 'League not found' });

    const isMember = league.members.some((m) => m._id.toString() === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this league' });

    const paidMembersSet = new Set((league.paidMembers ?? []).map((id) => id.toString()));
    const isPaidLeague = (league.entryFee ?? 0) > 0;
    const currentUserPaid = !isPaidLeague || paidMembersSet.has(req.user.id);

    // For paid leagues, only rank members who have paid
    const effectiveMembers = isPaidLeague
      ? league.members.filter((m) => paidMembersSet.has(m._id.toString()))
      : league.members;

    const effectiveMemberIds = effectiveMembers.map((m) => m._id);

    const pointsAgg = await Prediction.aggregate([
      { $match: { userId: { $in: effectiveMemberIds }, pointsAwarded: { $ne: null } } },
      {
        $lookup: {
          from: 'matches',
          localField: 'matchId',
          foreignField: '_id',
          as: 'match',
        },
      },
      { $unwind: '$match' },
      { $match: { 'match.resultEntered': true } },
      {
        $group: {
          _id: '$userId',
          totalPoints: { $sum: '$pointsAwarded' },
          predictionsScored: { $sum: 1 },
        },
      },
    ]);

    const pointsMap = new Map(pointsAgg.map((p) => [p._id.toString(), p]));

    const leaderboard = effectiveMembers
      .map((member) => {
        const stats = pointsMap.get(member._id.toString());
        return {
          userId: member._id,
          name: member.name,
          totalPoints: stats?.totalPoints ?? 0,
          predictionsScored: stats?.predictionsScored ?? 0,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ rank: index + 1, ...entry }));

    // Full member list with paid flag — for the member list visible to all
    const allMembers = league.members.map((m) => ({
      userId: m._id,
      name: m.name,
      paid: !isPaidLeague || paidMembersSet.has(m._id.toString()),
    }));

    res.json({
      league: {
        id: league._id,
        name: league.name,
        entryFee: league.entryFee ?? 0,
        paidMemberCount: league.paidMembers?.length ?? 0,
        totalMemberCount: league.members.length,
      },
      currentUserPaid,
      allMembers,
      leaderboard,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
