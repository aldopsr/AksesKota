// Rate limit sederhana di memori (cukup untuk 1 instance). Kunci: user id, atau IP untuk guest.
// Untuk deploy multi-instance / di balik proxy, ganti dengan store bersama dan set `trust proxy`.
import { HttpError } from './http.js';

export function rateLimit({ windowMs, max, key = (req) => req.user?.id ?? req.ip }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, _res, next) => {
    const k = String(key(req));
    const now = Date.now();
    const h = hits.get(k);
    if (!h || h.reset <= now) hits.set(k, { count: 1, reset: now + windowMs });
    else if (++h.count > max) throw new HttpError(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
    next();
  };
}
