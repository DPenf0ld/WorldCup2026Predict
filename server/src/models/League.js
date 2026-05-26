import mongoose from 'mongoose';

const leagueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    referralCodes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReferralCode' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('League', leagueSchema);
