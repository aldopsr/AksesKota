import express from 'express';
import { one } from './db.js';
import { sbUrl, sbAnonKey } from './supabase.js';

// PRD 2.0 §27.2: React -> Supabase Auth -> Access Token -> Express -> verifikasi -> role.
//
// Backend TIDAK lagi menangani register, login, password, atau reset password.
// Semua itu milik Supabase Auth. Yang tersisa di sini hanya: memastikan token sah,
// lalu menentukan role dari tabel `profiles` kita sendiri.
//
// Role TIDAK pernah dibaca dari isi token. Token hanya membuktikan "siapa";
// "boleh apa" selalu dilihat dari database (PRD 2.0 §27.2: hak akses admin tidak
// ditentukan dari data yang dikirim client).

// Project ini memakai penandatanganan HS256 lama (endpoint JWKS membalas 404), jadi
// verifikasi dilakukan dengan menanyakan token ke Supabase, bukan memeriksa tanda tangan
// secara lokal. Hasilnya di-cache sebentar supaya tidak satu round-trip per request.
//
// ponytail: cache di memori, 60 detik. Konsekuensinya token yang baru di-sign-out masih
// diterima paling lama 60 detik. Kalau itu tidak bisa diterima, verifikasi lokal dengan
// SUPABASE_JWT_SECRET (HS256) menghilangkan cache sekaligus round-trip-nya.
const TTL = 60_000;
const cache = new Map();

async function verifikasiToken(token) {
  const tersimpan = cache.get(token);
  if (tersimpan && tersimpan.sampai > Date.now()) return tersimpan.user;

  const res = await fetch(`${sbUrl()}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: sbAnonKey() },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    cache.delete(token);
    return null;
  }
  const user = await res.json();

  if (cache.size > 1000) cache.clear(); // batas kasar, tidak perlu LRU untuk ini
  cache.set(token, { user, sampai: Date.now() + TTL });
  return user;
}

/**
 * Pastikan ada baris profiles untuk akun ini, lalu kembalikan role-nya.
 * Dibuat sambil jalan, bukan lewat trigger di schema auth — supaya tidak perlu
 * hak akses khusus ke schema milik Supabase dan tetap jalan di project mana pun.
 */
async function profil(user) {
  const nama = user.user_metadata?.display_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? null;
  return one(
    `insert into profiles (id, display_name) values ($1, $2)
     on conflict (id) do update set display_name = coalesce(profiles.display_name, excluded.display_name),
                                    updated_at = now()
     returning id, display_name, role`,
    [user.id, nama],
  );
}

/** Dipasang global: isi req.user kalau tokennya sah, diam saja kalau tidak.
 *  Guest tetap boleh lewat (PRD §7: login tidak wajib untuk eksplorasi). */
export async function optionalAuth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /i, '');
  if (!token) return next();
  try {
    const user = await verifikasiToken(token);
    if (user) {
      const p = await profil(user);
      req.user = { id: p.id, email: user.email, name: p.display_name, role: p.role };
    }
  } catch (e) {
    // Supabase Auth tidak bisa dihubungi: perlakukan sebagai guest, jangan matikan peta (NFR-04).
    console.error('Verifikasi token gagal:', e.message);
  }
  next();
}

export const requireAuth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Perlu login' });

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Khusus admin' });

export const router = express.Router();

/** Profil akun yang sedang login. Register/login dilakukan frontend lewat supabase-js. */
router.get('/me', requireAuth, async (req, res) => {
  res.json(await one('select id, display_name, role, created_at from profiles where id = $1', [req.user.id]));
});
