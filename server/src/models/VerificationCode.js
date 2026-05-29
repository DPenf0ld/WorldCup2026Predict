import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  purpose: {
    type: String,
    enum: ['email_verification', 'password_reset'],
    required: true,
  },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
});

// One active code per email per purpose — sending a new code overwrites the old one
verificationCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });

// MongoDB automatically deletes documents once expiresAt is in the past
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('VerificationCode', verificationCodeSchema);
