// Kode atribut sama persis dengan tabel accessibility_attributes di backend (db/seed.sql).
export const ATTRIBUTES = [
  { code: 'ramp', label: 'Ramp', core: true },
  { code: 'guiding_block', label: 'Guiding block', core: true },
  { code: 'accessible_toilet', label: 'Toilet aksesibel', core: true },
  { code: 'lift', label: 'Lift', core: true },
  { code: 'accessible_parking', label: 'Parkir disabilitas', core: true },
  { code: 'wheelchair_path', label: 'Jalur kursi roda', core: true },
  { code: 'braille', label: 'Braille', core: false },
  { code: 'audio_access', label: 'Akses audio', core: false },
  { code: 'accessible_entrance', label: 'Pintu aksesibel', core: false },
  { code: 'handrail', label: 'Handrail', core: false },
];
// Atribut utama: wajib foto bukti saat diisi/diubah (FR-08)
export const CORE_CODES = new Set(ATTRIBUTES.filter((a) => a.core).map((a) => a.code));

export const ATTRIBUTE_LABEL = Object.fromEntries(ATTRIBUTES.map((a) => [a.code, a.label]));

export const STATUS = {
  available: { symbol: '✓', label: 'Tersedia', cls: 'bg-success-bg text-success' },
  not_available: { symbol: '✕', label: 'Tidak tersedia', cls: 'bg-danger-bg text-danger' },
  unknown: { symbol: '?', label: 'Belum diketahui', cls: 'bg-neutral-bg text-neutral' },
};

// Kelompok atribut: dipakai di filter, profil, detail, dan form (bukan satu daftar panjang)
export const ATTRIBUTE_GROUPS = [
  { key: 'akses', label: 'Akses masuk dan pergerakan', codes: ['ramp', 'accessible_entrance', 'lift', 'wheelchair_path', 'handrail'] },
  { key: 'panduan', label: 'Panduan dan informasi', codes: ['guiding_block', 'braille', 'audio_access'] },
  { key: 'pendukung', label: 'Fasilitas pendukung', codes: ['accessible_toilet', 'accessible_parking'] },
];
export const ATTRIBUTE_HINT = {
  ramp: 'Jalur landai sebagai pengganti tangga',
  accessible_entrance: 'Pintu masuk yang mudah dilalui',
  lift: 'Lift untuk berpindah lantai',
  wheelchair_path: 'Jalur lebar dan rata untuk kursi roda',
  handrail: 'Pegangan di tangga, ramp, atau koridor',
  guiding_block: 'Jalur pemandu bertekstur di lantai',
  braille: 'Penanda atau informasi dalam huruf braille',
  audio_access: 'Petunjuk atau informasi dalam bentuk suara',
  accessible_toilet: 'Toilet dengan ruang gerak dan pegangan',
  accessible_parking: 'Parkir khusus yang dekat dengan pintu masuk',
};

export const CATEGORIES = [
  { code: 'kesehatan', label: 'Kesehatan', hint: 'Rumah sakit, puskesmas, klinik' },
  { code: 'pendidikan', label: 'Pendidikan', hint: 'Sekolah, perguruan tinggi' },
  { code: 'layanan_publik', label: 'Layanan publik', hint: 'Kantor pemerintahan dan layanan publik' },
  { code: 'transportasi', label: 'Transportasi', hint: 'Stasiun, halte, terminal' },
  { code: 'komersial', label: 'Komersial dan rekreasi', hint: 'Mal, taman, tempat wisata' },
];
export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.code, c.label]));

export const REPORT_TYPES = [
  { code: 'data_salah', label: 'Data tidak sesuai kondisi lapangan' },
  { code: 'fasilitas_tutup', label: 'Fasilitas sudah tutup atau tidak tersedia' },
  { code: 'atribut_tidak_sesuai', label: 'Atribut aksesibilitas tidak sesuai' },
  { code: 'foto_tidak_relevan', label: 'Foto tidak relevan' },
  { code: 'review_bermasalah', label: 'Ulasan bermasalah' },
];
export const REPORT_LABEL = Object.fromEntries(REPORT_TYPES.map((r) => [r.code, r.label]));

// Jenis kontribusi diturunkan dari isi payload (backend hanya membedakan create/update)
export function contributionKind(c) {
  if (c.change_type === 'create') return 'Tambah fasilitas';
  if (c.payload?.attributes?.length) return 'Ubah atribut aksesibilitas';
  if (c.payload?.facility && Object.keys(c.payload.facility).length) return 'Ubah data fasilitas';
  return 'Tambah foto';
}

export const CONTRIBUTION_STATUS = {
  pending: { label: 'Menunggu verifikasi', cls: 'bg-warning-bg text-warning' },
  approved: { label: 'Disetujui', cls: 'bg-success-bg text-success' },
  rejected: { label: 'Ditolak', cls: 'bg-danger-bg text-danger' },
};

export const DISCLAIMER =
  'Informasi aksesibilitas AksesKota berasal dari data yang dipetakan, sumber data publik, dan kontribusi pengguna yang telah melalui proses verifikasi. Kondisi fasilitas di lapangan dapat berubah dan tingkat aksesibilitas setiap fasilitas dapat berbeda sesuai kebutuhan pengguna. AksesKota tidak menjamin bahwa suatu fasilitas atau rute sepenuhnya bebas hambatan bagi semua pengguna.';

export const COVERAGE_NOTE =
  'Cakupan data belum merata di seluruh Indonesia. Area tanpa hasil bukan berarti tidak memiliki fasilitas yang aksesibel; datanya mungkin belum ada.';

// Batas upload foto (validasi di client; backend wajib memvalidasi ulang)
export const PHOTO_RULES = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  maxMB: 5,
  maxFiles: 3,
};

// Batas suara (PRD 27.5)
export const VOICE_MAX_SECONDS = 30;
