import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { createApp } from '../helpers/createApp.js';
import Match from '../../models/Match.js';
import Prediction from '../../models/Prediction.js';
import User from '../../models/User.js';
import League from '../../models/League.js';

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

const PRED = '/api/predictions';
const FUTURE_DEADLINE = new Date(Date.now() + 48 * 60 * 60 * 1000);
const PAST_DEADLINE = new Date(Date.now() - 60 * 1000);

let app;

function makeToken(userId) {
  return jwt.sign(
    { sub: userId, email: 'user@example.com' },
    'test-access-secret',
    { expiresIn: '15m' }
  );
}

async function makeGroupMatch(deadline = FUTURE_DEADLINE) {
  return Match.create({
    homeTeam: 'England',
    awayTeam: 'France',
    stage: 'GROUP',
    kickoffTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    predictionDeadline: deadline,
    resultEntered: false,
  });
}

beforeAll(async () => {
  await connect();
  app = createApp();
});

afterAll(disconnect);
beforeEach(clearAll);

// ── POST /api/predictions ─────────────────────────────────────────────────────

describe('POST /api/predictions', () => {
  it('returns 401 without a token', async () => {
    const match = await makeGroupMatch();
    const res = await request(app).post(PRED).send({
      matchId: match._id,
      predictedHomeScore: 1,
      predictedAwayScore: 0,
    });
    expect(res.status).toBe(401);
  });

  it('saves a valid prediction and returns 201', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch();

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 2, predictedAwayScore: 1 });

    expect(res.status).toBe(201);
    expect(res.body.prediction.predictedHomeScore).toBe(2);
    expect(res.body.prediction.predictedAwayScore).toBe(1);
  });

  it('upserts an existing prediction for the same match', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch();

    await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 1, predictedAwayScore: 0 });

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 3, predictedAwayScore: 2 });

    expect(res.status).toBe(201);
    expect(res.body.prediction.predictedHomeScore).toBe(3);
    expect(res.body.prediction.predictedAwayScore).toBe(2);
  });

  it('returns 403 after the prediction deadline', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch(PAST_DEADLINE);

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 1, predictedAwayScore: 0 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/deadline/i);
  });

  it('returns 400 for negative scores', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch();

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: -1, predictedAwayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-negative integers/i);
  });

  it('returns 400 for non-integer scores', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch();

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 1.5, predictedAwayScore: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch();

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown matchId', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({
        matchId: new mongoose.Types.ObjectId(),
        predictedHomeScore: 1,
        predictedAwayScore: 0,
      });

    expect(res.status).toBe(404);
  });

  it('returns 400 for a QF draw without predictedPenaltyWinner', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const knockout = await Match.create({
      homeTeam: 'Brazil',
      awayTeam: 'Argentina',
      stage: 'QUARTER_FINAL',
      kickoffTime: new Date(Date.now() + 80 * 60 * 60 * 1000),
      predictionDeadline: FUTURE_DEADLINE,
      resultEntered: false,
    });

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: knockout._id, predictedHomeScore: 1, predictedAwayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/penalty winner/i);
  });

  it('accepts a QF draw with a valid predictedPenaltyWinner', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const knockout = await Match.create({
      homeTeam: 'Brazil',
      awayTeam: 'Argentina',
      stage: 'FINAL',
      kickoffTime: new Date(Date.now() + 80 * 60 * 60 * 1000),
      predictionDeadline: FUTURE_DEADLINE,
      resultEntered: false,
    });

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({
        matchId: knockout._id,
        predictedHomeScore: 1,
        predictedAwayScore: 1,
        predictedPenaltyWinner: 'home',
      });

    expect(res.status).toBe(201);
    expect(res.body.prediction.predictedPenaltyWinner).toBe('home');
  });

  it('also rejects a R16 draw without predictedPenaltyWinner', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const r16Match = await Match.create({
      homeTeam: 'Spain',
      awayTeam: 'Portugal',
      stage: 'ROUND_OF_16',
      kickoffTime: new Date(Date.now() + 80 * 60 * 60 * 1000),
      predictionDeadline: FUTURE_DEADLINE,
      resultEntered: false,
    });

    const res = await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: r16Match._id, predictedHomeScore: 1, predictedAwayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/penalty winner/i);
  });
});

// ── GET /api/predictions/mine ────────────────────────────────────────────────

describe('GET /api/predictions/mine', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`${PRED}/mine`);
    expect(res.status).toBe(401);
  });

  it('returns an empty array when the user has no predictions', async () => {
    const token = makeToken(new mongoose.Types.ObjectId().toString());
    const res = await request(app).get(`${PRED}/mine`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.predictions).toEqual([]);
  });

  it("returns only the authenticated user's own predictions", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken(userId);
    const match = await makeGroupMatch();

    await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${token}`)
      .send({ matchId: match._id, predictedHomeScore: 2, predictedAwayScore: 0 });

    // Another user's prediction for the same match — should not appear
    const otherToken = makeToken(new mongoose.Types.ObjectId().toString());
    await request(app)
      .post(PRED)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ matchId: match._id, predictedHomeScore: 0, predictedAwayScore: 3 });

    const res = await request(app).get(`${PRED}/mine`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
    expect(res.body.predictions[0].predictedHomeScore).toBe(2);
  });
});

// ── GET /api/predictions/user/:userId ────────────────────────────────────────

describe('GET /api/predictions/user/:userId', () => {
  async function makeUser(name) {
    return User.create({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@test.com`,
      passwordHash: 'hash',
      emailVerified: true,
    });
  }

  async function makeLeague(memberIds) {
    return League.create({ name: 'Test League', members: memberIds });
  }

  async function makeCompletedMatch() {
    return Match.create({
      homeTeam: 'England',
      awayTeam: 'France',
      stage: 'GROUP',
      kickoffTime: new Date(Date.now() - 90 * 60 * 1000),
      predictionDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000),
      resultEntered: true,
      homeScore: 2,
      awayScore: 1,
    });
  }

  async function makePendingMatch() {
    return Match.create({
      homeTeam: 'Spain',
      awayTeam: 'Germany',
      stage: 'GROUP',
      kickoffTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
      predictionDeadline: new Date(Date.now() - 60 * 1000),
      resultEntered: false,
    });
  }

  it('returns 401 without a token', async () => {
    const target = await makeUser('Alice');
    const res = await request(app).get(`${PRED}/user/${target._id}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when requester and target share no league', async () => {
    const requester = await makeUser('Bob');
    const target = await makeUser('Alice');
    const token = makeToken(requester._id.toString());

    const res = await request(app)
      .get(`${PRED}/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/share a league/i);
  });

  it('returns 200 with the target user name and empty array when they have no completed predictions', async () => {
    const requester = await makeUser('Bob');
    const target = await makeUser('Alice');
    await makeLeague([requester._id, target._id]);
    const token = makeToken(requester._id.toString());

    const res = await request(app)
      .get(`${PRED}/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Alice');
    expect(res.body.predictions).toEqual([]);
  });

  it('returns only predictions for matches where resultEntered is true', async () => {
    const requester = await makeUser('Bob');
    const target = await makeUser('Alice');
    await makeLeague([requester._id, target._id]);
    const token = makeToken(requester._id.toString());

    const completedMatch = await makeCompletedMatch();
    const pendingMatch = await makePendingMatch();

    await Prediction.create({
      userId: target._id,
      matchId: completedMatch._id,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      pointsAwarded: 3,
    });
    await Prediction.create({
      userId: target._id,
      matchId: pendingMatch._id,
      predictedHomeScore: 1,
      predictedAwayScore: 0,
      pointsAwarded: null,
    });

    const res = await request(app)
      .get(`${PRED}/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
    expect(res.body.predictions[0].predictedHomeScore).toBe(2);
    expect(res.body.predictions[0].matchId.resultEntered).toBe(true);
  });

  it('includes match details and pointsAwarded in each prediction', async () => {
    const requester = await makeUser('Bob');
    const target = await makeUser('Alice');
    await makeLeague([requester._id, target._id]);
    const token = makeToken(requester._id.toString());

    const completedMatch = await makeCompletedMatch();
    await Prediction.create({
      userId: target._id,
      matchId: completedMatch._id,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      pointsAwarded: 3,
    });

    const res = await request(app)
      .get(`${PRED}/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pred = res.body.predictions[0];
    expect(pred.pointsAwarded).toBe(3);
    expect(pred.matchId.homeTeam).toBe('England');
    expect(pred.matchId.awayTeam).toBe('France');
    expect(pred.matchId.homeScore).toBe(2);
    expect(pred.matchId.awayScore).toBe(1);
  });

  it('does not include another user\'s predictions in the response', async () => {
    const requester = await makeUser('Bob');
    const target = await makeUser('Alice');
    const stranger = await makeUser('Eve');
    await makeLeague([requester._id, target._id]);
    const token = makeToken(requester._id.toString());

    const completedMatch = await makeCompletedMatch();

    await Prediction.create({
      userId: target._id,
      matchId: completedMatch._id,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      pointsAwarded: 3,
    });
    await Prediction.create({
      userId: stranger._id,
      matchId: completedMatch._id,
      predictedHomeScore: 0,
      predictedAwayScore: 0,
      pointsAwarded: 0,
    });

    const res = await request(app)
      .get(`${PRED}/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
    expect(res.body.predictions[0].predictedHomeScore).toBe(2);
  });

  it('allows a user to view their own predictions via this endpoint', async () => {
    const user = await makeUser('Self');
    const other = await makeUser('Other');
    await makeLeague([user._id, other._id]);
    const token = makeToken(user._id.toString());

    const completedMatch = await makeCompletedMatch();
    await Prediction.create({
      userId: user._id,
      matchId: completedMatch._id,
      predictedHomeScore: 1,
      predictedAwayScore: 1,
      pointsAwarded: 1,
    });

    const res = await request(app)
      .get(`${PRED}/user/${user._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
    expect(res.body.user.name).toBe('Self');
  });

  it('returns 403 when requester is in a league but target is not in the same one', async () => {
    const requester = await makeUser('Bob');
    const target = await makeUser('Alice');
    const unrelated = await makeUser('Charlie');
    // requester and Charlie share a league, but not target
    await makeLeague([requester._id, unrelated._id]);
    const token = makeToken(requester._id.toString());

    const res = await request(app)
      .get(`${PRED}/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
