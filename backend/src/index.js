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
import { router as waysRouter } from './routes/ways.js';
import { router as jangkauanRouter } from './routes/jangkauan.js';
import { router as aiRouter } from './routes/ai.js';
import { rateLimit } from './rateLimit.js';
import { UPLOAD_DIR, MAKS_FOTO_MB } from './storage.js';

const app = express();

// Catatan di rateLimit.js: di balik proxy, req.ip harus membaca X-Forwarded-For.
// Tanpa ini semua pengguna di Vercel terbaca sebagai satu IP dan saling menghabiskan jatah.
app.set('trust proxy', 1);

// Daftar origin yang dipatok satu port bikin jebakan saat pengembangan: Vite diam-diam
// pindah ke 5174 kalau 5173 sedang dipakai, lalu SELURUH aplikasi tampak "tidak dapat
// terhubung ke server" padahal backend sehat dan membalas 200 ke curl. Di pengembangan,
// port localhost mana pun diterima. Di produksi CORS_ORIGIN tetap mengikat.
const originTerdaftar = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
const ORIGIN_LOKAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
  origin(origin, cb) {
    // Tanpa header Origin: curl, health check, panggilan antar-server.
    if (!origin) return cb(null, true);
    if (!originTerdaftar?.length) return cb(null, true);
    if (originTerdaftar.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== 'production' && ORIGIN_LOKAL.test(origin)) return cb(null, true);
    return cb(null, false);
  },
}));
// Header keamanan dasar, ditulis tangan alih-alih menambah helmet: yang benar-benar
// berlaku untuk API JSON + folder foto hanya tiga baris ini, dan satu dependensi lagi
// berarti satu lagi yang harus dipercaya dan diperbarui.
//
// nosniff yang paling penting di sini: /uploads menyajikan berkas kiriman pengguna dari
// origin yang sama dengan API. Isinya sudah diperiksa lewat magic bytes dan namanya
// dibuat server, jadi jalurnya sudah sempit — ini lapis keduanya, bukan satu-satunya.
app.disable('x-powered-by'); // tidak perlu mengumumkan server apa yang dipakai
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY'); // tidak ada halaman di sini yang perlu dibingkai
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Foto dimuat oleh frontend yang beda origin; tanpa ini sebagian browser memblokirnya.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

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
app.use('/api', waysRouter);
app.use('/api', jangkauanRouter);
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

// CORS_ORIGIN kosong berarti SEMUA origin diterima (lihat pemeriksa di atas). Itu
// sengaja, supaya pengembangan tidak terhambat — tapi di produksi artinya situs mana
// pun bisa memanggil API ini dengan token pengguna yang kebetulan tersimpan. Gagalnya
// tidak terlihat: semuanya jalan normal. Jadi diteriakkan, bukan didiamkan.
if (process.env.NODE_ENV === 'production' && !originTerdaftar?.length) {
  console.error('[PERINGATAN KEAMANAN] CORS_ORIGIN belum diisi di produksi — API menerima permintaan dari origin mana pun. Isi dengan domain frontend Anda.');
}
