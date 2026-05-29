// Trims all string fields in req.body and rejects any nested object values.
// Nested objects are the NoSQL injection vector ($gt, $where, etc.) — flat
// key/value bodies are all this API ever needs.
export function sanitizeBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();

  for (const [key, val] of Object.entries(req.body)) {
    if (typeof val === 'string') {
      req.body[key] = val.trim();
    } else if (val !== null && !Array.isArray(val) && typeof val === 'object') {
      return res.status(400).json({ error: 'Invalid input' });
    }
  }
  next();
}
