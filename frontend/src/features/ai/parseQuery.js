// Parser perintah pencarian (suara/teks) berbasis aturan, berjalan di browser.
// Tidak memakai LLM: hasilnya hanya filter (kategori, kebutuhan, radius) yang lalu dikirim
// ke GET /api/facilities, jadi jawaban SELALU berasal dari database, tidak bisa mengarang.
const NUM = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };

const CATEGORY_RULES = [
  ['kesehatan', /(rumah sakit|\brs\b|rsud|puskesmas|klinik|kesehatan|apotek)/],
  ['pendidikan', /(sekolah|kampus|universitas|perpustakaan|pendidikan|institut|\bsma\b|\bsmp\b)/],
  ['layanan_publik', /(kantor|kelurahan|kecamatan|balai kota|pemerintah|layanan publik|pelayanan|mal pelayanan)/],
  ['transportasi', /(stasiun|halte|terminal|bandara|pelabuhan|transportasi)/],
  ['komersial', /(\bmall\b|\bmal\b|plaza|taman|wisata|pantai|rekreasi|kebun raya)/],
];

const NEED_RULES = [
  ['wheelchair_path', /jalur kursi roda/],
  ['ramp', /\bramp\b|tanjakan landai/],
  ['accessible_toilet', /toilet|kamar mandi/],
  ['lift', /\blift\b|elevator/],
  ['accessible_parking', /parkir/],
  ['guiding_block', /guiding|tactile|jalur tuna netra|jalur difabel/],
  ['braille', /braille/],
  ['audio_access', /\baudio\b|suara petunjuk/],
  ['accessible_entrance', /pintu/],
  ['handrail', /handrail|pegangan/],
];

function parseRadius(t) {
  const m = t.match(/(\d+(?:[.,]\d+)?|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*(km|kilometer|meter|m)\b/);
  if (!m) return null;
  const n = NUM[m[1]] ?? parseFloat(m[1].replace(',', '.'));
  return Math.min(50000, Math.round(/^(km|kilometer)$/.test(m[2]) ? n * 1000 : n));
}

export function parseQuery(text) {
  const t = text.toLowerCase();
  const category = CATEGORY_RULES.find(([, re]) => re.test(t))?.[0] ?? null;
  const needs = NEED_RULES.filter(([, re]) => re.test(t)).map(([c]) => c);
  const radius = parseRadius(t);
  const wantsRoute = /(rute|navigasi|antar(kan)?\b|cara ke)/.test(t);
  const nearby = /(dekat|terdekat|sekitar|radius)/.test(t) || radius !== null;
  return {
    category, needs, radius, nearby, wantsRoute,
    understood: !!(category || needs.length),
  };
}
