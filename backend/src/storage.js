// Penyimpanan foto. Pakai Supabase Storage bila SUPABASE_URL + SUPABASE_SERVICE_KEY diisi
// (bucket publik, default "facility-photos"); kalau tidak, simpan di folder lokal ./uploads
// dan layani lewat /uploads (cukup untuk development).
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './http.js';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
const BUCKET = process.env.SUPABASE_BUCKET ?? 'facility-photos';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Cek isi file (magic bytes), jangan percaya mimetype kiriman client.
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

export function validateImage(file) {
  const type = sniff(file.buffer);
  if (!type) throw new HttpError(400, `${file.originalname}: format harus JPG, PNG, atau WebP.`);
  return type;
}

export async function savePhoto(file) {
  const type = validateImage(file);
  const name = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT[type]}`;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': type },
      body: file.buffer,
    });
    if (!res.ok) {
      // log penyebab (tanpa kunci) agar mudah didiagnosis: bucket belum ada, kunci salah, dsb.
      console.error('[storage] Supabase menolak unggahan:', res.status, (await res.text()).slice(0, 200));
      throw new HttpError(502, 'Foto gagal diunggah ke penyimpanan.');
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
  }

  const full = path.join(UPLOAD_DIR, name);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, file.buffer);
  const base = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/uploads/${name}`;
}

// Batas ukuran foto. 4 MB, bukan 5: Vercel membatasi body request serverless ~4,5 MB,
// jadi batas 5 MB akan ditolak platform sebelum kode kita sempat memberi pesan yang jelas.
// Angka ini dipakai bersama oleh multer dan pesan error di index.js.
export const MAKS_FOTO_MB = 4;
