// npm test — satu file, assert biasa, tanpa framework.
// Yang dijaga di sini: aturan yang kalau rusak bikin produk salah secara substansi.
import assert from 'node:assert/strict';
import { matchLabel, freshness } from '../src/match.js';

// --- label marker (PRD 13) ---
assert.equal(matchLabel(100, 0).label, 'Sangat Sesuai');
assert.equal(matchLabel(80, 0).label, 'Sangat Sesuai');
assert.equal(matchLabel(75, 0).label, 'Sebagian Sesuai');
assert.equal(matchLabel(25, 0).label, 'Kurang Sesuai');
assert.equal(matchLabel(0, 0).label, 'Kurang Sesuai');
assert.equal(matchLabel(null, 0), null, 'tanpa kebutuhan user, tidak ada label match');
// Banyak unknown -> abu-abu, walau persentasenya kebetulan tinggi
assert.equal(matchLabel(100, 0.5).label, 'Data Terbatas');
assert.notEqual(matchLabel(100, 0.4).label, 'Data Terbatas');

// --- freshness (PRD 12.5 / FR-20) ---
assert.equal(freshness(null), 'needs_reverification');
assert.equal(freshness(new Date()), 'verified_recently');
assert.equal(freshness(new Date(Date.now() - 400 * 86_400_000)), 'needs_reverification');

// --- skor rute (PRD 19.7) ---
const { skorRute } = await import('../src/routes/route.js');

// Tanpa data jalur yang diketahui: urutkan dengan jarak saja, jangan mengarang penalti.
const tanpaData = skorRute({ accessibility: null, distanceM: 1200, tersingkatM: 1000 });
assert.equal(tanpaData.accessibility_score, null);
assert.equal(tanpaData.basis, 'jarak_saja');
assert.equal(tanpaData.score, tanpaData.distance_score);

// Rute tersingkat mendapat distance_score penuh.
assert.equal(skorRute({ accessibility: 1, distanceM: 1000, tersingkatM: 1000 }).distance_score, 1);
// Bobot 70/30 benar-benar diterapkan.
assert.equal(skorRute({ accessibility: 1, distanceM: 1000, tersingkatM: 1000 }).score, 1);
assert.equal(skorRute({ accessibility: 0, distanceM: 1000, tersingkatM: 1000 }).score, 0.3);

// Inti PRD 19.7: rute lebih aksesibel walau lebih jauh harus mengalahkan rute terpendek
// yang buruk aksesibilitasnya. Kalau assert ini jatuh, bobotnya terbalik.
const pendekTapiBuruk = skorRute({ accessibility: 0.2, distanceM: 1000, tersingkatM: 1000 });
const jauhTapiBaik = skorRute({ accessibility: 1.0, distanceM: 1400, tersingkatM: 1000 });
assert.ok(jauhTapiBaik.score > pendekTapiBuruk.score, 'aksesibilitas kalah oleh jarak — bobot 70/30 salah');

if (!process.env.DATABASE_URL) {
  console.log('OK (logic only) — set DATABASE_URL untuk menjalankan cek database');
  process.exit(0);
}

const { searchFacilities } = await import('../src/routes/facilities.js');
const { pool } = await import('../src/db.js');

// AC-03: unknown tidak boleh dihitung sebagai terpenuhi.
// Terminal Baranangsiang di seed: ramp/toilet = not_available, lift = unknown.
const needs = ['ramp', 'accessible_toilet', 'lift'];
const hasil = await searchFacilities({ q: 'Terminal Baranangsiang', needs });
assert.equal(hasil.length, 1, 'fasilitas seed tidak ditemukan — jalankan npm run db:reset');
assert.equal(hasil[0].match_pct, 0, 'unknown/not_available bocor jadi terpenuhi');
assert.equal(hasil[0].needs_unknown, 1);

// Sorting: match desc lebih dulu, baru jarak asc (PRD 15).
const dekatStasiun = await searchFacilities({
  needs: ['ramp', 'lift', 'accessible_toilet', 'accessible_parking'],
  lat: -6.5951, lon: 106.7901, radius: 5000, limit: 50,
});
assert.ok(dekatStasiun.length > 1);
for (let i = 1; i < dekatStasiun.length; i++) {
  const a = dekatStasiun[i - 1], b = dekatStasiun[i];
  assert.ok(a.match_pct >= b.match_pct, `urutan match salah: ${a.name} < ${b.name}`);
  if (a.match_pct === b.match_pct) assert.ok(a.distance_m <= b.distance_m, `urutan jarak salah di ${b.name}`);
}

// radius benar-benar memotong hasil
const dalam1km = await searchFacilities({ lat: -6.5951, lon: 106.7901, radius: 1000 });
assert.ok(dalam1km.every((f) => f.distance_m <= 1000));
assert.ok(dalam1km.length < dekatStasiun.length, 'radius tidak berpengaruh');

// ---------------------------------------------------------------------------
// Jalur kontribusi -> verifikasi admin. Diuji lewat HTTP sungguhan karena
// aturannya (wajib foto, pending tidak mengubah data resmi, approve sekali saja)
// hidup di dalam route handler, bukan di fungsi terpisah.
// ---------------------------------------------------------------------------

// Mencegah src/index.js memanggil listen() sendiri di port 3000 — kita listen di port acak.
process.env.VERCEL = '1';
const { default: app } = await import('../src/index.js');
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;

const api = async (path, { token, ...init } = {}) => {
  const res = await fetch(base + path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const email = `smoke-${Date.now()}@test.local`;
const daftar = await api('/api/auth/register', { method: 'POST', body: { email, password: 'rahasia123', name: 'Smoke Test' } });
assert.equal(daftar.status, 201, JSON.stringify(daftar.body));
const userToken = daftar.body.token;

const masukAdmin = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@akseskota.id', password: 'admin12345' } });
assert.equal(masukAdmin.status, 200, 'akun admin seed tidak bisa login — jalankan npm run db:reset');
const adminToken = masukAdmin.body.token;

const target = (await searchFacilities({ q: 'Terminal Baranangsiang' }))[0];

// FR-08: atribut utama tanpa foto bukti harus ditolak.
const tanpaFoto = await api('/api/contributions', {
  method: 'POST', token: userToken,
  body: { facility_id: target.id, change_type: 'update', payload: { attributes: { ramp: 'available' } }, photos: [] },
});
assert.equal(tanpaFoto.status, 400, 'atribut utama lolos tanpa foto bukti');

// Atribut non-utama boleh tanpa foto.
const kirim = await api('/api/contributions', {
  method: 'POST', token: userToken,
  body: { facility_id: target.id, change_type: 'update', payload: { attributes: { audio_access: 'available' } } },
});
assert.equal(kirim.status, 201, JSON.stringify(kirim.body));
assert.equal(kirim.body.status, 'pending');

// AC-06: selama pending, data resmi TIDAK berubah.
const saatPending = await api(`/api/facilities/${target.id}`);
assert.equal(
  saatPending.body.attributes.find((a) => a.code === 'audio_access').status, 'unknown',
  'kontribusi pending sudah mengubah data resmi',
);

// Non-admin tidak boleh masuk layar verifikasi.
assert.equal((await api('/api/admin/contributions', { token: userToken })).status, 403);

// Layar verifikasi harus memperlihatkan nilai sebelum vs usulan (PRD 12.4).
const detail = await api(`/api/admin/contributions/${kirim.body.id}`, { token: adminToken });
assert.equal(detail.status, 200);
assert.deepEqual(
  detail.body.perbandingan.map((p) => [p.code, p.status_sebelum, p.status_usulan]),
  [['audio_access', 'unknown', 'available']],
);

const setuju = await api(`/api/admin/contributions/${kirim.body.id}/review`, {
  method: 'POST', token: adminToken, body: { action: 'approve' },
});
assert.equal(setuju.status, 200, JSON.stringify(setuju.body));

const setelahApprove = await api(`/api/facilities/${target.id}`);
assert.equal(
  setelahApprove.body.attributes.find((a) => a.code === 'audio_access').status, 'available',
  'approve tidak menulis ke data resmi',
);
assert.equal(setelahApprove.body.freshness, 'verified_recently');

// Approve dua kali harus ditolak.
const ulang = await api(`/api/admin/contributions/${kirim.body.id}/review`, {
  method: 'POST', token: adminToken, body: { action: 'approve' },
});
assert.equal(ulang.status, 409, 'kontribusi bisa di-approve dua kali');

// Reject tidak boleh mengubah data resmi.
const kirim2 = await api('/api/contributions', {
  method: 'POST', token: userToken,
  body: { facility_id: target.id, change_type: 'update', payload: { attributes: { audio_access: 'not_available' } } },
});
await api(`/api/admin/contributions/${kirim2.body.id}/review`, {
  method: 'POST', token: adminToken, body: { action: 'reject', note: 'uji smoke' },
});
const setelahReject = await api(`/api/facilities/${target.id}`);
assert.equal(
  setelahReject.body.attributes.find((a) => a.code === 'audio_access').status, 'available',
  'reject mengubah data resmi',
);

// Profil aksesibilitas ikut dipakai otomatis saat needs tidak dikirim.
await api('/api/profile/accessibility', { method: 'PUT', token: userToken, body: { needs: ['ramp', 'lift'] } });
const pakaiProfil = await api('/api/facilities?limit=5', { token: userToken });
assert.deepEqual(pakaiProfil.body.needs, ['ramp', 'lift'], 'profil user tidak dipakai sebagai kebutuhan default');
const matiProfil = await api('/api/facilities?needs=none&limit=5', { token: userToken });
assert.deepEqual(matiProfil.body.needs, [], 'needs=none tidak mematikan profil');
assert.equal((await api('/api/profile/accessibility', { method: 'PUT', token: userToken, body: { needs: ['ngawur'] } })).status, 400);

// ---------------------------------------------------------------------------
// Batas kepercayaan AI (FR-16). Ini lapisan yang mencegah output model
// menyentuh SQL mentah-mentah, jadi diuji dengan output yang sengaja nakal.
// ---------------------------------------------------------------------------
const { validateIntent } = await import('../src/routes/ai.js');

// Kategori dan kode atribut karangan harus dibuang, bukan diteruskan ke query.
const nakal = await validateIntent({
  intent: 'search_facility',
  category: 'hotel_bintang_lima',
  accessibility_requirements: ['ramp', 'kolam_renang', 'lift', 'teleportasi'],
  radius_m: 999_999_999,
  query: null,
});
assert.equal(nakal.category, null, 'kategori halusinasi lolos ke query');
assert.deepEqual(nakal.accessibility_requirements, ['ramp', 'lift'], 'kode atribut karangan lolos');
assert.equal(nakal.radius_m, 20_000, 'radius tidak dijepit');

// Kategori yang memang ada harus lolos.
assert.equal((await validateIntent({ intent: 'search_facility', category: 'kesehatan' })).category, 'kesehatan');

// Intent di luar daftar harus ditolak, bukan diteruskan.
await assert.rejects(() => validateIntent({ intent: 'drop_table' }), 'intent asing diterima');
await assert.rejects(() => validateIntent({ intent: 'search_facility', query: 'x'.repeat(500) }), 'query kepanjangan diterima');

// NFR-04 / PRD 30.7: AI mati tidak boleh mematikan pencarian biasa.
const kunciAsli = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
const aiMati = await api('/api/ai/query', { method: 'POST', body: { text: 'cari rumah sakit yang ada ramp' } });
assert.equal(aiMati.status, 503, 'AI tanpa API key tidak mengembalikan 503');
assert.equal(aiMati.body.fallback, 'search', 'tidak ada petunjuk fallback untuk frontend');
assert.equal(aiMati.body.query, 'cari rumah sakit yang ada ramp', 'teks asli tidak dikembalikan untuk fallback');
if (kunciAsli) process.env.GEMINI_API_KEY = kunciAsli;
// Peta & pencarian biasa harus tetap hidup setelah AI gagal.
assert.equal((await api('/api/facilities?limit=3')).status, 200, 'pencarian biasa mati saat AI gagal');

// ---------------------------------------------------------------------------
// Review, report, dan proteksi brute-force
// ---------------------------------------------------------------------------

// PRD 20: rating adalah informasi TERPISAH dari Accessibility Match.
const sebelumReview = await api(`/api/facilities/${target.id}?needs=ramp,lift`);
const review = await api(`/api/facilities/${target.id}/reviews`, {
  method: 'POST', token: userToken, body: { rating: 5, content: 'Uji smoke' },
});
assert.equal(review.status, 201, JSON.stringify(review.body));
const sesudahReview = await api(`/api/facilities/${target.id}?needs=ramp,lift`);
assert.equal(
  sesudahReview.body.match_pct, sebelumReview.body.match_pct,
  'rating ikut mengubah Accessibility Match — PRD 20 dilanggar',
);
assert.equal(sesudahReview.body.rating_avg, 5);
assert.equal(sesudahReview.body.rating_count, 1);

// Kirim ulang = mengubah review sendiri, bukan menambah baris baru.
await api(`/api/facilities/${target.id}/reviews`, { method: 'POST', token: userToken, body: { rating: 3 } });
const setelahEdit = await api(`/api/facilities/${target.id}`);
assert.equal(setelahEdit.body.rating_count, 1, 'review ganda tercipta untuk satu user');
assert.equal(setelahEdit.body.rating_avg, 3);
assert.equal((await api(`/api/facilities/${target.id}/reviews`, { method: 'POST', token: userToken, body: { rating: 9 } })).status, 400);

// Report -> admin menutup laporan.
const lapor = await api('/api/reports', {
  method: 'POST', token: userToken,
  body: { facility_id: target.id, report_type: 'atribut_tidak_sesuai', description: 'uji smoke' },
});
assert.equal(lapor.status, 201, JSON.stringify(lapor.body));
assert.equal((await api('/api/admin/reports', { token: userToken })).status, 403, 'non-admin bisa lihat laporan');
assert.ok((await api('/api/admin/reports', { token: adminToken })).body.some((r) => r.id === lapor.body.id));
assert.equal(
  (await api(`/api/admin/reports/${lapor.body.id}/resolve`, { method: 'POST', token: adminToken, body: { action: 'resolve', note: 'uji' } })).status,
  200,
);
// Laporan yang sudah ditutup tidak bisa ditutup dua kali.
assert.equal(
  (await api(`/api/admin/reports/${lapor.body.id}/resolve`, { method: 'POST', token: adminToken, body: { action: 'dismiss' } })).status,
  409,
);
// Laporan konten review wajib menyertakan review_id.
assert.equal(
  (await api('/api/reports', { method: 'POST', token: userToken, body: { facility_id: target.id, report_type: 'review_bermasalah' } })).status,
  400,
);

// NFR-05: brute-force login harus terbendung. Dijalankan paling akhir karena
// mengunci IP ini selama 15 menit.
await pool.query('delete from login_attempts');
let kena429 = false;
for (let i = 0; i < 12; i++) {
  const r = await api('/api/auth/login', { method: 'POST', body: { email, password: 'salahSemua123' } });
  if (r.status === 429) { kena429 = true; break; }
  assert.equal(r.status, 401);
}
assert.ok(kena429, 'login bisa dicoba tanpa batas — proteksi brute-force tidak jalan');
await pool.query('delete from login_attempts'); // buka kunci lagi untuk run berikutnya

// Bersihkan jejak uji supaya run berikutnya tetap valid.
await pool.query('delete from reports where description = $1', ['uji smoke']);
await pool.query("delete from ai_usage where key like '%:ip:%'");
// contributions.submitted_by tidak cascade, jadi harus dihapus lebih dulu.
await pool.query('delete from contributions where submitted_by = $1', [daftar.body.user.id]);
await pool.query('delete from users where id = $1', [daftar.body.user.id]);
await pool.query(
  `update accessibility_facilities set status='unknown', verified_by=null, verified_at=null
    where facility_id=$1 and attribute_code='audio_access'`,
  [target.id],
);

server.close();
await pool.end();
console.log(`OK — ${dekatStasiun.length} fasilitas dalam 5km; match, sorting, crowdsourcing, verifikasi admin, review/report & proteksi brute-force lolos`);
