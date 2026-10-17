// Review & report (PRD 20, 21).
import express from 'express';
import { z } from 'zod';
import { one } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError } from '../http.js';

export const router = express.Router();
const facilityId = (req) => z.coerce.number().int().positive().parse(req.params.id);

// Satu review per user per fasilitas (unique di DB): kirim ulang = memperbarui.
router.post('/facilities/:id/reviews', requireAuth, async (req, res) => {
  const id = facilityId(req);
  const body = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    content: z.string().trim().max(500).optional().default(''),
  }).parse(req.body);
  if (!(await one('select 1 from facilities where id = $1', [id]))) throw new HttpError(404, 'Fasilitas tidak ditemukan');

  const row = await one(
    `insert into reviews (facility_id, user_id, rating, content) values ($1,$2,$3,$4)
     on conflict (facility_id, user_id) do update set rating = excluded.rating, content = excluded.content, created_at = now()
     returning id, rating, content, created_at`,
    [id, req.user.id, body.rating, body.content],
  );
  res.status(201).json(row);
});

export const REPORT_TYPES = ['data_salah', 'fasilitas_tutup', 'atribut_tidak_sesuai', 'foto_tidak_relevan', 'review_bermasalah'];

router.post('/facilities/:id/reports', requireAuth, async (req, res) => {
  const id = facilityId(req);
  const body = z.object({
    report_type: z.enum(REPORT_TYPES),
    description: z.string().trim().min(10).max(1000),
    review_id: z.coerce.number().int().positive().optional(),
  }).parse(req.body);
  if (!(await one('select 1 from facilities where id = $1', [id]))) throw new HttpError(404, 'Fasilitas tidak ditemukan');
  if (body.review_id && !(await one('select 1 from reviews where id = $1 and facility_id = $2', [body.review_id, id]))) {
    throw new HttpError(404, 'Ulasan tidak ditemukan');
  }
  const row = await one(
    `insert into reports (facility_id, review_id, reported_by, report_type, description)
     values ($1,$2,$3,$4,$5) returning id, report_type, status`,
    [id, body.review_id ?? null, req.user.id, body.report_type, body.description],
  );
  res.status(201).json(row);
});
