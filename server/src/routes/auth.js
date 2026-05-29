import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import League from '../models/League.js';
import ReferralCode from '../models/ReferralCode.js';
import VerificationCode from '../models/VerificationCode.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import { sendVerificationCode, sendPasswordResetCode } from '../services/email.js';

const router = Router();

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signAccess(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth/refresh',
  });
}

// Cryptographically secure 6-digit code
function genCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

// ── Send verification code (called before registration) ───────────────────────

router.post('/send-verification-code', authLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const code = genCode();
    await VerificationCode.findOneAndUpdate(
      { email: email.toLowerCase(), purpose: 'email_verification' },
      { code, expiresAt: new Date(Date.now() + CODE_EXPIRY_MS), attempts: 0 },
      { upsert: true, new: true }
    );

    try {
      await sendVerificationCode(email, name || 'there', code);
    } catch (emailErr) {
      console.error('[auth] Failed to send verification email:', emailErr.message);
      return res.status(502).json({ error: 'Could not send verification email. Please try again shortly.' });
    }

    res.json({ message: 'Verification code sent. Check your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// ── Register ──────────────────────────────────────────────────────────────────

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, referralCode, verificationCode } = req.body;

    if (!name || !email || !password || !referralCode || !verificationCode) {
      return res.status(400).json({
        error: 'name, email, password, referralCode and verificationCode are all required',
      });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > 72) {
      return res.status(400).json({ error: 'Password must be 72 characters or fewer' });
    }
    if (referralCode.length > 50) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    // Validate the verification code
    const pending = await VerificationCode.findOne({
      email: email.toLowerCase(),
      purpose: 'email_verification',
      expiresAt: { $gt: new Date() },
    });

    if (!pending) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new one.',
        code: 'CODE_EXPIRED',
      });
    }

    if (pending.code !== verificationCode) {
      pending.attempts += 1;
      const left = MAX_ATTEMPTS - pending.attempts;
      if (left <= 0) {
        await VerificationCode.deleteOne({ _id: pending._id });
      } else {
        await pending.save();
      }
      return res.status(400).json({
        error: left > 0
          ? `Incorrect code — ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
        code: left > 0 ? 'WRONG_CODE' : 'TOO_MANY_ATTEMPTS',
      });
    }

    // Code valid — check email and referral code
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const codeDoc = await ReferralCode.findOne({ code: referralCode.toUpperCase() });
    if (!codeDoc) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }
    if (codeDoc.usedCount >= codeDoc.maxUses) {
      return res.status(400).json({ error: 'Referral code has reached its maximum uses' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name,
      email,
      passwordHash,
      leagues: [codeDoc.leagueId],
      emailVerified: true, // verified via OTP above
    });

    codeDoc.usedCount += 1;
    await codeDoc.save();
    await League.findByIdAndUpdate(codeDoc.leagueId, { $addToSet: { members: user._id } });
    await VerificationCode.deleteOne({ _id: pending._id });
    await user.populate('leagues', 'name');

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, leagues: user.leagues },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).populate('leagues', 'name');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, leagues: user.leagues },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Forgot password — sends a 6-digit reset code ──────────────────────────────

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond the same way — don't reveal whether the account exists
    if (user && user.emailVerified) {
      const code = genCode();
      await VerificationCode.findOneAndUpdate(
        { email: email.toLowerCase(), purpose: 'password_reset' },
        { code, expiresAt: new Date(Date.now() + CODE_EXPIRY_MS), attempts: 0 },
        { upsert: true, new: true }
      );
      sendPasswordResetCode(user.email, user.name, code).catch(console.error);
    }

    res.json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reset code' });
  }
});

// ── Reset password — validates code and sets new password ─────────────────────

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ error: 'email, code and password are all required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > 72) {
      return res.status(400).json({ error: 'Password must be 72 characters or fewer' });
    }

    const pending = await VerificationCode.findOne({
      email: email.toLowerCase(),
      purpose: 'password_reset',
      expiresAt: { $gt: new Date() },
    });

    if (!pending) {
      return res.status(400).json({
        error: 'Reset code has expired. Please request a new one.',
        code: 'CODE_EXPIRED',
      });
    }

    if (pending.code !== code) {
      pending.attempts += 1;
      const left = MAX_ATTEMPTS - pending.attempts;
      if (left <= 0) {
        await VerificationCode.deleteOne({ _id: pending._id });
      } else {
        await pending.save();
      }
      return res.status(400).json({
        error: left > 0
          ? `Incorrect code — ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
        code: left > 0 ? 'WRONG_CODE' : 'TOO_MANY_ATTEMPTS',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Account not found.' });
    }

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await user.save();
    await VerificationCode.deleteOne({ _id: pending._id });

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── Refresh token ─────────────────────────────────────────────────────────────

router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const accessToken = signAccess(user);
    const newRefresh = signRefresh(user);
    setRefreshCookie(res, newRefresh);

    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ message: 'Logged out' });
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash').populate('leagues', 'name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
