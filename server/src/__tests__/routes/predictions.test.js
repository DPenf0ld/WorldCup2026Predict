import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { createApp } from '../helpers/createApp.js';
import Match from '../../models/Match.js';

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

  it("returns only the authenticated user's predictions", async () => {
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
