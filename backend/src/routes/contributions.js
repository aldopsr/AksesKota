// Crowdsourcing (PRD 12): user mengusulkan fasilitas baru / perubahan atribut + foto bukti.
// Data resmi TIDAK ditimpa sampai admin approve (lihat routes/admin.js).
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { many, one } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError } from '../http.js';
import { savePhoto, validateImage, MAKS_FOTO_MB } from '../storage.js';

export const router = express.Router();

const MAX_PHOTOS = 3;
const MAX_PER_DAY = 20;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAKS_FOTO_MB * 1024 * 1024, files: MAX_PHOTOS } });

const attribute = z.object({
  code: z.string().max(50),
  status: z.enum(['available', 'not_available', 'unknown']),
  notes: z.string().trim().max(300).nullish(),
});

const facilityFull = z.object({
  name: z.string().trim().min(3).max(120),
  category: z.string().max(50),
  address: z.string().trim().min(5).max(255),
  description: z.string().trim().max(1000).default(''),
  lat: z.coerce.number().min(-11.5).max(6.5),
  lon: z.coerce.number().min(94).max(141.5),
});

const payloadSchema = z.object({
  facility_id: z.coerce.number().int().positive().optional(),
  facility: facilityFull.partial().optional(),
  attributes: z.array(attribute).max(10).optional(),
  note: z.string().trim().max(500).optional(), // alasan/catatan kontributor untuk admin
});

router.post('/contributions', requireAuth, upload.array('photos', MAX_PHOTOS), async (req, res) => {
  let raw;
  try { raw = JSON.parse(req.body.payload ?? '{}'); } catch { throw new HttpError(400, 'Payload bukan JSON yang valid'); }
  const p = payloadSchema.parse(raw);
  const files = req.files ?? [];
  files.forEach(validateImage); // tolak sebelum ada yang tersimpan

  const isCreate = !p.facility_id;
  if (isCreate) {
    facilityFull.parse(p.facility ?? {}); // usulan baru wajib lengkap
  } else if (!(await one('select 1 from facilities where id = $1', [p.facility_id]))) {
    throw new HttpError(404, 'Fasilitas tidak ditemukan');
  }

  const category = p.facility?.category;
  if (category && !(await one('select 1 from categories where code = $1', [category]))) {
    throw new HttpError(400, 'Kategori tidak dikenal');
  }

  const attrs = await many('select code, is_core from accessibility_attributes');
  const core = new Set(attrs.filter((a) => a.is_core).map((a) => a.code));
  const valid = new Set(attrs.map((a) => a.code));
  const provided = p.attributes ?? [];
  if (provided.some((a) => !valid.has(a.code))) throw new HttpError(400, 'Ada kode atribut yang tidak dikenal');

  // FR-08: foto bukti wajib bila mengisi/ubah atribut utama
  if (provided.some((a) => core.has(a.code) && a.status !== 'unknown') && files.length === 0) {
    throw new HttpError(422, 'Foto bukti wajib dilampirkan untuk atribut aksesibilitas utama.');
  }
  const hasChange = isCreate || (p.facility && Object.keys(p.facility).length) || provided.length || files.length || p.note;
  if (!hasChange) throw new HttpError(400, 'Tidak ada perubahan yang dikirim');

  const today = await one(
    'select count(*)::int as n from contributions where submitted_by = $1 and created_at >= current_date',
    [req.user.id],
  );
  if (today.n >= MAX_PER_DAY) throw new HttpError(429, `Batas ${MAX_PER_DAY} kontribusi per hari tercapai.`);

  const photos = await Promise.all(files.map(savePhoto));
  const payload = { facility: p.facility, attributes: provided.length ? provided : undefined, note: p.note || undefined, photos };
  const row = await one(
    `insert into contributions (facility_id, submitted_by, change_type, payload)
     values ($1, $2, $3, $4) returning id, facility_id, change_type, payload, status, created_at`,
    [p.facility_id ?? null, req.user.id, isCreate ? 'create' : 'update', JSON.stringify(payload)],
  );
  res.status(201).json(row);
});

