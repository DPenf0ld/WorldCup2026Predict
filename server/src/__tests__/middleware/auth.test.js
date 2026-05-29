import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../middleware/auth.js';

// JWT_ACCESS_SECRET set in setup.js
const SECRET = 'test-access-secret';

function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe('authenticate middleware', () => {
  it('rejects with 401 when Authorization header is missing', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/missing or invalid/i);
  });

  it('rejects with 401 when Authorization header is not Bearer', () => {
    const req = makeReq('Basic dXNlcjpwYXNz');
    const res = makeRes();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('rejects with 401 for a malformed token', () => {
    const req = makeReq('Bearer not-a-valid-token');
    const res = makeRes();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/expired or invalid/i);
  });

  it('rejects with 401 for a token signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'uid', email: 'x@x.com' }, 'wrong-secret', { expiresIn: '15m' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('sets req.user and calls next() for a valid token', () => {
    const userId = '507f1f77bcf86cd799439011';
    const token = jwt.sign({ sub: userId, email: 'alice@example.com' }, SECRET, { expiresIn: '15m' });

    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    let called = false;
    authenticate(req, res, () => { called = true; });

    expect(called).toBe(true);
    expect(req.user).toEqual({ id: userId, email: 'alice@example.com' });
  });
});
