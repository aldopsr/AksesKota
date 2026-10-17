import pg from 'pg';

// Supabase pooler butuh SSL tapi sertifikatnya tidak ada di trust store Node.
const needsSsl = /supabase|render|neon|heroku/.test(process.env.DATABASE_URL ?? '');

// Di Vercel setiap instance serverless punya pool sendiri dan bisa ada puluhan sekaligus.
// max: 1 + connection string ke port 6543 (transaction pooler Supabase) supaya kuota
// koneksi database tidak habis saat beberapa request datang bersamaan.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: process.env.VERCEL ? 10_000 : 30_000,
});

export const q = (text, params) => pool.query(text, params);

/** Ambil satu baris, atau undefined. */
export const one = async (text, params) => (await q(text, params)).rows[0];

/** Ambil semua baris. */
export const many = async (text, params) => (await q(text, params)).rows;
