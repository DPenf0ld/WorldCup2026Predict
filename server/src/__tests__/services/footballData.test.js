import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import Match from '../../models/Match.js';
import Prediction from '../../models/Prediction.js';
import { syncFixtures } from '../../services/footballData.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRaw(overrides = {}) {
  return {
    id: 1001,
    stage: 'GROUP_STAGE',
    status: 'SCHEDULED',
    utcDate: '2026-06-15T12:00:00Z',
    homeTeam: { name: 'Brazil' },
    awayTeam: { name: 'Mexico' },
    group: 'GROUP_A',
    score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null }, winner: null },
    venue: 'MetLife Stadium',
    ...overrides,
  };
}

function mockFetchOk(matches) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ matches }),
  }));
}

beforeAll(connect);
afterAll(disconnect);
beforeEach(async () => {
  await clearAll();
  process.env.API_FOOTBALL_KEY = 'test-key';
});
afterEach(() => vi.unstubAllGlobals());

// ── Create / update ───────────────────────────────────────────────────────────

describe('syncFixtures — create and update', () => {
  it('creates a new match document and returns created=1 updated=0', async () => {
    mockFetchOk([makeRaw()]);
    const { created, updated } = await syncFixtures();

    expect(created).toBe(1);
    expect(updated).toBe(0);
    const m = await Match.findOne({ externalId: 1001 });
    expect(m).not.toBeNull();
    expect(m.homeTeam).toBe('Brazil');
    expect(m.awayTeam).toBe('Mexico');
    expect(m.stage).toBe('GROUP');
    expect(m.group).toBe('A');
    expect(m.status).toBe('SCHEDULED');
    expect(m.venue).toBe('MetLife Stadium');
  });

  it('updates an existing match without creating a duplicate', async () => {
    mockFetchOk([makeRaw()]);
    await syncFixtures();

    mockFetchOk([makeRaw({ status: 'IN_PLAY' })]);
    const { created, updated } = await syncFixtures();

    expect(created).toBe(0);
    expect(updated).toBe(1);
    expect(await Match.countDocuments({ externalId: 1001 })).toBe(1);
    const m = await Match.findOne({ externalId: 1001 });
    expect(m.status).toBe('IN_PLAY');
  });

  it('sets predictionDeadline 48 h before kickoff for GROUP stage', async () => {
    mockFetchOk([makeRaw({ utcDate: '2026-06-15T12:00:00Z' })]);
    await syncFixtures();

    const m = await Match.findOne({ externalId: 1001 });
    expect(m.predictionDeadline.toISOString()).toBe('2026-06-13T12:00:00.000Z');
  });

  it('does not overwrite predictionDeadline on subsequent syncs', async () => {
    mockFetchOk([makeRaw({ utcDate: '2026-06-15T12:00:00Z' })]);
    await syncFixtures();
    const first = (await Match.findOne({ externalId: 1001 })).predictionDeadline.getTime();

    mockFetchOk([makeRaw({ utcDate: '2026-06-16T12:00:00Z' })]);
    await syncFixtures();
    const second = (await Match.findOne({ externalId: 1001 })).predictionDeadline.getTime();

    expect(second).toBe(first);
  });

  it('skips matches with unknown stage codes', async () => {
    mockFetchOk([makeRaw({ stage: 'UNKNOWN_STAGE' })]);
    const { created, updated } = await syncFixtures();

    expect(created).toBe(0);
    expect(updated).toBe(0);
    expect(await Match.countDocuments({})).toBe(0);
  });

  it.each([
    ['GROUP_STAGE',   'GROUP'],
    ['LAST_32',       'ROUND_OF_32'],
    ['ROUND_OF_32',   'ROUND_OF_32'],
    ['LAST_16',       'ROUND_OF_16'],
    ['ROUND_OF_16',   'ROUND_OF_16'],
    ['QUARTER_FINALS','QUARTER_FINAL'],
    ['SEMI_FINALS',   'SEMI_FINAL'],
    ['THIRD_PLACE',   'THIRD_PLACE'],
    ['FINAL',         'FINAL'],
  ])('maps API stage %s → internal stage %s', async (apiStage, internalStage) => {
    await clearAll();
    mockFetchOk([makeRaw({ stage: apiStage, group: apiStage === 'GROUP_STAGE' ? 'GROUP_A' : undefined })]);
    await syncFixtures();
    const m = await Match.findOne({ externalId: 1001 });
    expect(m?.stage).toBe(internalStage);
  });
});

// ── Finished matches and auto-scoring ─────────────────────────────────────────

describe('syncFixtures — finished matches and auto-scoring', () => {
  const FINISHED = makeRaw({
    status: 'FINISHED',
    score: { fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
  });

  it('sets homeScore, awayScore, resultEntered=true when match is FINISHED', async () => {
    mockFetchOk([FINISHED]);
    await syncFixtures();

    const m = await Match.findOne({ externalId: 1001 });
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
    expect(m.resultEntered).toBe(true);
    expect(m.penaltyWinner).toBeNull();
  });

  it('auto-scores predictions the moment a match first becomes FINISHED', async () => {
    const match = await Match.create({
      externalId: 1001,
      homeTeam: 'Brazil', awayTeam: 'Mexico', stage: 'GROUP',
      kickoffTime: new Date('2026-06-15T12:00:00Z'),
      predictionDeadline: new Date('2026-06-13T12:00:00Z'),
      resultEntered: false,
    });

    const p1 = await Prediction.create({
      userId: new mongoose.Types.ObjectId(), matchId: match._id,
      predictedHomeScore: 2, predictedAwayScore: 1, // exact → 3 pts
    });
    const p2 = await Prediction.create({
      userId: new mongoose.Types.ObjectId(), matchId: match._id,
      predictedHomeScore: 1, predictedAwayScore: 0, // correct outcome only → 1 pt
    });
    const p3 = await Prediction.create({
      userId: new mongoose.Types.ObjectId(), matchId: match._id,
      predictedHomeScore: 3, predictedAwayScore: 0, // total=3 + outcome → 2 pts
    });

    mockFetchOk([FINISHED]);
    await syncFixtures();

    const [u1, u2, u3] = await Promise.all([
      Prediction.findById(p1._id),
      Prediction.findById(p2._id),
      Prediction.findById(p3._id),
    ]);
    expect(u1.pointsAwarded).toBe(3);
    expect(u2.pointsAwarded).toBe(1);
    expect(u3.pointsAwarded).toBe(2);
    expect(u1.scoredAt).toBeInstanceOf(Date);
  });

  it('does not re-score predictions when match was already resultEntered', async () => {
    await Match.create({
      externalId: 1001,
      homeTeam: 'Brazil', awayTeam: 'Mexico', stage: 'GROUP',
      kickoffTime: new Date('2026-06-15T12:00:00Z'),
      predictionDeadline: new Date('2026-06-13T12:00:00Z'),
      homeScore: 2, awayScore: 1, resultEntered: true, status: 'FINISHED',
    });

    const match = await Match.findOne({ externalId: 1001 });
    const pred = await Prediction.create({
      userId: new mongoose.Types.ObjectId(), matchId: match._id,
      predictedHomeScore: 2, predictedAwayScore: 1,
      pointsAwarded: 99, // sentinel — must not change
      scoredAt: new Date(),
    });

    mockFetchOk([FINISHED]);
    await syncFixtures();

    const updated = await Prediction.findById(pred._id);
    expect(updated.pointsAwarded).toBe(99);
  });

  it('sets penaltyWinner=away for a knockout draw won on penalties by the away team', async () => {
    mockFetchOk([makeRaw({
      id: 2001,
      stage: 'QUARTER_FINALS',
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 1 }, halfTime: { home: 0, away: 0 }, winner: 'AWAY_TEAM' },
    })]);
    await syncFixtures();

    const m = await Match.findOne({ externalId: 2001 });
    expect(m.penaltyWinner).toBe('away');
    expect(m.resultEntered).toBe(true);
  });

  it('sets penaltyWinner=home for a knockout draw won on penalties by the home team', async () => {
    mockFetchOk([makeRaw({
      id: 3001,
      stage: 'FINAL',
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 1 }, halfTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
    })]);
    await syncFixtures();

    const m = await Match.findOne({ externalId: 3001 });
    expect(m.penaltyWinner).toBe('home');
  });

  it('does not set penaltyWinner when knockout match is won outright', async () => {
    mockFetchOk([makeRaw({
      id: 4001,
      stage: 'SEMI_FINALS',
      status: 'FINISHED',
      score: { fullTime: { home: 3, away: 1 }, halfTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
    })]);
    await syncFixtures();

    const m = await Match.findOne({ externalId: 4001 });
    expect(m.penaltyWinner).toBeNull();
  });

  it('auto-scores knockout prediction correctly with penalty winner', async () => {
    const match = await Match.create({
      externalId: 2001,
      homeTeam: 'Spain', awayTeam: 'Germany', stage: 'QUARTER_FINAL',
      kickoffTime: new Date('2026-07-10T18:00:00Z'),
      predictionDeadline: new Date('2026-07-07T18:00:00Z'),
      resultEntered: false,
    });

    const p1 = await Prediction.create({
      userId: new mongoose.Types.ObjectId(), matchId: match._id,
      predictedHomeScore: 1, predictedAwayScore: 1, predictedPenaltyWinner: 'away', // exact draw + correct pen → 3 pts
    });
    const p2 = await Prediction.create({
      userId: new mongoose.Types.ObjectId(), matchId: match._id,
      predictedHomeScore: 1, predictedAwayScore: 1, predictedPenaltyWinner: 'home', // exact draw + wrong pen → 2 pts
    });

    // The match ends 1-1, away wins on penalties
    mockFetchOk([makeRaw({
      id: 2001,
      stage: 'QUARTER_FINALS',
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 1 }, halfTime: { home: 0, away: 0 }, winner: 'AWAY_TEAM' },
    })]);
    await syncFixtures();

    const [u1, u2] = await Promise.all([Prediction.findById(p1._id), Prediction.findById(p2._id)]);
    expect(u1.pointsAwarded).toBe(3);
    expect(u2.pointsAwarded).toBe(2);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('syncFixtures — error handling', () => {
  it('throws when API_FOOTBALL_KEY is not set', async () => {
    const saved = process.env.API_FOOTBALL_KEY;
    delete process.env.API_FOOTBALL_KEY;
    try {
      await expect(syncFixtures()).rejects.toThrow('API_FOOTBALL_KEY');
    } finally {
      process.env.API_FOOTBALL_KEY = saved;
    }
  });

  it('throws with status code on a non-200, non-429 API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    }));
    await expect(syncFixtures()).rejects.toThrow('503');
  });

  // NOTE: this test sets the in-module backoffUntil — keep it last in this suite
  it('throws on a 429 response and reports rate-limit error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Too Many Requests'),
    }));
    await expect(syncFixtures()).rejects.toThrow(/rate limited/i);
  });
});
