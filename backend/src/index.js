import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { optionalAuth, router as authRouter } from './auth.js';
import { router as facilitiesRouter } from './routes/facilities.js';
import { router as meRouter } from './routes/me.js';
import { router as contributionsRouter } from './routes/contributions.js';
import { router as feedbackRouter } from './routes/feedback.js';
import { router as adminRouter } from './routes/admin.js';
import { router as routingRouter } from './routes/routing.js';
import { router as aiRouter } from './routes/ai.js';
import { rateLimit } from './rateLimit.js';
import { UPLOAD_DIR, MAKS_FOTO_MB } from './storage.js';

const app = express();

// Catatan di rateLimit.js: di balik proxy, req.ip harus membaca X-Forwarded-For.
// Tanpa ini semua pengguna di Vercel terbaca sebagai satu IP dan saling menghabiskan jatah.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(optionalAuth); // guest tetap boleh lewat, req.user cuma diisi kalau ada token

app.get('/api/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' })); // foto lokal (dev)
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 40 }), authRouter);
app.use('/api', facilitiesRouter);
app.use('/api', meRouter);
app.use('/api', contributionsRouter);
app.use('/api', feedbackRouter);
app.use('/api', adminRouter);
app.use('/api', routingRouter);
app.use('/api', aiRouter);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ada' }));

// Express 5 meneruskan rejection dari handler async ke sini sendiri — tanpa wrapper per-route.
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Input tidak valid', issues: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  if (err.status) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Ukuran foto maksimal ${MAKS_FOTO_MB} MB` });
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Maksimal 3 foto' });
  if (err.code === '23505') return res.status(409).json({ error: 'Data sudah ada' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referensi data tidak ditemukan' });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

// Di Vercel tidak ada proses yang hidup terus: app diekspor sebagai handler, tidak listen.
// Entry serverless-nya api/index.js, routing-nya vercel.json.
export default app;

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`AksesKota API -> http://localhost:${port}/api/health`));
} else if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  // Tanpa Supabase Storage, savePhoto() jatuh ke folder ./uploads. Di serverless folder itu
  // sementara dan tidak dibagi antar instance, jadi foto kontribusi akan hilang diam-diam.
  console.error('[FATAL] SUPABASE_URL/SUPABASE_SERVICE_KEY wajib di Vercel — tanpa itu foto kontribusi hilang.');
}
