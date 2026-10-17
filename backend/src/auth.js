import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { one } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET belum diisi di .env');

const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '30d' });

/** Dipasang global: isi req.user kalau ada token valid, diam saja kalau tidak.
 *  Guest tetap boleh lewat (PRD 7: login tidak wajib untuk eksplorasi). */
export function optionalAuth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /i, '');
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch { /* token busuk = tetap guest */ }
  }
  next();
}

export const requireAuth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Perlu login' });

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Khusus admin' });

const credentials = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const name = z.string().min(1).max(100).parse(req.body.name);

  const exists = await one('select 1 from users where email = $1', [email]);
  if (exists) return res.status(409).json({ error: 'Email sudah terdaftar' });

  const user = await one(
    'insert into users (email, password_hash, name) values ($1,$2,$3) returning id, email, name, role',
    [email, await bcrypt.hash(password, 10), name],
  );
  res.status(201).json({ token: sign(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const row = await one('select * from users where email = $1', [email]);
  // Pesan error sengaja sama untuk email salah dan password salah: jangan bocorkan email mana yang terdaftar.
  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    return res.status(401).json({ error: 'Email atau password salah' });

  const user = { id: row.id, email: row.email, name: row.name, role: row.role };
  res.json({ token: sign(user), user });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(await one('select id, email, name, role, created_at from users where id = $1', [req.user.id]));
});
