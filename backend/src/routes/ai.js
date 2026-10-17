// Asisten AI (PRD 17): POST /api/ai/chat. Wajib login; kuota harian per user di tabel ai_usage.
import express from 'express';
import { z } from 'zod';
import { one } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError } from '../http.js';
import { rateLimit } from '../rateLimit.js';
import { geminiEnabled } from '../ai/gemini.js';
import { runAssistant } from '../ai/assistant.js';

export const router = express.Router();
const dailyLimit = () => Number(process.env.AI_DAILY_LIMIT ?? 30);

router.get('/ai/status', async (req, res) => {
  let used = null;
  if (req.user) {
    used = (await one('select count from ai_usage where user_id = $1 and day = current_date', [req.user.id]))?.count ?? 0;
  }
  res.json({ enabled: geminiEnabled(), requires_login: true, daily_limit: dailyLimit(), used_today: used });
});

const body = z.object({
  message: z.string().trim().min(1).max(300),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(600) })).max(8).default([]),
  origin: z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }).nullish(),
  facility_id: z.coerce.number().int().positive().optional(),
});

router.post('/ai/chat', requireAuth, rateLimit({ windowMs: 60_000, max: 12 }), async (req, res) => {
  if (!geminiEnabled()) throw new HttpError(503, 'Asisten AI belum diaktifkan di server.', { fallback: true });
  const p = body.parse(req.body);

  // Ambil jatah SEBELUM memanggil Gemini (atomik); kembalikan bila Gemini gagal.
  const slot = await one(
    `insert into ai_usage (user_id, day, count) values ($1, current_date, 1)
     on conflict (user_id, day) do update set count = ai_usage.count + 1 where ai_usage.count < $2
     returning count`,
    [req.user.id, dailyLimit()],
  );
  if (!slot) throw new HttpError(429, `Batas ${dailyLimit()} pertanyaan ke asisten per hari tercapai. Pencarian biasa tetap bisa dipakai.`);

  try {
    const out = await runAssistant({ message: p.message, history: p.history, origin: p.origin ?? null, user: req.user, facilityId: p.facility_id });
    res.json({ ...out, usage: { used: slot.count, limit: dailyLimit() } });
  } catch (e) {
    await one('update ai_usage set count = greatest(count - 1, 0) where user_id = $1 and day = current_date returning count', [req.user.id]);
    throw e;
  }
});
