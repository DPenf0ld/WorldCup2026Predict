import Match from '../models/Match.js';
import { scoreMatch } from './scoring.js';
import { KNOCKOUT_DEADLINES, GROUP_STAGE_DEADLINE_OFFSET_MS } from '../config/constants.js';

const BASE_URL = 'https://api.football-data.org/v4';

// In-memory rate-limit state — persists for the lifetime of the process
let backoffUntil = null;
let requestCount = 0;

// football-data.org stage codes → our internal stage values
const STAGE_MAP = {
  GROUP_STAGE: 'GROUP',
  LAST_32: 'ROUND_OF_32',
  ROUND_OF_32: 'ROUND_OF_32',
  LAST_16: 'ROUND_OF_16',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINALS: 'QUARTER_FINAL',
  SEMI_FINALS: 'SEMI_FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
};

function computeDeadline(stage, kickoffTime) {
  if (stage === 'GROUP') {
    return new Date(kickoffTime.getTime() - GROUP_STAGE_DEADLINE_OFFSET_MS);
  }
  return KNOCKOUT_DEADLINES[stage] ?? new Date(kickoffTime.getTime() - 72 * 60 * 60 * 1000);
}

async function fetchAllMatches() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('API_FOOTBALL_KEY environment variable is not set');

  if (backoffUntil && Date.now() < backoffUntil) {
    const secs = Math.ceil((backoffUntil - Date.now()) / 1000);
    throw new Error(`Rate limited — backing off for ${secs}s more`);
  }

  requestCount++;
  const url = `${BASE_URL}/competitions/WC/matches`;
  console.log(`[football-data] Request #${requestCount}: GET ${url}`);

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey },
  });

  if (res.status === 429) {
    backoffUntil = Date.now() + 10 * 60 * 1000;
    console.warn('[football-data] Rate limited (429) — backing off for 10 minutes');
    throw new Error('Rate limited by football-data.org — will retry in 10 minutes');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`football-data.org responded with ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.matches ?? [];
}

export async function syncFixtures() {
  const rawMatches = await fetchAllMatches();

  let created = 0;
  let updated = 0;

  for (const raw of rawMatches) {
    const stage = STAGE_MAP[raw.stage];
    if (!stage) continue; // unknown stage — skip

    const kickoffTime = new Date(raw.utcDate);
    const fullTime = raw.score?.fullTime ?? {};
    const halfTime = raw.score?.halfTime ?? {};
    const isFinished =
      raw.status === 'FINISHED' && fullTime.home !== null && fullTime.away !== null;

    const liveFields = {
      status: raw.status,
      halfTimeScore: { home: halfTime.home ?? null, away: halfTime.away ?? null },
      fullTimeScore: { home: fullTime.home ?? null, away: fullTime.away ?? null },
      lastSynced: new Date(),
    };

    if (raw.venue) liveFields.venue = raw.venue;

    // Team names and kickoff can change before knockout matches are determined
    const metaFields = {
      homeTeam: raw.homeTeam?.name ?? 'TBD',
      awayTeam: raw.awayTeam?.name ?? 'TBD',
      stage,
      kickoffTime,
    };
    if (raw.group) metaFields.group = raw.group.replace('GROUP_', '');

    // Scoring fields — only set once the match is truly finished with real scores
    const scoringFields = {};
    if (isFinished) {
      scoringFields.homeScore = fullTime.home;
      scoringFields.awayScore = fullTime.away;
      scoringFields.resultEntered = true;
      // Determine penalty winner for knockout draws
      if (fullTime.home === fullTime.away) {
        if (raw.score?.winner === 'HOME_TEAM') scoringFields.penaltyWinner = 'home';
        else if (raw.score?.winner === 'AWAY_TEAM') scoringFields.penaltyWinner = 'away';
      }
    }

    const existing = await Match.findOne({ externalId: raw.id }).lean();
    const wasResultEntered = existing?.resultEntered ?? false;

    const predictionDeadline = computeDeadline(stage, kickoffTime);

    const doc = await Match.findOneAndUpdate(
      { externalId: raw.id },
      {
        $set: { ...liveFields, ...metaFields, ...scoringFields },
        // predictionDeadline only written once — keeps manual overrides intact
        $setOnInsert: { externalId: raw.id, predictionDeadline },
      },
      { upsert: true, new: true }
    );

    if (!existing) {
      created++;
    } else {
      updated++;
    }

    // Auto-trigger scoring the moment a match becomes FINISHED for the first time
    if (isFinished && !wasResultEntered) {
      try {
        await scoreMatch(doc._id);
        console.log(`[football-data] Auto-scored: ${doc.homeTeam} vs ${doc.awayTeam} (${fullTime.home}–${fullTime.away})`);
      } catch (err) {
        console.error(`[football-data] Auto-score failed for ${doc._id}:`, err.message);
      }
    }
  }

  return { created, updated };
}
