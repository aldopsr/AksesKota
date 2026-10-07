import { one } from './db.js';

/**
 * Naikkan pemakaian hari ini secara atomik, kembalikan jumlah SETELAH dinaikkan.
 * Satu statement supaya dua request bersamaan tidak saling menimpa hitungan.
 *
 * Kunci memuat jenisnya: `ai:u:12`, `ai:ip:1.2.3.4`, `route:u:12`, ...
 * Pakai tabel, bukan counter di memori: tiap instance serverless Vercel punya
 * memori sendiri, jadi counter di memori praktis tidak membatasi apa pun.
 */
export async function pakaiKuota(key) {
  const row = await one(
    `insert into ai_usage (key, day, count) values ($1, current_date, 1)
     on conflict (key, day) do update set count = ai_usage.count + 1
     returning count`,
    [key],
  );
  return row.count;
}

/** Kunci kuota untuk request ini: per akun kalau login, per IP kalau guest. */
export const kuotaKey = (req, jenis) => `${jenis}:${req.user ? `u:${req.user.id}` : `ip:${req.ip}`}`;
