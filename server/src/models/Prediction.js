import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    predictedHomeScore: { type: Number, required: true, min: 0, integer: true },
    predictedAwayScore: { type: Number, required: true, min: 0, integer: true },
    // Required for knockout predictions when predicted scores are level
    predictedPenaltyWinner: { type: String, enum: ['home', 'away', null], default: null },
    pointsAwarded: { type: Number, default: null },
    scoredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });
predictionSchema.index({ matchId: 1 });

export default mongoose.model('Prediction', predictionSchema);
