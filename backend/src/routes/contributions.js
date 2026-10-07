import express from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db.js';
import { semuaKode } from '../match.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { prefixPublik, storageSiap, signUpload, extValid } from '../storage.js';

// PRD 2.0 §3: scope produk adalah SELURUH INDONESIA, bukan lagi Kota Bogor.
// Kotak ini cuma penjaga kewarasan agar koordinat tertukar (lat/lon terbalik) atau
// salah ketik tidak masuk sebagai fasilitas di tengah samudra — bukan pembatas wilayah.
const INDONESIA = { latMin: -11.1, latMax: 6.2, lonMin: 94.9, lonMax: 141.1 };

const statusAtribut = z.enum(['available', 'not_available', 'unknown']);
const atribut = z.record(z.string(), statusAtribut);

const payloadCreate = z.object({
  name: z.string().trim().min(3).max(150),
  category_code: z.string().min(1).max(50),
  lat: z.number().min(INDONESIA.latMin).max(INDONESIA.latMax),
  lon: z.number().min(INDONESIA.lonMin).max(INDONESIA.lonMax),
  address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(1000).optional(),
  attributes: atribut.default({}),
  notes: z.string().trim().max(1000).optional(),
});

const payloadUpdate = z.object({
  address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(1000).optional(),
  attributes: atribut.default({}),
  notes: z.string().trim().max(1000).optional(),
});

const body = z.object({
  facility_id: z.number().int().positive().optional(),
  change_type: z.enum(['create_facility', 'update_facility', 'update_accessibility', 'add_photo']),
  payload: z.object({}).passthrough(),
  photos: z.array(z.string().url()).max(10).default([]),
});

/** Kode atribut utama — perubahannya wajib disertai foto bukti (FR-08). */
const kodeUtama = async () =>
  new Set((await many('select code from accessibility_attributes where is_core')).map((r) => r.code));

export const router = express.Router();
export const adminRouter = express.Router();

// ---------- Upload foto ----------

router.post('/uploads/photo-url', requireAuth, async (req, res) => {
  if (!storageSiap())
    return res.status(503).json({ error: 'Storage belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
  const ext = z.string().min(2).max(5).parse(req.body.ext);
  if (!extValid(ext)) return res.status(400).json({ error: 'Format foto harus jpg, jpeg, png, webp, atau heic' });
  res.json(await signUpload(ext));
});

// ---------- Kontribusi dari user ----------

router.post('/contributions', requireAuth, async (req, res) => {
  const { facility_id, change_type, photos } = body.parse(req.body);
  const buatBaru = change_type === 'create_facility';
  if (!buatBaru && !facility_id)
    return res.status(400).json({ error: 'facility_id wajib untuk perubahan data' });

  const payload = buatBaru ? payloadCreate.parse(req.body.payload) : payloadUpdate.parse(req.body.payload);

  // Foto hanya boleh dari bucket kita sendiri. Tanpa cek ini, kontributor bisa
  // menitipkan URL gambar sembarang (atau pelacak) ke dalam data resmi.
  const asing = photos.filter((u) => !u.startsWith(prefixPublik()));
  if (asing.length) return res.status(400).json({ error: 'URL foto tidak berasal dari storage AksesKota' });

  const valid = await semuaKode();
  const salah = Object.keys(payload.attributes).filter((c) => !valid.has(c));
  if (salah.length) return res.status(400).json({ error: `Kode atribut tidak dikenal: ${salah.join(', ')}` });

  // FR-08: penambahan/perubahan atribut UTAMA wajib minimal satu foto bukti.
  const utama = await kodeUtama();
  const sentuhUtama = Object.keys(payload.attributes).some((c) => utama.has(c));
  if (sentuhUtama && photos.length === 0)
    return res.status(400).json({ error: 'Perubahan atribut aksesibilitas utama wajib menyertakan minimal 1 foto bukti' });

  if (buatBaru) {
    const kategori = await one('select id from categories where code = $1', [payload.category_code]);
    if (!kategori) return res.status(400).json({ error: 'Kategori tidak dikenal' });
    const kembar = await one('select id from facilities where lower(name) = lower($1)', [payload.name]);
    if (kembar)
      return res.status(409).json({ error: `Fasilitas "${payload.name}" sudah ada`, facility_id: kembar.id });
  } else {
    const ada = await one('select id from facilities where id = $1', [facility_id]);
    if (!ada) return res.status(404).json({ error: 'Fasilitas tidak ditemukan' });
  }

  // Status pending. Data resmi TIDAK disentuh sampai admin approve (PRD 12.3 / AC-06).
  const row = await one(
    `insert into contributions (facility_id, submitted_by, change_type, payload)
     values ($1,$2,$3,$4) returning id, status, created_at`,
    [facility_id ?? null, req.user.id, change_type, { ...payload, photos }],
  );
  res.status(201).json({ ...row, message: 'Kontribusi diterima dan menunggu verifikasi admin' });
});

router.get('/contributions/mine', requireAuth, async (req, res) => {
  res.json(
    await many(
      `select k.id, k.change_type, k.status, k.review_notes, k.created_at, k.reviewed_at,
              k.facility_id, f.name as facility_name, k.payload
         from contributions k left join facilities f on f.id = k.facility_id
        where k.submitted_by = $1
        order by k.id desc limit 50`,
      [req.user.id],
    ),
  );
});

// ---------- Verifikasi admin ----------

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/contributions', async (req, res) => {
  const status = z.enum(['pending', 'approved', 'rejected', 'all']).default('pending').parse(req.query.status);
  res.json(
    await many(
      `select k.id, k.change_type, k.status, k.created_at, k.reviewed_at,
              k.facility_id, f.name as facility_name,
              u.display_name as submitted_by_name, au.email as submitted_by_email,
              k.payload->>'name' as usulan_nama,
              coalesce(jsonb_array_length(k.payload->'photos'), 0) as jumlah_foto
         from contributions k
         left join facilities f on f.id = k.facility_id
         join profiles u on u.id = k.submitted_by
         left join auth.users au on au.id = k.submitted_by
        where ($1 = 'all' or k.status = $1)
        order by k.id desc limit 100`,
      [status],
    ),
  );
});

/** Detail untuk layar verifikasi: nilai sebelumnya vs usulan, bukti, pengirim, riwayat (PRD 12.4). */
adminRouter.get('/contributions/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const k = await one(
    `select k.*, u.display_name as submitted_by_name, au.email as submitted_by_email, f.name as facility_name
       from contributions k
       join profiles u on u.id = k.submitted_by
       left join auth.users au on au.id = k.submitted_by
       left join facilities f on f.id = k.facility_id
      where k.id = $1`,
    [id],
  );
  if (!k) return res.status(404).json({ error: 'Kontribusi tidak ditemukan' });

  const usulan = k.payload.attributes ?? {};
  const kode = Object.keys(usulan);

  // Nilai sebelumnya. Untuk change_type 'create' belum ada fasilitas, jadi semuanya unknown.
  const sebelum = k.facility_id && kode.length
    ? await many(
        `select a.code, a.name, coalesce(af.status,'unknown') as status
           from accessibility_attributes a
           left join accessibility_facilities af on af.attribute_code = a.code and af.facility_id = $2
          where a.code = any($1::text[]) order by a.sort`,
        [kode, k.facility_id],
      )
    : kode.map((code) => ({ code, name: null, status: 'unknown' }));

  const riwayat = k.facility_id
    ? await many(
        `select k2.id, k2.change_type, k2.status, k2.reviewed_at, u.display_name as reviewed_by_name
           from contributions k2 left join profiles u on u.id = k2.reviewed_by
          where k2.facility_id = $1 and k2.id <> $2 and k2.status <> 'pending'
          order by k2.id desc limit 20`,
        [k.facility_id, id],
      )
    : [];

  res.json({
    ...k,
    photos: k.payload.photos ?? [],
    perbandingan: sebelum.map((s) => ({ ...s, status_sebelum: s.status, status_usulan: usulan[s.code] })),
    riwayat,
  });
});

adminRouter.post('/contributions/:id/review', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { action, note } = z
    .object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).optional() })
    .parse(req.body);

  const hasil = await tx(async (c) => {
    // FOR UPDATE: dua admin yang menekan approve bersamaan tidak boleh sama-sama lolos.
    const k = (await c.query('select * from contributions where id = $1 for update', [id])).rows[0];
    if (!k) return { http: 404, body: { error: 'Kontribusi tidak ditemukan' } };
    if (k.status !== 'pending')
      return { http: 409, body: { error: `Kontribusi sudah ${k.status}` } };

    if (action === 'reject') {
      // Ditolak: data resmi tidak berubah sama sekali (AC-07).
      await c.query(
        `update contributions set status='rejected', review_notes=$2, reviewed_by=$3, reviewed_at=now() where id=$1`,
        [id, note ?? null, req.user.id],
      );
      return { http: 200, body: { id, status: 'rejected' } };
    }

    const p = k.payload;
    let facilityId = k.facility_id;

    if (k.change_type === 'create_facility') {
      const kembar = (await c.query('select id from facilities where lower(name) = lower($1)', [p.name])).rows[0];
      if (kembar)
        return { http: 409, body: { error: `Fasilitas "${p.name}" sudah dibuat sementara kontribusi ini menunggu`, facility_id: kembar.id } };

      facilityId = (
        await c.query(
          `insert into facilities (name, category_id, address, location, description, source)
           values ($1, (select id from categories where code=$2), $3,
                   st_setsrid(st_makepoint($4,$5),4326), $6, 'crowdsource')
           returning id`,
          [p.name, p.category_code, p.address ?? null, p.lon, p.lat, p.description ?? null],
        )
      ).rows[0].id;

      // Semua atribut unknown dulu, supaya detail fasilitas selalu menampilkan 10 baris penuh.
      await c.query(
        `insert into accessibility_facilities (facility_id, attribute_code)
         select $1, code from accessibility_attributes on conflict do nothing`,
        [facilityId],
      );
    } else if (p.address !== undefined || p.description !== undefined) {
      await c.query(
        `update facilities set address = coalesce($2, address), description = coalesce($3, description),
                               updated_at = now() where id = $1`,
        [facilityId, p.address ?? null, p.description ?? null],
      );
    }

    for (const [code, status] of Object.entries(p.attributes ?? {})) {
      await c.query(
        `insert into accessibility_facilities (facility_id, attribute_code, status, notes, verified_by, verified_at)
         values ($1,$2,$3,$4,$5,now())
         on conflict (facility_id, attribute_code)
         do update set status = excluded.status, notes = coalesce(excluded.notes, accessibility_facilities.notes),
                       verified_by = excluded.verified_by, verified_at = excluded.verified_at`,
        [facilityId, code, status, p.notes ?? null, req.user.id],
      );
    }

    for (const url of p.photos ?? [])
      await c.query(
        'insert into facility_photos (facility_id, uploaded_by, url) values ($1,$2,$3)',
        [facilityId, k.submitted_by, url],
      );

    // Approve = admin sudah memverifikasi (FR-20).
    await c.query('update facilities set last_verified_at = now(), updated_at = now() where id = $1', [facilityId]);
    await c.query(
      `update contributions set status='approved', review_notes=$2, reviewed_by=$3, reviewed_at=now(),
                                facility_id=$4 where id=$1`,
      [id, note ?? null, req.user.id, facilityId],
    );

    return { http: 200, body: { id, status: 'approved', facility_id: facilityId } };
  });

  res.status(hasil.http).json(hasil.body);
});
