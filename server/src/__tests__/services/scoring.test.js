import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { scoreMatch } from '../../services/scoring.js';
import Match from '../../models/Match.js';
import Prediction from '../../models/Prediction.js';

const FUTURE_KICKOFF = new Date('2026-07-15T15:00:00Z');
const PAST_DEADLINE = new Date('2026-07-13T15:00:00Z');

async function makeMatch(overrides = {}) {
  return Match.create({
    homeTeam: 'England',
    awayTeam: 'France',
    stage: 'GROUP',
    kickoffTime: FUTURE_KICKOFF,
    predictionDeadline: PAST_DEADLINE,
    resultEntered: true,
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  });
}

async function makePrediction(matchId, home, away, penaltyWinner = null) {
  return Prediction.create({
    userId: new mongoose.Types.ObjectId(),
    matchId,
    predictedHomeScore: home,
    predictedAwayScore: away,
    predictedPenaltyWinner: penaltyWinner,
  });
}

describe('scoreMatch — group stage', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clearAll);

  it('awards 3 pts for exact score (correct score + total + outcome)', async () => {
    const match = await makeMatch(); // actual 2-1
    const pred = await makePrediction(match._id, 2, 1);

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(3);
    expect(updated.scoredAt).toBeInstanceOf(Date);
  });

  it('awards 2 pts for correct total + correct outcome (wrong score)', async () => {
    const match = await makeMatch(); // actual 2-1, total=3, home wins
    const pred = await makePrediction(match._id, 3, 0); // total=3, home wins

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(2);
  });

  it('awards 1 pt for correct outcome only', async () => {
    const match = await makeMatch(); // actual 2-1, home wins
    const pred = await makePrediction(match._id, 1, 0); // total=1 ≠ 3, home wins

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(1);
  });

  it('awards 1 pt for correct total with wrong outcome', async () => {
    const match = await makeMatch(); // actual 2-1, home wins
    const pred = await makePrediction(match._id, 1, 2); // total=3, away wins

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(1);
  });

  it('awards 0 pts when everything is wrong', async () => {
    const match = await makeMatch(); // actual 2-1
    const pred = await makePrediction(match._id, 0, 1); // total=1, away wins

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(0);
  });

  it('scores multiple predictions for the same match in one call', async () => {
    const match = await makeMatch(); // actual 2-1
    const p1 = await makePrediction(match._id, 2, 1); // 3 pts
    const p2 = await makePrediction(match._id, 3, 0); // 2 pts
    const p3 = await makePrediction(match._id, 0, 2); // 0 pts

    await scoreMatch(match._id);

    const [u1, u2, u3] = await Promise.all([
      Prediction.findById(p1._id),
      Prediction.findById(p2._id),
      Prediction.findById(p3._id),
    ]);
    expect(u1.pointsAwarded).toBe(3);
    expect(u2.pointsAwarded).toBe(2);
    expect(u3.pointsAwarded).toBe(0);
  });
});

describe('scoreMatch — knockout stages (R32 through Final, all use penalty winner)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clearAll);

  it('awards 3 pts for exact draw with correct penalty winner', async () => {
    const match = await makeMatch({
      stage: 'FINAL',
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: 'home',
    });
    const pred = await makePrediction(match._id, 1, 1, 'home');

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(3);
  });

  it('awards 1 pt for exact draw with wrong penalty winner (total only)', async () => {
    const match = await makeMatch({
      stage: 'FINAL',
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: 'home',
    });
    const pred = await makePrediction(match._id, 1, 1, 'away');

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    // Wrong penalty winner → no exact score point (pen winner is part of "exact" in knockout draws)
    // Total (1+1=1+1) → 1 pt; outcome (wrong pen winner) → 0 pts
    expect(updated.pointsAwarded).toBe(1);
  });

  // Canonical example from game rules: predict 2-0, result 1-1 penalties home → 2 pts
  it('awards 2 pts when predicted outright win matches penalty winner (total + outcome)', async () => {
    const match = await makeMatch({
      stage: 'QUARTER_FINAL',
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: 'home',
    });
    const pred = await makePrediction(match._id, 2, 0); // home wins, total=2=1+1

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(2); // correct total (2) + correct outcome (home advances)
  });

  it('awards 1 pt for correct outcome only when total does not match', async () => {
    const match = await makeMatch({
      stage: 'SEMI_FINAL',
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: 'home',
    });
    const pred = await makePrediction(match._id, 1, 0); // home wins, total=1 ≠ 2

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(1);
  });
});

describe('scoreMatch — R32/R16 also use penalty winner', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clearAll);

  it('scores R16 match with a clear 90-min winner normally', async () => {
    const match = await makeMatch({ stage: 'ROUND_OF_16', homeScore: 2, awayScore: 1, penaltyWinner: null });
    const pred = await makePrediction(match._id, 2, 1);

    await scoreMatch(match._id);

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(3);
  });

  it('uses penalty winner for outcome in ROUND_OF_32 draw result', async () => {
    const match = await makeMatch({
      stage: 'ROUND_OF_32',
      homeScore: 1,
      awayScore: 1,
      penaltyWinner: 'home',
    });
    const predCorrect = await makePrediction(match._id, 1, 1, 'home'); // exact draw + correct pen winner
    const predWrongPen = await makePrediction(match._id, 1, 1, 'away'); // exact draw + wrong pen winner
    const predOutright = await makePrediction(match._id, 2, 0);          // outright home win prediction

    await scoreMatch(match._id);

    const [uCorrect, uWrongPen, uOutright] = await Promise.all([
      Prediction.findById(predCorrect._id),
      Prediction.findById(predWrongPen._id),
      Prediction.findById(predOutright._id),
    ]);
    expect(uCorrect.pointsAwarded).toBe(3);  // exact (score + correct pen winner) + total + outcome
    expect(uWrongPen.pointsAwarded).toBe(1); // total only — wrong pen winner means no exact and no outcome
    expect(uOutright.pointsAwarded).toBe(2); // total (2=2) + outcome (home wins), no exact
  });
});

describe('scoreMatch — error cases', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clearAll);

  it('throws when match does not exist', async () => {
    await expect(scoreMatch(new mongoose.Types.ObjectId())).rejects.toThrow(
      'Match result not available'
    );
  });

  it('throws when match result has not been entered', async () => {
    const match = await makeMatch({ resultEntered: false });
    await expect(scoreMatch(match._id)).rejects.toThrow('Match result not available');
  });
});
