import express from 'express';
import { z } from 'zod';
import { many, one, q } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const router = express.Router();
export const adminRouter = express.Router();

// ---------------------------------------------------------------------------
// Review & rating (FR-11)
//
// PRD 20: rating TIDAK ikut menghitung Accessibility Match. Keduanya informasi berbeda —
// match = kecocokan terhadap kebutuhan, rating = pengalaman. Karena itu tabel reviews
// tidak pernah disentuh oleh searchFacilities().
// ---------------------------------------------------------------------------

const isiReview = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().max(1000).optional(),
});

router.post('/facilities/:id/reviews', requireAuth, async (req, res) => {
  const facilityId = z.coerce.number().int().positive().parse(req.params.id);
  const { rating, content } = isiReview.parse(req.body);

  const ada = await one('select 1 from facilities where id = $1', [facilityId]);
  if (!ada) return res.status(404).json({ error: 'Fasilitas tidak ditemukan' });

  // Satu review per orang per fasilitas; kirim ulang = mengubah review sendiri.
  const row = await one(
    `insert into reviews (facility_id, user_id, rating, content) values ($1,$2,$3,$4)
     on conflict (facility_id, user_id)
     do update set rating = excluded.rating, content = excluded.content, created_at = now()
     returning id, rating, content, created_at`,
    [facilityId, req.user.id, rating, content ?? null],
  );
  res.status(201).json(row);
});

router.delete('/facilities/:id/reviews/mine', requireAuth, async (req, res) => {
  const facilityId = z.coerce.number().int().positive().parse(req.params.id);
  await q('delete from reviews where facility_id = $1 and user_id = $2', [facilityId, req.user.id]);
  res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// Report (FR-12)
// ---------------------------------------------------------------------------

const JENIS = ['data_salah', 'fasilitas_tutup', 'atribut_tidak_sesuai', 'foto_tidak_relevan', 'review_bermasalah'];

router.post('/reports', requireAuth, async (req, res) => {
  const { facility_id, review_id, report_type, description } = z
    .object({
      facility_id: z.coerce.number().int().positive(),
      review_id: z.coerce.number().int().positive().optional(),
      report_type: z.enum(JENIS),
      description: z.string().trim().max(1000).optional(),
    })
    .parse(req.body);

  if (report_type === 'review_bermasalah' && !review_id)
    return res.status(400).json({ error: 'review_id wajib untuk laporan konten review' });

  const row = await one(
    `insert into reports (facility_id, review_id, reported_by, report_type, description)
     values ($1,$2,$3,$4,$5) returning id, status, report_type`,
    [facility_id, review_id ?? null, req.user.id, report_type, description ?? null],
  );
  res.status(201).json({ ...row, message: 'Laporan diterima dan akan ditinjau admin' });
});

router.get('/reports/mine', requireAuth, async (req, res) => {
  res.json(
    await many(
      `select r.id, r.report_type, r.status, r.description, r.resolution_note, r.resolved_at,
              f.name as facility_name
         from reports r join facilities f on f.id = r.facility_id
        where r.reported_by = $1 order by r.id desc limit 50`,
      [req.user.id],
    ),
  );
});

// ---------------------------------------------------------------------------
// Penanganan laporan oleh admin
// ---------------------------------------------------------------------------

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/reports', async (req, res) => {
  const status = z.enum(['open', 'resolved', 'dismissed', 'all']).default('open').parse(req.query.status);
  res.json(
    await many(
      `select r.id, r.report_type, r.status, r.description, r.resolution_note, r.resolved_at,
              r.facility_id, f.name as facility_name,
              r.review_id, rv.content as review_content, rv.rating as review_rating,
              u.display_name as reported_by_name, au.email as reported_by_email
         from reports r
         join facilities f on f.id = r.facility_id
         join profiles u on u.id = r.reported_by
         left join auth.users au on au.id = r.reported_by
         left join reviews rv on rv.id = r.review_id
        where ($1 = 'all' or r.status = $1)
        order by r.id desc limit 100`,
      [status],
    ),
  );
});

/**
 * Admin menutup laporan. `hapus_review` khusus untuk laporan konten review bermasalah —
 * laporan jenis lain TIDAK pernah mengubah data fasilitas dari sini; perubahan data
 * resmi hanya lewat alur kontribusi yang terverifikasi (PRD 12.4).
 */
adminRouter.post('/reports/:id/resolve', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { action, note, hapus_review } = z
    .object({
      action: z.enum(['resolve', 'dismiss']),
      note: z.string().trim().max(500).optional(),
      hapus_review: z.boolean().default(false),
    })
    .parse(req.body);

  const laporan = await one('select * from reports where id = $1', [id]);
  if (!laporan) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  if (laporan.status !== 'open') return res.status(409).json({ error: `Laporan sudah ${laporan.status}` });

  if (hapus_review && laporan.review_id) await q('delete from reviews where id = $1', [laporan.review_id]);

  await q(
    `update reports set status = $2, resolution_note = $3, resolved_by = $4, resolved_at = now()
      where id = $1`,
    [id, action === 'resolve' ? 'resolved' : 'dismissed', note ?? null, req.user.id],
  );
  res.json({ id, status: action === 'resolve' ? 'resolved' : 'dismissed', review_dihapus: Boolean(hapus_review && laporan.review_id) });
});
