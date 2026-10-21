// Pengukuran mutu pemahaman AI terhadap target PRD §29.
//
// PERINGATAN — HASIL DI SINI ADALAH ARSIP, BUKAN PENGUKURAN HIDUP.
//
// Berkas ini menguji endpoint POST /api/ai/query: parser niat satu-tembakan yang
// dipakai asisten versi lama. Endpoint itu SUDAH TIDAK ADA; asisten sekarang dibangun
// ulang di atas function calling (/api/ai/chat) sehingga "intent" tidak lagi berupa
// field di JSON melainkan tersirat dari alat mana yang dipanggil.
//
// Artinya: 55 hasil yang tersimpan di ai-eval-results.json adalah pengukuran sah
// tertanggal 7 Oktober terhadap parser lama, dan harness ini TIDAK bisa mengukur
// asisten yang sekarang tanpa ditulis ulang. Menghapus entri lalu menjalankan ulang
// hanya akan mencatat HTTP 404 dan merusak buktinya — karena itu ada penjaga di bawah
// yang menghentikan eksekusi begitu endpointnya tidak ditemukan.
//
//   npm run eval:ai              -> jalankan semua kasus
//   npm run eval:ai -- --limit 20 -> 20 kasus pertama (hemat kuota Gemini)
//   npm run eval:ai -- --gagal    -> cetak hanya kasus yang meleset
//
// Target PRD §29: >=90% intent dikenali, >=90% parameter penting terekstrak,
// >=90% menghasilkan structured JSON valid.
//
// Ini mengukur PEMAHAMAN BAHASA, bukan isi database. Kasus uji tidak memeriksa
// nama fasilitas yang keluar — itu urusan smoke.js — karena hasil pencarian berubah
// setiap kali dataset bertambah, sementara maksud kalimatnya tidak.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Kuota harian Gemini free tier hanya cukup ~20-30 panggilan, sementara PRD 29 minta
// 50-100 kasus. Jadi hasil tiap kasus disimpan dan dijumlahkan lintas hari: jalankan
// lagi besok, kasus yang sudah tercatat dilewati, sampai semuanya terkumpul.
// Berkas hasilnya sengaja ikut di-commit sebagai bukti pengukuran.
const BERKAS = new URL('./ai-eval-results.json', import.meta.url);
const muat = () => (existsSync(BERKAS) ? JSON.parse(readFileSync(BERKAS, 'utf8')) : {});
const simpan = (d) => writeFileSync(BERKAS, JSON.stringify(d, null, 2) + '\n');

const arg = (nama) => {
  const i = process.argv.indexOf(nama);
  return i === -1 ? null : process.argv[i + 1];
};
const batas = Number(arg('--limit')) || Infinity;
const hanyaGagal = process.argv.includes('--gagal');

const LOKASI = { lat: -6.5951, lon: 106.7901 }; // Stasiun Bogor, untuk kasus "dekat saya"

// `needs` = kebutuhan yang DISEBUT pengguna dan wajib terekstrak.
// `category` = null berarti tidak dinilai (kalimatnya tidak menyebut jenis tempat).
const KASUS = [
  // --- search_nearest_facility: ada kata "terdekat"/"dekat saya"/radius ---
  { teks: 'Cari rumah sakit yang punya ramp dan toilet disabilitas di dekat saya', intent: 'search_nearest_facility', category: 'kesehatan', needs: ['ramp', 'accessible_toilet'], lokasi: true },
  { teks: 'Saya menggunakan kursi roda. Cari mall terdekat yang punya lift, ramp, dan parkir disabilitas', intent: 'search_nearest_facility', category: 'komersial', needs: ['lift', 'ramp', 'accessible_parking'], lokasi: true },
  { teks: 'Cari fasilitas kesehatan yang aksesibel dalam radius dua kilometer dari sini', intent: 'search_nearest_facility', category: 'kesehatan', needs: [], radius: 2000, lokasi: true },
  { teks: 'Puskesmas terdekat yang ada ramp', intent: 'search_nearest_facility', category: 'kesehatan', needs: ['ramp'], lokasi: true },
  { teks: 'Di sekitar sini ada stasiun yang punya guiding block?', intent: 'search_nearest_facility', category: 'transportasi', needs: ['guiding_block'], lokasi: true },
  { teks: 'Cari apotek terdekat', intent: 'search_nearest_facility', category: 'kesehatan', needs: [], lokasi: true },
  { teks: 'Taman terdekat yang bisa dilewati kursi roda', intent: 'search_nearest_facility', category: null, needs: ['wheelchair_path'], lokasi: true },
  { teks: 'Kantor pemerintahan terdekat yang ada lift', intent: 'search_nearest_facility', category: 'layanan_publik', needs: ['lift'], lokasi: true },
  { teks: 'Cari sekolah dalam radius 1 km dari lokasi saya', intent: 'search_nearest_facility', category: 'pendidikan', needs: [], radius: 1000, lokasi: true },
  { teks: 'Mall paling dekat dari posisi saya sekarang', intent: 'search_nearest_facility', category: 'komersial', needs: [], lokasi: true },
  { teks: 'Terminal bus terdekat yang punya toilet disabilitas', intent: 'search_nearest_facility', category: 'transportasi', needs: ['accessible_toilet'], lokasi: true },
  { teks: 'Rumah sakit dalam jarak 5 kilometer dari sini', intent: 'search_nearest_facility', category: 'kesehatan', needs: [], radius: 5000, lokasi: true },
  { teks: 'Klinik terdekat yang ada parkir khusus disabilitas', intent: 'search_nearest_facility', category: 'kesehatan', needs: ['accessible_parking'], lokasi: true },
  { teks: 'Tempat wisata terdekat yang ramah kursi roda', intent: 'search_nearest_facility', category: 'komersial', needs: ['wheelchair_path'], lokasi: true },
  { teks: 'Cari halte di sekitar sini yang ada guiding block dan ramp', intent: 'search_nearest_facility', category: 'transportasi', needs: ['guiding_block', 'ramp'], lokasi: true },

  // --- search_facility: tanpa penekanan jarak ---
  { teks: 'Cari taman yang memiliki jalur kursi roda', intent: 'search_facility', category: null, needs: ['wheelchair_path'] },
  { teks: 'Cari fasilitas publik yang punya guiding block dan akses audio', intent: 'search_facility', category: 'layanan_publik', needs: ['guiding_block', 'audio_access'] },
  { teks: 'Rumah sakit mana saja yang punya lift', intent: 'search_facility', category: 'kesehatan', needs: ['lift'] },
  { teks: 'Tunjukkan sekolah yang punya ramp', intent: 'search_facility', category: 'pendidikan', needs: ['ramp'] },
  { teks: 'Mall apa saja yang punya toilet disabilitas', intent: 'search_facility', category: 'komersial', needs: ['accessible_toilet'] },
  { teks: 'Daftar fasilitas yang menyediakan informasi braille', intent: 'search_facility', category: null, needs: ['braille'] },
  { teks: 'Cari kantor layanan publik yang punya pintu aksesibel', intent: 'search_facility', category: 'layanan_publik', needs: ['accessible_entrance'] },
  { teks: 'Fasilitas kesehatan dengan handrail di tangganya', intent: 'search_facility', category: 'kesehatan', needs: ['handrail'] },
  { teks: 'Tempat yang punya parkir disabilitas dan lift', intent: 'search_facility', category: null, needs: ['accessible_parking', 'lift'] },
  { teks: 'Stasiun yang punya akses audio untuk tunanetra', intent: 'search_facility', category: 'transportasi', needs: ['audio_access'] },
  { teks: 'Saya tunanetra, cari tempat yang ada guiding block dan braille', intent: 'search_facility', category: null, needs: ['guiding_block', 'braille'] },
  { teks: 'Perguruan tinggi yang punya lift dan ramp', intent: 'search_facility', category: 'pendidikan', needs: ['lift', 'ramp'] },
  { teks: 'Cari puskesmas yang toiletnya bisa dipakai pengguna kursi roda', intent: 'search_facility', category: 'kesehatan', needs: ['accessible_toilet'] },
  { teks: 'Tempat rekreasi yang punya jalur kursi roda dan toilet aksesibel', intent: 'search_facility', category: 'komersial', needs: ['wheelchair_path', 'accessible_toilet'] },
  { teks: 'Fasilitas transportasi yang punya tactile paving', intent: 'search_facility', category: 'transportasi', needs: ['guiding_block'] },
  { teks: 'Cari rumah sakit di Bandung', intent: 'search_facility', category: 'kesehatan', needs: [] },
  { teks: 'Mall di Jakarta yang punya lift', intent: 'search_facility', category: 'komersial', needs: ['lift'] },
  { teks: 'Ada sekolah luar biasa yang aksesibel?', intent: 'search_facility', category: 'pendidikan', needs: [] },
  { teks: 'Cari museum yang ramah difabel', intent: 'search_facility', category: 'komersial', needs: [] },
  { teks: 'Saya butuh tempat dengan ramp, lift, dan toilet disabilitas', intent: 'search_facility', category: null, needs: ['ramp', 'lift', 'accessible_toilet'] },

  // --- get_facility_details: pengguna menyebut nama tempat ---
  { teks: 'Tunjukkan detail Stasiun Bogor', intent: 'get_facility_details', category: null, needs: [], query: 'Stasiun Bogor' },
  { teks: 'Informasi tentang Botani Square', intent: 'get_facility_details', category: null, needs: [], query: 'Botani Square' },
  { teks: 'Apakah Kebun Raya Bogor punya toilet disabilitas?', intent: 'get_facility_details', category: null, needs: ['accessible_toilet'], query: 'Kebun Raya Bogor' },
  { teks: 'Balai Kota Bogor ada lift tidak?', intent: 'get_facility_details', category: null, needs: ['lift'], query: 'Balai Kota Bogor' },
  { teks: 'Fasilitas apa saja di RS PMI Bogor', intent: 'get_facility_details', category: null, needs: [], query: 'RS PMI Bogor' },
  { teks: 'Detail Terminal Baranangsiang', intent: 'get_facility_details', category: null, needs: [], query: 'Terminal Baranangsiang' },
  { teks: 'Apakah Taman Sempur bisa diakses kursi roda?', intent: 'get_facility_details', category: null, needs: ['wheelchair_path'], query: 'Taman Sempur' },
  { teks: 'Ceritakan tentang Mal Pelayanan Publik Bogor', intent: 'get_facility_details', category: null, needs: [], query: 'Mal Pelayanan Publik Bogor' },

  // --- generate_route ---
  { teks: 'Tunjukkan rute dari lokasi saya ke tempat yang punya toilet disabilitas', intent: 'generate_route', category: null, needs: ['accessible_toilet'], lokasi: true },
  { teks: 'Antar saya ke rumah sakit terdekat yang ada ramp', intent: 'generate_route', category: 'kesehatan', needs: ['ramp'], lokasi: true },
  { teks: 'Bagaimana cara ke Stasiun Bogor dari sini', intent: 'generate_route', category: null, needs: [], lokasi: true },
  { teks: 'Buatkan rute jalan kaki ke mall terdekat', intent: 'generate_route', category: 'komersial', needs: [], lokasi: true },
  { teks: 'Rute ke puskesmas yang punya jalur kursi roda', intent: 'generate_route', category: 'kesehatan', needs: ['wheelchair_path'], lokasi: true },
  { teks: 'Arahkan saya ke taman yang ada guiding block', intent: 'generate_route', category: null, needs: ['guiding_block'], lokasi: true },
  { teks: 'Saya mau ke Kebun Raya Bogor, tunjukkan jalannya', intent: 'generate_route', category: null, needs: [], lokasi: true },

  // --- clarify: jenis maupun nama tempat tidak disebut (PRD §17.5) ---
  { teks: 'Cari tempat yang aksesibel', intent: 'clarify', category: null, needs: [] },
  { teks: 'Ada rekomendasi?', intent: 'clarify', category: null, needs: [] },
  { teks: 'Tolong carikan sesuatu', intent: 'clarify', category: null, needs: [] },
  { teks: 'Saya butuh bantuan', intent: 'clarify', category: null, needs: [] },
  { teks: 'Yang ramah difabel dong', intent: 'clarify', category: null, needs: [] },
];

process.env.VERCEL = '1'; // cegah index.js memanggil listen() sendiri
const { default: app } = await import('../src/index.js');
const { pool } = await import('../src/db.js');
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;

// Kuota internal bukan objek pengujian di sini. Dibungkus try/catch karena skema
// ai_usage sudah berubah sejak harness ini ditulis (kolom `key` tidak ada lagi) —
// dan membersihkan kuota tidak boleh menghalangi pencetakan hasil yang tersimpan.
try { await pool.query("delete from ai_usage where key like 'ai:%'"); } catch { /* skema lama */ }

const ulang = process.argv.includes('--ulang');
const tersimpan = ulang ? {} : muat();
const belum = KASUS.filter((k) => !tersimpan[k.teks]);
const kasus = belum.slice(0, batas);
let aiMati = 0;

console.log(`${Object.keys(tersimpan).length} kasus sudah tercatat, ${belum.length} belum, ${kasus.length} diuji sekarang.`);

for (const [i, k] of kasus.entries()) {
  const res = await fetch(`${base}/api/ai/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: k.teks, ...(k.lokasi ? LOKASI : {}) }),
  });
  const j = await res.json();

  // Endpoint parser lama sudah dihapus. Berhenti SEBELUM menulis apa pun: satu
  // putaran 404 akan menimpa 55 hasil sah dengan kegagalan palsu.
  if (res.status === 404) {
    console.error('');
    console.error('ENDPOINT /api/ai/query TIDAK ADA LAGI — harness ini mengukur asisten versi lama.');
    console.error('Hasil tersimpan dibiarkan utuh. Untuk mengukur asisten sekarang, tulis ulang');
    console.error('penilaiannya terhadap /api/ai/chat (niat = alat yang dipanggil, parameter = argumennya).');
    server.close();
    await pool.end();
    process.exitCode = 1;
    break;
  }
  if (res.status === 503) { aiMati++; continue; } // AI mati bukan salah pemahaman
  if (res.status !== 200 || !j.parsed) {
    tersimpan[k.teks] = { intent_benar: false, param_benar: false, json_valid: false, sebab: `HTTP ${res.status}: ${j.error?.slice(0, 60)}` };
    simpan(tersimpan);
    continue;
  }

  const p = j.parsed;
  const salah = [];

  // Intent. `clarify` karena lokasi belum diizinkan tidak dihitung salah untuk kasus
  // berlokasi — itu perilaku yang memang dirancang, bukan gagal paham.
  const intentBenar = j.intent === k.intent;
  if (!intentBenar) salah.push(`intent ${j.intent} (harusnya ${k.intent})`);

  // Parameter penting.
  if (k.category && p.category !== k.category) salah.push(`category ${p.category} (harusnya ${k.category})`);
  const kurang = k.needs.filter((n) => !p.accessibility_requirements.includes(n));
  if (kurang.length) salah.push(`kebutuhan tak terbaca: ${kurang.join(',')}`);
  if (k.radius && p.radius_m !== k.radius) salah.push(`radius ${p.radius_m} (harusnya ${k.radius})`);
  if (k.query && !p.query?.toLowerCase().includes(k.query.toLowerCase().split(' ')[0]))
    salah.push(`query "${p.query}" (harusnya memuat "${k.query}")`);

  tersimpan[k.teks] = {
    intent_benar: intentBenar,
    param_benar: salah.length === 0,
    json_valid: true,
    ...(salah.length ? { sebab: salah.join('; '), dapat: JSON.stringify(p).slice(0, 140) } : {}),
  };
  simpan(tersimpan); // disimpan per kasus, supaya kuota habis di tengah jalan tidak membuang hasil

  if (!hanyaGagal) process.stdout.write(salah.length ? 'x' : '.');
  if ((i + 1) % 50 === 0) process.stdout.write('\n');
}

const semua = Object.entries(tersimpan);
const n = semua.length;
const intentBenarTotal = semua.filter(([, v]) => v.intent_benar).length;
const paramBenar = semua.filter(([, v]) => v.param_benar).length;
const jsonValid = semua.filter(([, v]) => v.json_valid).length;
const gagal = semua.filter(([, v]) => !v.param_benar).map(([teks, v]) => ({ teks, ...v }));
const persen = (x) => (n ? Math.round((100 * x) / n) : 0);

console.log(`\n\n=== Hasil evaluasi AI (PRD §29) — ${n}/${KASUS.length} kasus terkumpul${aiMati ? `, ${aiMati} gagal karena kuota habis` : ''} ===`);
if (n < KASUS.length)
  console.log(`Jalankan lagi saat kuota Gemini pulih untuk menguji ${KASUS.length - n} kasus sisanya.`);
console.table([
  { metrik: 'Intent dikenali benar', hasil: `${intentBenarTotal}/${n}`, persen: `${persen(intentBenarTotal)}%`, target: '≥90%', status: persen(intentBenarTotal) >= 90 ? 'LULUS' : 'BELUM' },
  { metrik: 'Parameter penting terekstrak', hasil: `${paramBenar}/${n}`, persen: `${persen(paramBenar)}%`, target: '≥90%', status: persen(paramBenar) >= 90 ? 'LULUS' : 'BELUM' },
  { metrik: 'Structured JSON valid', hasil: `${jsonValid}/${n}`, persen: `${persen(jsonValid)}%`, target: '≥90%', status: persen(jsonValid) >= 90 ? 'LULUS' : 'BELUM' },
]);

if (gagal.length) {
  console.log(`\n${gagal.length} kasus meleset:`);
  for (const g of gagal) console.log(`  "${g.teks}"\n    -> ${g.sebab}\n       ${g.dapat ?? ''}`);
}

server.close();
await pool.end();

// Keluar dengan kode gagal kalau target PRD tidak tercapai, supaya bisa dipakai di CI.
if (n && (persen(intentBenarTotal) < 90 || persen(paramBenar) < 90 || persen(jsonValid) < 90)) process.exitCode = 1;
assert.ok(n > 0, 'tidak ada kasus yang berhasil diuji — periksa GEMINI_API_KEY');
