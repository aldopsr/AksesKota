// Dashboard admin (PRD 12.4, 21): verifikasi kontribusi, moderasi report & review.
import express from 'express';
import { z } from 'zod';
import { many, one, pool } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { HttpError } from '../http.js';

export const router = express.Router();
router.use('/admin', requireAuth, requireAdmin);

const id = (req) => z.coerce.number().int().positive().parse(req.params.id);

const CONTRIBUTION_SQL = `
  select c.id, c.facility_id, c.change_type, c.payload, c.status, c.review_note, c.reviewed_at, c.created_at,
         coalesce(f.name, c.payload->'facility'->>'name') as facility_name,
         u.name as submitter_name, u.email as submitter_email, rb.name as reviewer_name
    from contributions c
    left join facilities f on f.id = c.facility_id
    join users u on u.id = c.submitted_by
    left join users rb on rb.id = c.reviewed_by`;

router.get('/admin/contributions', async (req, res) => {
  const status = z.enum(['pending', 'approved', 'rejected']).optional().parse(req.query.status);
  res.json(await many(`${CONTRIBUTION_SQL} where ($1::text is null or c.status = $1) order by c.id desc limit 200`, [status ?? null]));
});

router.get('/admin/contributions/:id', async (req, res) => {
  const c = await one(`${CONTRIBUTION_SQL} where c.id = $1`, [id(req)]);
  if (!c) throw new HttpError(404, 'Kontribusi tidak ditemukan');

  // Nilai resmi saat ini, supaya admin bisa membandingkan lama vs usulan.
  let previous = null;
  if (c.facility_id) {
    const f = await one(
      `select f.name, c.code as category, f.address, f.description, st_y(f.location::geometry) as lat, st_x(f.location::geometry) as lon
         from facilities f left join categories c on c.id = f.category_id where f.id = $1`,
      [c.facility_id],
    );
    const codes = (c.payload.attributes ?? []).map((a) => a.code);
    const attributes = codes.length
      ? await many(
        `select a.code, coalesce(af.status,'unknown') as status, af.notes
           from accessibility_attributes a
           left join accessibility_facilities af on af.attribute_code = a.code and af.facility_id = $1
          where a.code = any($2::text[])`,
        [c.facility_id, codes],
      )
      : [];
    const keys = Object.keys(c.payload.facility ?? {});
    previous = { facility: Object.fromEntries(keys.map((k) => [k, f?.[k]])), attributes };
  }
  res.json({ ...c, previous });
});

async function applyContribution(client, c, adminId) {
  const p = c.payload;
  let facilityId = c.facility_id;

  if (c.change_type === 'create') {
    const f = p.facility;
    const row = (await client.query(
      `insert into facilities (name, category_id, address, description, location, last_verified_at)
       values ($1, (select id from categories where code = $2), $3, $4, st_setsrid(st_makepoint($6,$5),4326)::geography, now())
       returning id`,
      [f.name, f.category, f.address, f.description ?? '', f.lat, f.lon],
    )).rows[0];
    facilityId = row.id;
    // PRD 8.2: atribut yang belum diketahui tetap disimpan eksplisit sebagai unknown
    await client.query(
      `insert into accessibility_facilities (facility_id, attribute_code)
       select $1, code from accessibility_attributes on conflict do nothing`,
      [facilityId],
    );
    await client.query('update contributions set facility_id = $1 where id = $2', [facilityId, c.id]);
  } else if (p.facility && Object.keys(p.facility).length) {
    const f = p.facility;
    await client.query(
      `update facilities set
         name = coalesce($2, name),
         category_id = coalesce((select id from categories where code = $3), category_id),
         address = coalesce($4, address),
         description = coalesce($5, description),
         location = case when $6::float8 is not null and $7::float8 is not null
                         then st_setsrid(st_makepoint($7,$6),4326)::geography else location end,
         last_verified_at = now(), updated_at = now()
       where id = $1`,
      [facilityId, f.name ?? null, f.category ?? null, f.address ?? null, f.description ?? null, f.lat ?? null, f.lon ?? null],
    );
  }

  for (const a of p.attributes ?? []) {
    await client.query(
      `insert into accessibility_facilities (facility_id, attribute_code, status, notes, verified_by, verified_at)
       values ($1, $2, $3, $4, $5, case when $3 = 'unknown' then null else now() end)
       on conflict (facility_id, attribute_code) do update
         set status = excluded.status, notes = excluded.notes,
             verified_by = excluded.verified_by, verified_at = excluded.verified_at`,
      [facilityId, a.code, a.status, a.notes ?? null, adminId],
    );
  }
  for (const url of p.photos ?? []) {
    await client.query(
      'insert into facility_photos (facility_id, uploaded_by, url, caption) values ($1,$2,$3,$4)',
      [facilityId, c.submitted_by, url, 'Foto kontribusi'],
    );
  }
  await client.query('update facilities set last_verified_at = now(), updated_at = now() where id = $1', [facilityId]);
}

router.patch('/admin/contributions/:id', async (req, res) => {
  const body = z.object({
    status: z.enum(['approved', 'rejected']),
    review_note: z.string().trim().max(500).nullish(),
  }).parse(req.body);
  if (body.status === 'rejected' && !body.review_note) throw new HttpError(422, 'Catatan wajib diisi saat menolak.');

  const client = await pool.connect();
  try {
    await client.query('begin');
    const c = (await client.query('select * from contributions where id = $1 for update', [id(req)])).rows[0];
    if (!c) throw new HttpError(404, 'Kontribusi tidak ditemukan');
    if (c.status !== 'pending') throw new HttpError(409, 'Kontribusi ini sudah diproses.');
    if (body.status === 'approved') await applyContribution(client, c, req.user.id);
    await client.query(
      'update contributions set status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now() where id = $1',
      [c.id, body.status, body.review_note ?? null, req.user.id],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  res.json(await one(`${CONTRIBUTION_SQL} where c.id = $1`, [id(req)]));
});

/* ---- laporan ---- */
router.get('/admin/reports', async (_req, res) => {
  res.json(await many(
    `select r.id, r.facility_id, f.name as facility_name, r.review_id, rv.content as review_content,
            u.name as reported_by_name, r.report_type, r.description, r.status, r.resolved_at
       from reports r
       join facilities f on f.id = r.facility_id
       join users u on u.id = r.reported_by
       left join reviews rv on rv.id = r.review_id
      order by (r.status = 'open') desc, r.id desc limit 200`,
  ));
});

router.patch('/admin/reports/:id', async (req, res) => {
  const { status } = z.object({ status: z.enum(['resolved', 'dismissed']) }).parse(req.body);
  const row = await one(
    `update reports set status = $2, resolved_by = $3, resolved_at = now() where id = $1 returning id, status`,
    [id(req), status, req.user.id],
  );
  if (!row) throw new HttpError(404, 'Laporan tidak ditemukan');
  res.json(row);
});

/* ---- moderasi review ---- */
router.get('/admin/reviews', async (_req, res) => {
  res.json(await many(
    `select r.id, r.facility_id, f.name as facility_name, u.name as user_name, r.rating, r.content, r.created_at
       from reviews r join facilities f on f.id = r.facility_id join users u on u.id = r.user_id
      order by r.id desc limit 200`,
  ));
});

router.delete('/admin/reviews/:id', async (req, res) => {
  const row = await one('delete from reviews where id = $1 returning id', [id(req)]);
  if (!row) throw new HttpError(404, 'Ulasan tidak ditemukan');
  res.status(204).end();
});
