import pg from 'pg';

// Supabase pooler butuh SSL tapi sertifikatnya tidak ada di trust store Node.
const needsSsl = /supabase|render|neon|heroku/.test(process.env.DATABASE_URL ?? '');

// Di Vercel setiap instance serverless punya pool sendiri dan bisa ada puluhan instance sekaligus.
// max: 1 + connection string ke port 6543 (transaction pooler Supabase) supaya kuota koneksi tidak habis.
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

/**
 * Jalankan fn dalam satu transaksi. Dipakai approve kontribusi: menulis ke
 * facilities + accessibility_facilities + facility_photos + contributions sekaligus.
 * Kalau satu gagal, semuanya dibatalkan — data resmi tidak boleh setengah berubah.
 */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const hasil = await fn(client);
    await client.query('commit');
    return hasil;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
