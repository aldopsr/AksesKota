import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { optionalAuth, router as authRouter } from './auth.js';
import { router as facilitiesRouter } from './routes/facilities.js';
import { router as profileRouter } from './routes/profile.js';
import { router as contribRouter, adminRouter } from './routes/contributions.js';
import { router as aiRouter } from './routes/ai.js';
import { router as routeRouter } from './routes/route.js';
import { router as communityRouter, adminRouter as communityAdminRouter } from './routes/community.js';

const app = express();

// Di belakang proxy Vercel, req.ip harus membaca X-Forwarded-For — dipakai kuota AI untuk Guest.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(optionalAuth); // guest tetap boleh lewat, req.user cuma diisi kalau ada token

app.get('/api/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', communityAdminRouter);
app.use('/api/ai', aiRouter);
app.use('/api/route', routeRouter);
app.use('/api', contribRouter);
app.use('/api', communityRouter);
app.use('/api', facilitiesRouter);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ada' }));

// Express 5 meneruskan rejection dari handler async ke sini sendiri — tanpa wrapper per-route.
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Input tidak valid', issues: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  if (err.code === '23505') return res.status(409).json({ error: 'Data sudah ada' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referensi data tidak ditemukan' });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

// Di Vercel tidak ada proses yang hidup terus: app diekspor sebagai handler, tidak listen.
export default app;

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`AksesKota API -> http://localhost:${port}/api/health`));
}
