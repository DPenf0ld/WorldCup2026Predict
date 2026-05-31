/**
 * One-off migration: recalculates predictionDeadline for all matches using the
 * updated constants (1 hour before kickoff for group stage; 1 hour before the
 * stage opens for knockout stages). Safe to run on a live DB — only touches
 * predictionDeadline, nothing else.
 *
 * Usage: npm run migrate:deadlines (from /server)
 */

import 'dotenv/config';
import { setServers } from 'dns';
setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import Match from '../models/Match.js';
import { STAGES, KNOCKOUT_DEADLINES, GROUP_STAGE_DEADLINE_OFFSET_MS } from '../config/constants.js';

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const matches = await Match.find({}, { _id: 1, stage: 1, kickoffTime: 1, predictionDeadline: 1 }).lean();
  console.log(`Found ${matches.length} matches to process`);

  let updated = 0;
  let skipped = 0;

  for (const match of matches) {
    let newDeadline;

    if (match.stage === STAGES.GROUP) {
      newDeadline = new Date(match.kickoffTime.getTime() - GROUP_STAGE_DEADLINE_OFFSET_MS);
    } else {
      newDeadline = KNOCKOUT_DEADLINES[match.stage];
      if (!newDeadline) {
        console.warn(`  Skipping unknown stage "${match.stage}" for match ${match._id}`);
        skipped++;
        continue;
      }
    }

    if (match.predictionDeadline?.getTime() === newDeadline.getTime()) {
      skipped++;
      continue;
    }

    await Match.updateOne({ _id: match._id }, { $set: { predictionDeadline: newDeadline } });
    updated++;
  }

  console.log(`\nMigration complete: ${updated} updated, ${skipped} already correct or skipped`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
