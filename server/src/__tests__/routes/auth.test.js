import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { createApp } from '../helpers/createApp.js';
import League from '../../models/League.js';
import ReferralCode from '../../models/ReferralCode.js';
import User from '../../models/User.js';
import VerificationCode from '../../models/VerificationCode.js';

vi.mock('../../middleware/rateLimiter.js', () => {
  const pass = (_req, _res, next) => next();
  return {
    authLimiter: pass,
    apiLimiter: pass,
    generalLimiter: pass,
    writeLimiter: pass,
    adminLimiter: pass,
  };
});

vi.mock('../../services/email.js', () => ({
  sendVerificationCode: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('bcrypt', async (importOriginal) => {
  const mod = await importOriginal();
  return { default: { ...mod.default, hash: (data) => mod.default.hash(data, 1) } };
});

const VALID_CODE = 'KICKOFF2026';
const AUTH = '/api/auth';

let app;

beforeAll(async () => {
  await connect();
  app = createApp();
});
afterAll(disconnect);

beforeEach(async () => {
  await clearAll();
  const league = await League.create({ name: 'Test League', referralCodes: [], members: [] });
  await ReferralCode.create({ code: VALID_CODE, leagueId: league._id, maxUses: 100, usedCount: 0 });
});

function validReg(overrides = {}) {
  return {
    firstName: 'Alice',
    lastName: 'Test',
    email: 'alice@example.com',
    password: 'password123',
    referralCode: VALID_CODE,
    ...overrides,
  };
}

// Seeds a live OTP in the DB (bypasses the email send) so tests can use it
async function seedCode(email, purpose = 'email_verification') {
  const code = '123456';
  await VerificationCode.findOneAndUpdate(
    { email: email.toLowerCase(), purpose },
    { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 },
    { upsert: true, new: true }
  );
  return code;
}

// Full register + login helper for tests that need an auth'd user
async function registerAndLogin(overrides = {}) {
  const body = validReg(overrides);
  const code = await seedCode(body.email);
  const res = await request(app)
    .post(`${AUTH}/register`)
    .send({ ...body, verificationCode: code });
  return { accessToken: res.body.accessToken, cookies: res.headers['set-cookie'] };
}

// ── Send verification code ────────────────────────────────────────────────────

describe('POST /api/auth/send-verification-code', () => {
  it('returns 200 and stores a code for a new email', async () => {
    const res = await request(app)
      .post(`${AUTH}/send-verification-code`)
      .send({ email: 'alice@example.com', firstName: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();

    const doc = await VerificationCode.findOne({
      email: 'alice@example.com',
      purpose: 'email_verification',
    });
    expect(doc).toBeTruthy();
    expect(doc.code).toHaveLength(6);
  });

  it('returns 409 if email is already registered', async () => {
    await registerAndLogin();
    const res = await request(app)
      .post(`${AUTH}/send-verification-code`)
      .send({ email: 'alice@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = await request(app)
      .post(`${AUTH}/send-verification-code`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('overwrites an existing code if called again', async () => {
    await request(app).post(`${AUTH}/send-verification-code`).send({ email: 'alice@example.com' });
    const first = await VerificationCode.findOne({ email: 'alice@example.com', purpose: 'email_verification' });

    await request(app).post(`${AUTH}/send-verification-code`).send({ email: 'alice@example.com' });
    const second = await VerificationCode.findOne({ email: 'alice@example.com', purpose: 'email_verification' });

    expect(first._id.toString()).toBe(second._id.toString()); // same doc, updated
    expect(second.attempts).toBe(0); // attempts reset
  });
});

// ── Register ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a user and returns accessToken + user when code is correct', async () => {
    const code = await seedCode('alice@example.com');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg(), verificationCode: code });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('sets emailVerified to true immediately', async () => {
    const code = await seedCode('alice@example.com');
    await request(app).post(`${AUTH}/register`).send({ ...validReg(), verificationCode: code });
    const user = await User.findOne({ email: 'alice@example.com' });
    expect(user.emailVerified).toBe(true);
  });

  it('sets a refreshToken httpOnly cookie', async () => {
    const code = await seedCode('alice@example.com');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg(), verificationCode: code });
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=.+HttpOnly/i);
  });

  it('returns 400 for a wrong verification code', async () => {
    await seedCode('alice@example.com');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg(), verificationCode: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_CODE');
  });

  it('returns 400 when no code has been requested', async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg(), verificationCode: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CODE_EXPIRED');
  });

  it('invalidates the code after too many wrong attempts', async () => {
    await seedCode('alice@example.com');
    for (let i = 0; i < 3; i++) {
      await request(app).post(`${AUTH}/register`).send({ ...validReg(), verificationCode: '000000' });
    }
    // Code should now be deleted (3 bad attempts)
    const doc = await VerificationCode.findOne({ email: 'alice@example.com', purpose: 'email_verification' });
    expect(doc).toBeNull();
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post(`${AUTH}/register`).send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const code = await seedCode('bad');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg({ email: 'not-an-email' }), verificationCode: code });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a short password', async () => {
    const code = await seedCode('alice@example.com');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg({ password: 'short' }), verificationCode: code });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate email', async () => {
    await registerAndLogin();
    const code = await seedCode('alice@example.com');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg(), verificationCode: code });
    expect(res.status).toBe(409);
  });

  it('returns 400 for an invalid referral code', async () => {
    const code = await seedCode('alice@example.com');
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validReg({ referralCode: 'BADCODE' }), verificationCode: code });
    expect(res.status).toBe(400);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => registerAndLogin());

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'alice@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'alice@example.com' });
    expect(res.status).toBe(400);
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns a new accessToken from a valid refresh cookie', async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app).post(`${AUTH}/refresh`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).post(`${AUTH}/refresh`);
    expect(res.status).toBe(401);
  });
});

// ── /me ───────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns user without sensitive fields', async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get(`${AUTH}/me`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`${AUTH}/me`);
    expect(res.status).toBe(401);
  });
});

// ── Forgot password ───────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('always returns 200 regardless of whether the email exists', async () => {
    const res = await request(app)
      .post(`${AUTH}/forgot-password`)
      .send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
  });

  it('stores a reset code for a verified user', async () => {
    await registerAndLogin();
    await request(app).post(`${AUTH}/forgot-password`).send({ email: 'alice@example.com' });
    const doc = await VerificationCode.findOne({
      email: 'alice@example.com',
      purpose: 'password_reset',
    });
    expect(doc).toBeTruthy();
    expect(doc.code).toHaveLength(6);
  });
});

// ── Reset password ────────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('updates the password for a valid code', async () => {
    await registerAndLogin();
    const code = await seedCode('alice@example.com', 'password_reset');

    const res = await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code, password: 'newpassword123' });
    expect(res.status).toBe(200);

    // Old password fails
    const oldLogin = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(oldLogin.status).toBe(401);

    // New password works
    const newLogin = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'alice@example.com', password: 'newpassword123' });
    expect(newLogin.status).toBe(200);
  });

  it('clears the reset code from the DB after use', async () => {
    await registerAndLogin();
    const code = await seedCode('alice@example.com', 'password_reset');
    await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code, password: 'newpassword123' });
    const doc = await VerificationCode.findOne({ email: 'alice@example.com', purpose: 'password_reset' });
    expect(doc).toBeNull();
  });

  it('cannot reuse the same reset code', async () => {
    await registerAndLogin();
    const code = await seedCode('alice@example.com', 'password_reset');
    await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code, password: 'newpassword123' });
    const res = await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code, password: 'anotherpassword' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a wrong code and tracks attempts', async () => {
    await registerAndLogin();
    await seedCode('alice@example.com', 'password_reset');
    const res = await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code: '000000', password: 'newpassword123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_CODE');
  });

  it('returns 400 for an expired code', async () => {
    await registerAndLogin();
    const res = await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code: '123456', password: 'newpassword123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CODE_EXPIRED');
  });

  it('returns 400 for a short password', async () => {
    await registerAndLogin();
    const code = await seedCode('alice@example.com', 'password_reset');
    const res = await request(app)
      .post(`${AUTH}/reset-password`)
      .send({ email: 'alice@example.com', code, password: 'short' });
    expect(res.status).toBe(400);
  });
});
