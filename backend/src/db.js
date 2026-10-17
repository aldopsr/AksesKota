import pg from 'pg';

// Supabase pooler butuh SSL tapi sertifikatnya tidak ada di trust store Node.
const needsSsl = /supabase|render|neon|heroku/.test(process.env.DATABASE_URL ?? '');

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export const q = (text, params) => pool.query(text, params);

/** Ambil satu baris, atau undefined. */
export const one = async (text, params) => (await q(text, params)).rows[0];

/** Ambil semua baris. */
export const many = async (text, params) => (await q(text, params)).rows;
