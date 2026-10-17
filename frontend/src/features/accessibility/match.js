// Perhitungan skor (match_pct, label, urutan) dilakukan BACKEND di SQL. Di sini hanya
// pemetaan label -> tampilan, plus rincian terpenuhi/tidak/unknown untuk halaman detail.
export const LEVELS = {
  high: { key: 'high', label: 'Sangat Sesuai', symbol: '●', bg: '#166534', cls: 'bg-match-high-bg text-match-high' },
  partial: { key: 'partial', label: 'Sebagian Sesuai', symbol: '◐', bg: '#92400e', cls: 'bg-match-partial-bg text-match-partial' },
  low: { key: 'low', label: 'Kurang Sesuai', symbol: '○', bg: '#991b1b', cls: 'bg-match-low-bg text-match-low' },
  limited: { key: 'limited', label: 'Data Terbatas', symbol: '?', bg: '#334155', cls: 'bg-match-limited-bg text-match-limited' },
  // Belum ada kebutuhan yang dipilih: marker TANPA penilaian. Warnanya abu, bukan ungu
  // merek — kalau ungu, penanda "belum dinilai" terlihat sama menonjol dengan tombol
  // aksi, dan warna berhenti menyampaikan status apa pun.
  neutral: { key: 'neutral', label: 'Fasilitas', symbol: '', bg: '#475569', cls: 'bg-neutral-bg text-neutral' },
};

const BY_LABEL = Object.fromEntries(Object.values(LEVELS).map((l) => [l.label, l]));

// `label` dikirim backend hanya bila ada kebutuhan yang dipilih
export const levelFor = (f) => BY_LABEL[f.label] ?? LEVELS.neutral;

// Ubah bentuk backend (lat/lon, category_code) ke bentuk yang dipakai komponen
export function normalizeFacility(f) {
  return { ...f, category: f.category_code, location: { type: 'Point', coordinates: [f.lon, f.lat] } };
}

// Rincian untuk detail: atribut dari backend: [{ code, status, notes }]
export function breakdown(attributes = [], needs = []) {
  const byCode = Object.fromEntries(attributes.map((a) => [a.code, a.status]));
  const met = [];
  const notAvailable = [];
  const unknown = [];
  needs.forEach((code) => {
    const s = byCode[code] ?? 'unknown';
    if (s === 'available') met.push(code);
    else if (s === 'not_available') notAvailable.push(code);
    else unknown.push(code);
  });
  return { met, notAvailable, unknown };
}
