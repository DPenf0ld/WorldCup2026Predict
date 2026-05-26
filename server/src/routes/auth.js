import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import League from '../models/League.js';
import ReferralCode from '../models/ReferralCode.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

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

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    if (!name || !email || !password || !referralCode) {
      return res.status(400).json({ error: 'name, email, password and referralCode are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

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
    const user = await User.create({ name, email, passwordHash, leagues: [codeDoc.leagueId] });

    codeDoc.usedCount += 1;
    await codeDoc.save();

    await League.findByIdAndUpdate(codeDoc.leagueId, { $addToSet: { members: user._id } });

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

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
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

router.post('/refresh', async (req, res) => {
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

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ message: 'Logged out' });
});

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
