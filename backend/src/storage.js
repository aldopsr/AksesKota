// Upload foto ke Supabase Storage.
//
// Backend TIDAK memproksi byte foto. Backend hanya menandatangani URL upload,
// lalu browser mengunggah langsung ke Supabase. Dua alasan:
//   1. Vercel membatasi body request ~4.5 MB — foto dari HP sering lebih besar.
//   2. Tidak perlu multer dan tidak ada file besar yang lewat memori serverless.
//
// Validasi tipe & ukuran (NFR-05) ditegakkan DUA lapis:
//   - di sini: ekstensi harus ada di EXT_DIIZINKAN sebelum URL ditandatangani;
//   - di bucket Supabase: allowed MIME types + file size limit. Ini lapisan yang
//     tidak bisa dilewati klien, karena klien-lah yang mengunggah.
//     WAJIB diset manual, lihat PROGRESS.md bagian "Setup bucket".

const BUCKET = 'facility-photos';
const EXT_DIIZINKAN = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

const base = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_KEY;

export const storageSiap = () => Boolean(base() && key());

/** Prefix URL publik bucket. Dipakai untuk memastikan URL foto yang dikirim klien memang milik kita. */
export const prefixPublik = () => `${base()}/storage/v1/object/public/${BUCKET}/`;

export const extValid = (ext) => EXT_DIIZINKAN.includes(String(ext).toLowerCase());

/**
 * Minta Supabase membuat URL upload bertanda tangan (berlaku singkat).
 * Klien lalu melakukan PUT berisi file ke `upload_url`, dan mengirim
 * `public_url` ke endpoint kontribusi.
 */
export async function signUpload(ext) {
  const path = `${crypto.randomUUID()}.${String(ext).toLowerCase()}`;
  const res = await fetch(`${base()}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) throw new Error(`Supabase Storage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { url } = await res.json(); // contoh: /object/upload/sign/facility-photos/<uuid>.jpg?token=...
  return { upload_url: `${base()}/storage/v1${url}`, public_url: prefixPublik() + path, path };
}
