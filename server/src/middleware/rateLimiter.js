import rateLimit from 'express-rate-limit';

// Applied globally — generous ceiling to stop scrapers and abuse
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Applied only to login/register/refresh — tight limit to slow brute-force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts from this IP. Please try again in 15 minutes.' },
});

// Applied to standard read endpoints — 30 req/min per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});

// Applied to write operations (predictions, league join) — 10 req/min per IP
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests. Please slow down.' },
});

// Applied to admin endpoints — 60 req/min per IP (secret header is the primary gate)
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please try again in a minute.' },
});
