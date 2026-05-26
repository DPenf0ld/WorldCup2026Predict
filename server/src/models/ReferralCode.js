import mongoose from 'mongoose';

const referralCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
    maxUses: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('ReferralCode', referralCodeSchema);
