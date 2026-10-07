import { many } from './db.js';

// Ambang label marker (PRD 13). Diangkat jadi konstanta supaya bisa ditala
// setelah lihat sebaran data nyata, bukan dikubur di dalam if.
const AMBANG = [
  [80, 'Sangat Sesuai', 'hijau'],
  [50, 'Sebagian Sesuai', 'kuning'],
  [0, 'Kurang Sesuai', 'merah'],
];
const RASIO_DATA_TERBATAS = 0.5; // >= separuh kebutuhan user berstatus unknown -> abu-abu
const HARI_PERLU_VERIFIKASI_ULANG = 180; // PRD 12.5

/** Label + warna marker. Warna bukan satu-satunya indikator (NFR-02). */
export function matchLabel(matchPct, unknownRatio) {
  if (matchPct === null || matchPct === undefined) return null;
  if (unknownRatio >= RASIO_DATA_TERBATAS) return { label: 'Data Terbatas', color: 'abu' };
  const [, label, color] = AMBANG.find(([min]) => matchPct >= min);
  return { label, color };
}

export function freshness(lastVerifiedAt) {
  if (!lastVerifiedAt) return 'needs_reverification';
  const hari = (Date.now() - new Date(lastVerifiedAt)) / 86_400_000;
  return hari <= HARI_PERLU_VERIFIKASI_ULANG ? 'verified_recently' : 'needs_reverification';
}

let kodeValid; // di-cache: daftar atribut tidak berubah saat runtime
const semuaKode = async () =>
  (kodeValid ??= new Set((await many('select code from accessibility_attributes')).map((r) => r.code)));

/** Buang kode atribut yang tidak dikenal. Trust boundary: input ini bisa datang dari URL atau dari LLM. */
export async function sanitizeNeeds(codes) {
  const valid = await semuaKode();
  return [...new Set((codes ?? []).filter((c) => valid.has(c)))];
}

/**
 * Kebutuhan aksesibilitas yang dipakai untuk menghitung match.
 * Urutan prioritas: parameter eksplisit > profil user tersimpan > kosong (guest tanpa filter).
 * `?needs=none` mematikan profil untuk satu pencarian (PRD 9).
 */
export async function resolveNeeds(req, explicit) {
  const raw = explicit ?? req.query.needs;
  if (raw === 'none') return [];
  if (raw) return sanitizeNeeds(Array.isArray(raw) ? raw : String(raw).split(','));
  if (!req.user) return [];
  const rows = await many(
    'select attribute_code from accessibility_profiles where user_id = $1 and is_required',
    [req.user.id],
  );
  return rows.map((r) => r.attribute_code);
}
