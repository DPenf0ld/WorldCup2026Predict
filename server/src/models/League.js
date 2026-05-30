import mongoose from 'mongoose';

export const VALID_ENTRY_FEES = [0, 5, 10, 20, 50];

const leagueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    entryFee: { type: Number, default: 0, enum: VALID_ENTRY_FEES },
    referralCodes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReferralCode' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('League', leagueSchema);
