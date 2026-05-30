import mongoose from 'mongoose';
import { STAGES } from '../config/constants.js';

const matchSchema = new mongoose.Schema(
  {
    homeTeam: { type: String, required: true, trim: true },
    awayTeam: { type: String, required: true, trim: true },
    stage: { type: String, enum: Object.values(STAGES), required: true },
    group: { type: String, trim: true }, // e.g. 'A' — only set for GROUP stage
    kickoffTime: { type: Date, required: true },
    predictionDeadline: { type: Date, required: true },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    // For knockout matches where scores are level after extra time
    penaltyWinner: { type: String, enum: ['home', 'away', null], default: null },
    resultEntered: { type: Boolean, default: false },
    // Fields populated by the football-data.org sync
    externalId: { type: Number, unique: true, sparse: true },
    venue: { type: String, trim: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    halfTimeScore: {
      home: { type: Number, default: null },
      away: { type: Number, default: null },
    },
    fullTimeScore: {
      home: { type: Number, default: null },
      away: { type: Number, default: null },
    },
    lastSynced: { type: Date, default: null },
  },
  { timestamps: true }
);

matchSchema.index({ kickoffTime: 1 });
matchSchema.index({ stage: 1 });
matchSchema.index({ status: 1 });

export default mongoose.model('Match', matchSchema);
