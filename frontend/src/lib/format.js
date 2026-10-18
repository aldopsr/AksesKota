export function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function validatePhoto(file, rules) {
  if (!rules.types.includes(file.type)) return `${file.name}: format harus JPG, PNG, atau WebP.`;
  if (file.size > rules.maxMB * 1024 * 1024) return `${file.name}: ukuran maksimal ${rules.maxMB} MB.`;
  return null;
}

// "17 Okt 2026, 10.04" benar tapi tidak menjawab pertanyaan yang sebenarnya
// ditanyakan di antrean admin dan di daftar kontribusi: sudah berapa lama ini
// menggantung? Dipakai berdampingan dengan tanggal lengkapnya, bukan menggantikan.
const MENIT = 60_000;
const SATUAN = [
  ['hari', 24 * 60 * MENIT],
  ['jam', 60 * MENIT],
  ['menit', MENIT],
];

/** Lama sejak `iso` dalam satuan terbesar yang masuk akal, mis. "3 hari". */
export function lamaSejak(iso) {
  if (!iso) return null;
  const selisih = Date.now() - new Date(iso).getTime();
  if (selisih < MENIT) return 'baru saja';
  const [nama, besar] = SATUAN.find(([, b]) => selisih >= b) ?? SATUAN[SATUAN.length - 1];
  return `${Math.floor(selisih / besar)} ${nama}`;
}
