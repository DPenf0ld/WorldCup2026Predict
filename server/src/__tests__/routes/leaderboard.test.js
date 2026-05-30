import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { createApp } from '../helpers/createApp.js';
import User from '../../models/User.js';
import League from '../../models/League.js';
import Match from '../../models/Match.js';
import Prediction from '../../models/Prediction.js';

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

const LB = '/api/leaderboard';

let app;

function makeToken(userId) {
  return jwt.sign(
    { sub: userId, email: 'user@example.com' },
    'test-access-secret',
    { expiresIn: '15m' }
  );
}

async function makeUser(name) {
  return User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@test.com`,
    passwordHash: 'hash',
    emailVerified: true,
  });
}

async function makeLeague({ entryFee = 0, members = [], paidMembers = [] } = {}) {
  return League.create({ name: 'Test League', entryFee, members, paidMembers });
}

async function makeMatch({ resultEntered = true } = {}) {
  return Match.create({
    homeTeam: 'England',
    awayTeam: 'France',
    stage: 'GROUP',
    kickoffTime: new Date(Date.now() - 90 * 60 * 1000),
    predictionDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000),
    resultEntered,
    homeScore: resultEntered ? 2 : undefined,
    awayScore: resultEntered ? 1 : undefined,
  });
}

async function makePrediction(userId, matchId, points) {
  return Prediction.create({
    userId,
    matchId,
    predictedHomeScore: 1,
    predictedAwayScore: 0,
    pointsAwarded: points,
  });
}

beforeAll(async () => {
  await connect();
  app = createApp();
});

afterAll(disconnect);
beforeEach(clearAll);

// ── Authentication & basic validation ────────────────────────────────────────

describe('GET /api/leaderboard — auth & validation', () => {
  it('returns 401 without a token', async () => {
    const league = await makeLeague();
    const res = await request(app).get(LB).query({ leagueId: league._id.toString() });
    expect(res.status).toBe(401);
  });

  it('returns 400 when leagueId is omitted', async () => {
    const user = await makeUser('Alice');
    const token = makeToken(user._id.toString());
    const res = await request(app).get(LB).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/leagueId/i);
  });

  it('returns 404 for an unknown leagueId', async () => {
    const user = await makeUser('Alice');
    const token = makeToken(user._id.toString());
    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the user is not a member of the league', async () => {
    const user = await makeUser('Alice');
    const other = await makeUser('Bob');
    const league = await makeLeague({ members: [other._id] });
    const token = makeToken(user._id.toString());
    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });
    expect(res.status).toBe(403);
  });
});

// ── Free league ───────────────────────────────────────────────────────────────

describe('GET /api/leaderboard — free league', () => {
  it('includes all members in the leaderboard regardless of paidMembers', async () => {
    const alice = await makeUser('Alice');
    const bob = await makeUser('Bob');
    const league = await makeLeague({ entryFee: 0, members: [alice._id, bob._id] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(2);
  });

  it('returns currentUserPaid: true for free leagues', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ entryFee: 0, members: [alice._id] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.currentUserPaid).toBe(true);
  });

  it('returns all members in allMembers with paid: true for free leagues', async () => {
    const alice = await makeUser('Alice');
    const bob = await makeUser('Bob');
    const league = await makeLeague({ entryFee: 0, members: [alice._id, bob._id] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.allMembers).toHaveLength(2);
    expect(res.body.allMembers.every((m) => m.paid === true)).toBe(true);
  });
});

// ── Paid league — unpaid member ───────────────────────────────────────────────

describe('GET /api/leaderboard — paid league, unpaid member', () => {
  it('returns currentUserPaid: false when the requesting user has not paid', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ entryFee: 10, members: [alice._id], paidMembers: [] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.currentUserPaid).toBe(false);
  });

  it('excludes the unpaid user from the leaderboard', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ entryFee: 10, members: [alice._id], paidMembers: [] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(0);
  });

  it('includes the unpaid user in allMembers with paid: false', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ entryFee: 10, members: [alice._id], paidMembers: [] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.allMembers).toHaveLength(1);
    expect(res.body.allMembers[0].paid).toBe(false);
    expect(res.body.allMembers[0].name).toBe('Alice');
  });
});

// ── Paid league — paid member ─────────────────────────────────────────────────

describe('GET /api/leaderboard — paid league, paid member', () => {
  it('returns currentUserPaid: true when the requesting user has paid', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({
      entryFee: 10,
      members: [alice._id],
      paidMembers: [alice._id],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.currentUserPaid).toBe(true);
  });

  it('includes a paid member on the leaderboard', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({
      entryFee: 10,
      members: [alice._id],
      paidMembers: [alice._id],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(1);
    expect(res.body.leaderboard[0].name).toBe('Alice');
  });
});

// ── Mixed paid/unpaid members ─────────────────────────────────────────────────

describe('GET /api/leaderboard — mixed paid/unpaid members', () => {
  it('only shows paid members on the leaderboard', async () => {
    const alice = await makeUser('Alice'); // paid
    const bob = await makeUser('Bob');     // unpaid
    const carol = await makeUser('Carol'); // paid
    const league = await makeLeague({
      entryFee: 20,
      members: [alice._id, bob._id, carol._id],
      paidMembers: [alice._id, carol._id],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    const names = res.body.leaderboard.map((e) => e.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Carol');
    expect(names).not.toContain('Bob');
  });

  it('allMembers contains all members with correct paid flags', async () => {
    const alice = await makeUser('Alice'); // paid
    const bob = await makeUser('Bob');     // unpaid
    const league = await makeLeague({
      entryFee: 20,
      members: [alice._id, bob._id],
      paidMembers: [alice._id],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.allMembers).toHaveLength(2);
    const byName = Object.fromEntries(res.body.allMembers.map((m) => [m.name, m.paid]));
    expect(byName['Alice']).toBe(true);
    expect(byName['Bob']).toBe(false);
  });

  it('allMembers includes everyone even when leaderboard is empty', async () => {
    const alice = await makeUser('Alice');
    const bob = await makeUser('Bob');
    const league = await makeLeague({
      entryFee: 10,
      members: [alice._id, bob._id],
      paidMembers: [],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(0);
    expect(res.body.allMembers).toHaveLength(2);
  });
});

// ── Leaderboard ranking & points ──────────────────────────────────────────────

describe('GET /api/leaderboard — ranking and points', () => {
  it('ranks members by totalPoints descending and assigns sequential ranks', async () => {
    const alice = await makeUser('Alice');
    const bob = await makeUser('Bob');
    const carol = await makeUser('Carol');
    const league = await makeLeague({
      members: [alice._id, bob._id, carol._id],
    });
    const match = await makeMatch();

    await makePrediction(alice._id, match._id, 5);
    await makePrediction(bob._id, match._id, 10);
    await makePrediction(carol._id, match._id, 3);

    const token = makeToken(alice._id.toString());
    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    const lb = res.body.leaderboard;
    expect(lb[0].name).toBe('Bob');
    expect(lb[0].rank).toBe(1);
    expect(lb[0].totalPoints).toBe(10);
    expect(lb[1].name).toBe('Alice');
    expect(lb[1].rank).toBe(2);
    expect(lb[1].totalPoints).toBe(5);
    expect(lb[2].name).toBe('Carol');
    expect(lb[2].rank).toBe(3);
    expect(lb[2].totalPoints).toBe(3);
  });

  it('sums points across multiple scored matches for each member', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ members: [alice._id] });
    const match1 = await makeMatch();
    const match2 = await makeMatch();

    await makePrediction(alice._id, match1._id, 3);
    await makePrediction(alice._id, match2._id, 7);

    const token = makeToken(alice._id.toString());
    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].totalPoints).toBe(10);
    expect(res.body.leaderboard[0].predictionsScored).toBe(2);
  });

  it('excludes predictions for matches where resultEntered is false', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ members: [alice._id] });
    const scoredMatch = await makeMatch({ resultEntered: true });
    const pendingMatch = await makeMatch({ resultEntered: false });

    await makePrediction(alice._id, scoredMatch._id, 5);
    await makePrediction(alice._id, pendingMatch._id, 99);

    const token = makeToken(alice._id.toString());
    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].totalPoints).toBe(5);
    expect(res.body.leaderboard[0].predictionsScored).toBe(1);
  });

  it('shows 0 points and 0 predictionsScored for a member with no scored predictions', async () => {
    const alice = await makeUser('Alice');
    const league = await makeLeague({ members: [alice._id] });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].totalPoints).toBe(0);
    expect(res.body.leaderboard[0].predictionsScored).toBe(0);
  });

  it('only accumulates points for paid members in a paid league', async () => {
    const alice = await makeUser('Alice'); // paid
    const bob = await makeUser('Bob');     // unpaid
    const league = await makeLeague({
      entryFee: 10,
      members: [alice._id, bob._id],
      paidMembers: [alice._id],
    });
    const match = await makeMatch();

    await makePrediction(alice._id, match._id, 4);
    await makePrediction(bob._id, match._id, 20);

    const token = makeToken(alice._id.toString());
    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(1);
    expect(res.body.leaderboard[0].name).toBe('Alice');
    expect(res.body.leaderboard[0].totalPoints).toBe(4);
  });
});

// ── League metadata in response ───────────────────────────────────────────────

describe('GET /api/leaderboard — league metadata', () => {
  it('returns correct paidMemberCount and totalMemberCount', async () => {
    const alice = await makeUser('Alice');
    const bob = await makeUser('Bob');
    const carol = await makeUser('Carol');
    const league = await makeLeague({
      entryFee: 10,
      members: [alice._id, bob._id, carol._id],
      paidMembers: [alice._id, bob._id],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.league.paidMemberCount).toBe(2);
    expect(res.body.league.totalMemberCount).toBe(3);
    expect(res.body.league.entryFee).toBe(10);
  });

  it('returns the league name', async () => {
    const alice = await makeUser('Alice');
    const league = await League.create({
      name: 'Champions Cup',
      entryFee: 0,
      members: [alice._id],
    });
    const token = makeToken(alice._id.toString());

    const res = await request(app)
      .get(LB)
      .set('Authorization', `Bearer ${token}`)
      .query({ leagueId: league._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.league.name).toBe('Champions Cup');
  });
});
