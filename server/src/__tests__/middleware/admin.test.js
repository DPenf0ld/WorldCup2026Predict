import { describe, it, expect } from 'vitest';
import { requireAdmin } from '../../middleware/admin.js';

// ADMIN_SECRET set in setup.js
const CORRECT_SECRET = 'test-admin-secret';

function makeReq(headers = {}) {
  return { headers };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe('requireAdmin middleware', () => {
  it('returns 403 when x-admin-secret header is absent', () => {
    const req = makeReq({});
    const res = makeRes();
    requireAdmin(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('returns 403 for an incorrect secret', () => {
    const req = makeReq({ 'x-admin-secret': 'wrong-secret' });
    const res = makeRes();
    requireAdmin(req, res, () => {});
    expect(res.statusCode).toBe(403);
  });

  it('calls next() when the correct secret is provided', () => {
    const req = makeReq({ 'x-admin-secret': CORRECT_SECRET });
    const res = makeRes();
    let called = false;
    requireAdmin(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.statusCode).toBeNull();
  });
});
