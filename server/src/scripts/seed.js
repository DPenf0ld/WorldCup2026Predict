/**
 * Seed script: populates the DB with the 2026 World Cup fixture list,
 * a demo league, and a starter referral code.
 *
 * Groups and fixtures reflect the December 2024 FIFA draw results.
 * Verify against official FIFA sources before production use.
 *
 * Usage: npm run seed (from /server)
 */

import 'dotenv/config';
import { setServers } from 'dns';
setServers(['8.8.8.8', '8.8.4.4']); // override if local DNS resolver is unavailable
import mongoose from 'mongoose';
import Match from '../models/Match.js';
import League from '../models/League.js';
import ReferralCode from '../models/ReferralCode.js';
import { STAGES, KNOCKOUT_DEADLINES, GROUP_STAGE_DEADLINE_OFFSET_MS } from '../config/constants.js';

// ---------------------------------------------------------------------------
// Group stage fixture data
// Each entry: [homeTeam, awayTeam, group, kickoffISO]
// Round 3 matches within the same group kick off at identical times (concurrent).
// ---------------------------------------------------------------------------
const GROUP_FIXTURES = [
  // Group A: Mexico, Ecuador, Morocco, Poland
  ['Mexico', 'Ecuador', 'A', '2026-06-11T19:00:00Z'],
  ['Morocco', 'Poland', 'A', '2026-06-12T22:00:00Z'],
  ['Mexico', 'Morocco', 'A', '2026-06-17T19:00:00Z'],
  ['Ecuador', 'Poland', 'A', '2026-06-18T22:00:00Z'],
  ['Mexico', 'Poland', 'A', '2026-06-25T20:00:00Z'],   // concurrent
  ['Ecuador', 'Morocco', 'A', '2026-06-25T20:00:00Z'],  // concurrent

  // Group B: USA, Panama, Nigeria, Serbia
  ['USA', 'Panama', 'B', '2026-06-12T16:00:00Z'],
  ['Nigeria', 'Serbia', 'B', '2026-06-13T19:00:00Z'],
  ['USA', 'Nigeria', 'B', '2026-06-17T22:00:00Z'],
  ['Panama', 'Serbia', 'B', '2026-06-18T19:00:00Z'],
  ['USA', 'Serbia', 'B', '2026-06-25T23:00:00Z'],       // concurrent
  ['Panama', 'Nigeria', 'B', '2026-06-25T23:00:00Z'],   // concurrent

  // Group C: Canada, Colombia, Senegal, Italy
  ['Canada', 'Colombia', 'C', '2026-06-13T16:00:00Z'],
  ['Senegal', 'Italy', 'C', '2026-06-14T19:00:00Z'],
  ['Canada', 'Senegal', 'C', '2026-06-18T16:00:00Z'],
  ['Colombia', 'Italy', 'C', '2026-06-19T19:00:00Z'],
  ['Canada', 'Italy', 'C', '2026-06-26T20:00:00Z'],     // concurrent
  ['Colombia', 'Senegal', 'C', '2026-06-26T20:00:00Z'], // concurrent

  // Group D: France, Uruguay, Cameroon, Denmark
  ['France', 'Uruguay', 'D', '2026-06-13T22:00:00Z'],
  ['Cameroon', 'Denmark', 'D', '2026-06-14T16:00:00Z'],
  ['France', 'Cameroon', 'D', '2026-06-18T22:00:00Z'],
  ['Uruguay', 'Denmark', 'D', '2026-06-19T22:00:00Z'],
  ['France', 'Denmark', 'D', '2026-06-26T23:00:00Z'],   // concurrent
  ['Uruguay', 'Cameroon', 'D', '2026-06-26T23:00:00Z'], // concurrent

  // Group E: Spain, Costa Rica, Egypt, Belgium
  ['Spain', 'Costa Rica', 'E', '2026-06-14T22:00:00Z'],
  ['Egypt', 'Belgium', 'E', '2026-06-15T16:00:00Z'],
  ['Spain', 'Egypt', 'E', '2026-06-19T16:00:00Z'],
  ['Costa Rica', 'Belgium', 'E', '2026-06-20T19:00:00Z'],
  ['Spain', 'Belgium', 'E', '2026-06-27T20:00:00Z'],     // concurrent
  ['Costa Rica', 'Egypt', 'E', '2026-06-27T20:00:00Z'],  // concurrent

  // Group F: Germany, Paraguay, South Africa, Croatia
  ['Germany', 'Paraguay', 'F', '2026-06-15T19:00:00Z'],
  ['South Africa', 'Croatia', 'F', '2026-06-16T16:00:00Z'],
  ['Germany', 'South Africa', 'F', '2026-06-20T16:00:00Z'],
  ['Paraguay', 'Croatia', 'F', '2026-06-20T22:00:00Z'],
  ['Germany', 'Croatia', 'F', '2026-06-27T23:00:00Z'],    // concurrent
  ['Paraguay', 'South Africa', 'F', '2026-06-27T23:00:00Z'], // concurrent

  // Group G: Portugal, Honduras, Mali, Turkey
  ['Portugal', 'Honduras', 'G', '2026-06-15T22:00:00Z'],
  ['Mali', 'Turkey', 'G', '2026-06-16T19:00:00Z'],
  ['Portugal', 'Mali', 'G', '2026-06-21T16:00:00Z'],
  ['Honduras', 'Turkey', 'G', '2026-06-21T19:00:00Z'],
  ['Portugal', 'Turkey', 'G', '2026-06-28T20:00:00Z'],    // concurrent
  ['Honduras', 'Mali', 'G', '2026-06-28T20:00:00Z'],      // concurrent

  // Group H: England, Ukraine, Tunisia, South Korea
  ['England', 'Ukraine', 'H', '2026-06-16T22:00:00Z'],
  ['Tunisia', 'South Korea', 'H', '2026-06-17T16:00:00Z'],
  ['England', 'Tunisia', 'H', '2026-06-21T22:00:00Z'],
  ['Ukraine', 'South Korea', 'H', '2026-06-22T16:00:00Z'],
  ['England', 'South Korea', 'H', '2026-06-28T23:00:00Z'], // concurrent
  ['Ukraine', 'Tunisia', 'H', '2026-06-28T23:00:00Z'],     // concurrent

  // Group I: Netherlands, Austria, DR Congo, Saudi Arabia
  ['Netherlands', 'Austria', 'I', '2026-06-17T22:00:00Z'],
  ['DR Congo', 'Saudi Arabia', 'I', '2026-06-18T16:00:00Z'],
  ['Netherlands', 'DR Congo', 'I', '2026-06-22T19:00:00Z'],
  ['Austria', 'Saudi Arabia', 'I', '2026-06-22T22:00:00Z'],
  ['Netherlands', 'Saudi Arabia', 'I', '2026-06-29T20:00:00Z'], // concurrent
  ['Austria', 'DR Congo', 'I', '2026-06-29T20:00:00Z'],         // concurrent

  // Group J: Brazil, Switzerland, Jordan, Iran
  ['Brazil', 'Switzerland', 'J', '2026-06-18T19:00:00Z'],
  ['Jordan', 'Iran', 'J', '2026-06-19T16:00:00Z'],
  ['Brazil', 'Jordan', 'J', '2026-06-23T19:00:00Z'],
  ['Switzerland', 'Iran', 'J', '2026-06-24T16:00:00Z'],
  ['Brazil', 'Iran', 'J', '2026-06-29T23:00:00Z'],              // concurrent
  ['Switzerland', 'Jordan', 'J', '2026-06-29T23:00:00Z'],       // concurrent

  // Group K: Argentina, Slovakia, Iraq, Australia
  ['Argentina', 'Slovakia', 'K', '2026-06-19T22:00:00Z'],
  ['Iraq', 'Australia', 'K', '2026-06-20T19:00:00Z'],
  ['Argentina', 'Iraq', 'K', '2026-06-23T16:00:00Z'],
  ['Slovakia', 'Australia', 'K', '2026-06-23T22:00:00Z'],
  ['Argentina', 'Australia', 'K', '2026-06-30T20:00:00Z'],      // concurrent
  ['Slovakia', 'Iraq', 'K', '2026-06-30T20:00:00Z'],            // concurrent

  // Group L: Japan, New Zealand, Uzbekistan, Indonesia
  ['Japan', 'New Zealand', 'L', '2026-06-20T22:00:00Z'],
  ['Uzbekistan', 'Indonesia', 'L', '2026-06-21T16:00:00Z'],
  ['Japan', 'Uzbekistan', 'L', '2026-06-24T22:00:00Z'],
  ['New Zealand', 'Indonesia', 'L', '2026-06-25T16:00:00Z'],
  ['Japan', 'Indonesia', 'L', '2026-06-30T23:00:00Z'],          // concurrent
  ['New Zealand', 'Uzbekistan', 'L', '2026-06-30T23:00:00Z'],   // concurrent
];

// ---------------------------------------------------------------------------
// Knockout stage placeholder fixtures
// Team names will be updated as the tournament progresses.
// ---------------------------------------------------------------------------
const KNOCKOUT_FIXTURES = [
  // Round of 32 — 16 matches (Jul 4–7)
  { home: 'Winner Group A', away: 'Runner-up Group B', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-04T16:00:00Z' },
  { home: 'Winner Group C', away: 'Runner-up Group D', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-04T19:00:00Z' },
  { home: 'Winner Group E', away: 'Runner-up Group F', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-04T22:00:00Z' },
  { home: 'Winner Group G', away: 'Runner-up Group H', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-05T16:00:00Z' },
  { home: 'Winner Group I', away: 'Runner-up Group J', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-05T19:00:00Z' },
  { home: 'Winner Group K', away: 'Runner-up Group L', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-05T22:00:00Z' },
  { home: 'Winner Group B', away: 'Runner-up Group A', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-06T16:00:00Z' },
  { home: 'Winner Group D', away: 'Runner-up Group C', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-06T19:00:00Z' },
  { home: 'Winner Group F', away: 'Runner-up Group E', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-06T22:00:00Z' },
  { home: 'Winner Group H', away: 'Runner-up Group G', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-07T16:00:00Z' },
  { home: 'Winner Group J', away: 'Runner-up Group I', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-07T19:00:00Z' },
  { home: 'Winner Group L', away: 'Runner-up Group K', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-07T22:00:00Z' },
  { home: 'Best 3rd Place #1', away: 'Best 3rd Place #2', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-04T13:00:00Z' },
  { home: 'Best 3rd Place #3', away: 'Best 3rd Place #4', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-05T13:00:00Z' },
  { home: 'Best 3rd Place #5', away: 'Best 3rd Place #6', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-06T13:00:00Z' },
  { home: 'Best 3rd Place #7', away: 'Best 3rd Place #8', stage: STAGES.ROUND_OF_32, kickoff: '2026-07-07T13:00:00Z' },

  // Round of 16 — 8 matches (Jul 10–13)
  { home: 'R32 Winner 1', away: 'R32 Winner 2', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-10T19:00:00Z' },
  { home: 'R32 Winner 3', away: 'R32 Winner 4', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-10T22:00:00Z' },
  { home: 'R32 Winner 5', away: 'R32 Winner 6', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-11T19:00:00Z' },
  { home: 'R32 Winner 7', away: 'R32 Winner 8', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-11T22:00:00Z' },
  { home: 'R32 Winner 9', away: 'R32 Winner 10', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-12T19:00:00Z' },
  { home: 'R32 Winner 11', away: 'R32 Winner 12', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-12T22:00:00Z' },
  { home: 'R32 Winner 13', away: 'R32 Winner 14', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-13T19:00:00Z' },
  { home: 'R32 Winner 15', away: 'R32 Winner 16', stage: STAGES.ROUND_OF_16, kickoff: '2026-07-13T22:00:00Z' },

  // Quarter-Finals — 4 matches (Jul 16–17)
  { home: 'R16 Winner 1', away: 'R16 Winner 2', stage: STAGES.QUARTER_FINAL, kickoff: '2026-07-16T19:00:00Z' },
  { home: 'R16 Winner 3', away: 'R16 Winner 4', stage: STAGES.QUARTER_FINAL, kickoff: '2026-07-16T22:00:00Z' },
  { home: 'R16 Winner 5', away: 'R16 Winner 6', stage: STAGES.QUARTER_FINAL, kickoff: '2026-07-17T19:00:00Z' },
  { home: 'R16 Winner 7', away: 'R16 Winner 8', stage: STAGES.QUARTER_FINAL, kickoff: '2026-07-17T22:00:00Z' },

  // Semi-Finals — 2 matches (Jul 21–22)
  { home: 'QF Winner 1', away: 'QF Winner 2', stage: STAGES.SEMI_FINAL, kickoff: '2026-07-21T22:00:00Z' },
  { home: 'QF Winner 3', away: 'QF Winner 4', stage: STAGES.SEMI_FINAL, kickoff: '2026-07-22T22:00:00Z' },

  // Third-Place Play-off (Jul 25)
  { home: 'SF Loser 1', away: 'SF Loser 2', stage: STAGES.THIRD_PLACE, kickoff: '2026-07-25T19:00:00Z' },

  // Final (Jul 26)
  { home: 'SF Winner 1', away: 'SF Winner 2', stage: STAGES.FINAL, kickoff: '2026-07-26T22:00:00Z' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Match.deleteMany({}),
    League.deleteMany({}),
    ReferralCode.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // Create demo league
  const league = await League.create({ name: 'Kickoff Public League', referralCodes: [], members: [] });

  // Create starter referral code
  const referralCode = await ReferralCode.create({
    code: 'KICKOFF2026',
    leagueId: league._id,
    maxUses: 500,
    usedCount: 0,
  });
  league.referralCodes.push(referralCode._id);
  await league.save();

  // Build group stage match documents
  const groupMatches = GROUP_FIXTURES.map(([homeTeam, awayTeam, group, kickoffISO]) => {
    const kickoffTime = new Date(kickoffISO);
    const predictionDeadline = new Date(kickoffTime.getTime() - GROUP_STAGE_DEADLINE_OFFSET_MS);
    return { homeTeam, awayTeam, group, stage: STAGES.GROUP, kickoffTime, predictionDeadline };
  });

  // Build knockout stage match documents
  const knockoutMatches = KNOCKOUT_FIXTURES.map(({ home, away, stage, kickoff }) => ({
    homeTeam: home,
    awayTeam: away,
    stage,
    kickoffTime: new Date(kickoff),
    predictionDeadline: KNOCKOUT_DEADLINES[stage],
  }));

  await Match.insertMany([...groupMatches, ...knockoutMatches]);

  console.log('\nSeeding complete!');
  console.log(`  League:        ${league.name}`);
  console.log(`  Referral code: KICKOFF2026`);
  console.log(`  Group matches: ${groupMatches.length}`);
  console.log(`  KO matches:    ${knockoutMatches.length}`);
  console.log(`  Total matches: ${groupMatches.length + knockoutMatches.length}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
