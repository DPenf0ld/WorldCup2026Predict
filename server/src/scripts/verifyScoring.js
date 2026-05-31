/**
 * Scoring verification script — creates temporary matches and predictions,
 * scores them, prints a human-readable report, then deletes all test data.
 *
 * Usage: node --experimental-vm-modules src/scripts/verifyScoring.js
 *   (or via: npm run verify-scoring)
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Match from '../models/Match.js';
import Prediction from '../models/Prediction.js';
import User from '../models/User.js';
import { scoreMatch } from '../services/scoring.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const TAG = 'VERIFY_SCORING_TEMP';
const PAST = new Date('2026-01-01T00:00:00Z');

function pts(n) {
  return `${n} pt${n !== 1 ? 's' : ''}`;
}

function cell(v, width) {
  const s = String(v ?? '—');
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

function scoreLabel(homeScore, awayScore, penaltyWinner) {
  const base = `${homeScore}–${awayScore}`;
  if (penaltyWinner) return `${base} (${penaltyWinner} wins pens)`;
  return base;
}

function predLabel(ph, pa, ppw) {
  const base = `${ph}–${pa}`;
  if (ppw) return `${base} + ${ppw} pens`;
  return base;
}

// ── Scenarios ──────────────────────────────────────────────────────────────

const SCENARIOS = [
  // ── Group stage ───────────────────────────────────────────────────────
  {
    label: 'GROUP — Exact score',
    stage: 'GROUP',
    result: { homeScore: 2, awayScore: 1 },
    predictions: [
      { name: 'Alice', ph: 2, pa: 1, ppw: null, expectedPts: 3, why: 'exact + total + outcome' },
      { name: 'Bob',   ph: 3, pa: 0, ppw: null, expectedPts: 2, why: 'total(3) + outcome(home)' },
      { name: 'Carol', ph: 1, pa: 0, ppw: null, expectedPts: 1, why: 'outcome only (total wrong)' },
      { name: 'Dan',   ph: 1, pa: 2, ppw: null, expectedPts: 1, why: 'total(3) only (away predicted)' },
      { name: 'Eve',   ph: 0, pa: 3, ppw: null, expectedPts: 1, why: 'total(3=3) only — wrong outcome' },
    ],
  },
  {
    label: 'GROUP — Draw 1–1',
    stage: 'GROUP',
    result: { homeScore: 1, awayScore: 1 },
    predictions: [
      { name: 'Alice', ph: 1, pa: 1, ppw: null, expectedPts: 3, why: 'exact + total + outcome(draw)' },
      { name: 'Bob',   ph: 2, pa: 2, ppw: null, expectedPts: 1, why: 'draw outcome only — total 4≠2' },
      { name: 'Carol', ph: 0, pa: 0, ppw: null, expectedPts: 1, why: 'draw outcome only — total 0≠2' },
    ],
  },
  // ── Knockout — outright winner ────────────────────────────────────────
  {
    label: 'KNOCKOUT — Outright home win 2–1',
    stage: 'ROUND_OF_16',
    result: { homeScore: 2, awayScore: 1, penaltyWinner: null },
    predictions: [
      { name: 'Alice', ph: 2, pa: 1, ppw: null,   expectedPts: 3, why: 'exact + total + outcome' },
      { name: 'Bob',   ph: 3, pa: 0, ppw: null,   expectedPts: 2, why: 'total(3) + outcome(home)' },
      { name: 'Carol', ph: 1, pa: 1, ppw: 'home', expectedPts: 1, why: 'outcome(home advances) only — total 2≠3' },
      { name: 'Dan',   ph: 0, pa: 1, ppw: null,   expectedPts: 0, why: 'all wrong' },
    ],
  },
  // ── Knockout — draw → penalties (no ET goals) ─────────────────────────
  {
    label: 'KNOCKOUT — Draw 1–1, home wins penalties',
    stage: 'QUARTER_FINAL',
    result: { homeScore: 1, awayScore: 1, penaltyWinner: 'home' },
    predictions: [
      { name: 'Alice', ph: 1, pa: 1, ppw: 'home', expectedPts: 3, why: 'exact(score+pen) + total + outcome' },
      { name: 'Bob',   ph: 1, pa: 1, ppw: 'away', expectedPts: 1, why: 'total only — wrong pen = no exact, no outcome' },
      { name: 'Carol', ph: 2, pa: 0, ppw: null,   expectedPts: 2, why: 'total(2=1+1) + outcome(home advances)' },
      { name: 'Dan',   ph: 1, pa: 0, ppw: null,   expectedPts: 1, why: 'outcome only (total 1≠2)' },
      { name: 'Eve',   ph: 0, pa: 1, ppw: null,   expectedPts: 0, why: 'wrong outcome, total(1≠2)' },
    ],
  },
  // ── Knockout — ET goals then penalties (1-1 → 2-2 → home wins pens) ──
  {
    label: 'KNOCKOUT — ET goals: 1–1 at 90, 2–2 after ET, home wins pens',
    stage: 'SEMI_FINAL',
    result: { homeScore: 2, awayScore: 2, penaltyWinner: 'home' },  // stored as ET score + pen winner
    predictions: [
      { name: 'Alice', ph: 2, pa: 2, ppw: 'home', expectedPts: 3, why: 'exact(2-2 + correct pen) + total + outcome' },
      { name: 'Bob',   ph: 2, pa: 2, ppw: 'away', expectedPts: 1, why: 'total only — wrong pen = no exact, no outcome' },
      { name: 'Carol', ph: 1, pa: 1, ppw: 'home', expectedPts: 1, why: 'outcome(home advances) only — score 1≠2, total 2≠4' },
      { name: 'Dan',   ph: 3, pa: 1, ppw: null,   expectedPts: 2, why: 'total(4) + outcome(home wins)' },
      { name: 'Eve',   ph: 2, pa: 1, ppw: null,   expectedPts: 1, why: 'outcome only — home predicted (2>1) matches home advancing; total 3≠4' },
    ],
  },
  // ── Knockout — ET outright winner (2-1 final after ET) ────────────────
  {
    label: 'KNOCKOUT — ET winner: 1–1 at 90, 2–1 after ET (home wins)',
    stage: 'FINAL',
    result: { homeScore: 2, awayScore: 1, penaltyWinner: null },  // no pens, ET decided it
    predictions: [
      { name: 'Alice', ph: 2, pa: 1, ppw: null,   expectedPts: 3, why: 'exact(2-1) + total + outcome' },
      { name: 'Bob',   ph: 1, pa: 1, ppw: 'home', expectedPts: 1, why: 'outcome(home advances) — total(2≠3)' },
      { name: 'Carol', ph: 3, pa: 0, ppw: null,   expectedPts: 2, why: 'total(3) + outcome(home)' },
      { name: 'Dan',   ph: 1, pa: 2, ppw: null,   expectedPts: 1, why: 'total(3=3) only — predicted away win, actual home win' },
    ],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log('Connected to in-memory MongoDB\n');

  // Create a dummy user per name (reuse across scenarios to keep it lean)
  const nameSet = [...new Set(SCENARIOS.flatMap((s) => s.predictions.map((p) => p.name)))];
  const userMap = {};
  for (const name of nameSet) {
    const u = await User.create({
      name,
      email: `${name.toLowerCase()}.verify_temp@example.com`,
      passwordHash: 'temp',
      emailVerified: true,
    });
    userMap[name] = u._id;
  }

  let allPassed = true;
  const results = [];

  for (const scenario of SCENARIOS) {
    const kickoff = new Date('2026-03-01T12:00:00Z');
    const match = await Match.create({
      homeTeam: `Home_${TAG}`,
      awayTeam: `Away_${TAG}`,
      stage: scenario.stage,
      group: scenario.stage === 'GROUP' ? 'A' : undefined,
      kickoffTime: kickoff,
      predictionDeadline: PAST,
      homeScore: scenario.result.homeScore,
      awayScore: scenario.result.awayScore,
      penaltyWinner: scenario.result.penaltyWinner ?? null,
      resultEntered: true,
    });

    const predDocs = [];
    for (const p of scenario.predictions) {
      const doc = await Prediction.create({
        userId: userMap[p.name],
        matchId: match._id,
        predictedHomeScore: p.ph,
        predictedAwayScore: p.pa,
        predictedPenaltyWinner: p.ppw ?? null,
      });
      predDocs.push({ ...p, _id: doc._id });
    }

    await scoreMatch(match._id);

    const scenarioResults = [];
    let scenarioPassed = true;
    for (const p of predDocs) {
      const updated = await Prediction.findById(p._id);
      const got = updated.pointsAwarded;
      const pass = got === p.expectedPts;
      if (!pass) { allPassed = false; scenarioPassed = false; }
      scenarioResults.push({ name: p.name, pred: predLabel(p.ph, p.pa, p.ppw), got, expected: p.expectedPts, pass });
    }

    results.push({ scenario, match, scenarioPassed, rows: scenarioResults });
  }

  // ── Print report ──────────────────────────────────────────────────────

  console.log('═'.repeat(88));
  console.log('  SCORING VERIFICATION REPORT');
  console.log('═'.repeat(88));

  for (const { scenario, match, scenarioPassed, rows } of results) {
    const resultStr = scoreLabel(match.homeScore, match.awayScore, match.penaltyWinner);
    console.log(`\n${scenarioPassed ? '✅' : '❌'}  ${scenario.label}`);
    console.log(`   Stage: ${match.stage}   Result: ${resultStr}`);
    console.log('   ' + '─'.repeat(70));
    console.log(
      '   ' +
      cell('Player', 8) +
      cell('Prediction', 20) +
      cell('Got', 6) +
      cell('Expected', 10) +
      'Status'
    );
    console.log('   ' + '─'.repeat(70));
    for (const r of rows) {
      const status = r.pass ? '✅ PASS' : `❌ FAIL (expected ${pts(r.expected)})`;
      console.log(
        '   ' +
        cell(r.name, 8) +
        cell(r.pred, 20) +
        cell(pts(r.got), 6) +
        cell(pts(r.expected), 10) +
        status
      );
    }
  }

  console.log('\n' + '═'.repeat(88));
  console.log(allPassed ? '  ✅ ALL SCENARIOS PASSED' : '  ❌ SOME SCENARIOS FAILED — see above');
  console.log('═'.repeat(88));

  await mongoose.connection.close();
  await mongod.stop();
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
