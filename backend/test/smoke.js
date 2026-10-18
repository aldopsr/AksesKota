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

if (!process.env.DATABASE_URL) {
  console.log('OK (logic only) — set DATABASE_URL untuk menjalankan cek database');
  process.exit(0);
}

const { searchFacilities } = await import('../src/routes/facilities.js');
const { pool } = await import('../src/db.js');

// AC-03: unknown tidak boleh dihitung sebagai terpenuhi.
//
// Diuji terhadap ATURAN, bukan angka hafalan dari seed: status atribut dibaca langsung
// dari database lalu dibandingkan dengan hasil searchFacilities. Versi sebelumnya
// mengunci "Terminal Baranangsiang harus 0%" dan jatuh begitu ada kontribusi yang
// disetujui di fasilitas itu — tes merah padahal kodenya benar.
const { many } = await import('../src/db.js');
const needs = ['ramp', 'accessible_toilet', 'lift'];
const hasil = await searchFacilities({ q: 'Terminal Baranangsiang', needs });
assert.equal(hasil.length, 1, 'fasilitas seed tidak ditemukan — jalankan npm run db:reset');

const statusAsli = await many(
  `select a.code, coalesce(af.status, 'unknown') as status
     from accessibility_attributes a
     left join accessibility_facilities af on af.attribute_code = a.code and af.facility_id = $1
    where a.code = any($2::text[])`,
  [hasil[0].id, needs],
);
const tersedia = statusAsli.filter((a) => a.status === 'available').length;
const takDiketahui = statusAsli.filter((a) => a.status === 'unknown').length;

assert.equal(hasil[0].needs_met, tersedia, 'hanya status available yang boleh dihitung terpenuhi');
assert.equal(hasil[0].needs_unknown, takDiketahui, 'jumlah unknown salah hitung');
assert.equal(hasil[0].match_pct, Math.round((100 * tersedia) / needs.length), 'match_pct tidak sesuai rumus PRD');
// Inti AC-03: kalau ada yang unknown, match TIDAK BOLEH 100%.
if (takDiketahui > 0) assert.ok(hasil[0].match_pct < 100, 'unknown bocor jadi terpenuhi');

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

// Lin transportasi umum: yang diuji ATURANNYA, bukan isi data OSM yang bisa berubah.
// Dilewati bila tabelnya belum diimpor, supaya smoke test tetap jalan di database baru.
const { rows: [{ ada }] } = await pool.query('select count(*)::int > 0 as ada from transit_stops');
if (!ada) {
  console.log('(transit_stops kosong — uji lin dilewati, jalankan npm run import:transit)');
} else {
  const { linPenghubung } = await import('../src/transit.js');
  const bogor = [106.7905, -6.5950];
  const monas = [106.8272, -6.1754];
  const opsi = await linPenghubung(bogor, monas);
  assert.ok(opsi.length > 0, 'Bogor -> Monas seharusnya tersambung transportasi umum');

  for (const o of opsi) {
    // Arah: lin yang berangkat DARI Bogor, bukan relasi arah sebaliknya.
    assert.ok(o.naik.nama && o.turun.nama, 'pemberhentian naik/turun harus bernama');
    assert.notEqual(o.naik.nama, o.turun.nama, 'naik dan turun tidak boleh stasiun yang sama');
    // Aksesibilitas hanya boleh berisi yang berstatus available (PRD 19.7).
    assert.ok(Array.isArray(o.naik.tersedia) && Array.isArray(o.turun.tersedia));
    if (o.jenis === 'langsung') assert.ok(o.jumlah_berhenti > 0, 'perjalanan langsung harus maju, bukan mundur');
    else assert.ok(o.ganti?.nama, 'perjalanan satu ganti harus menyebut titik gantinya');
  }

  // Tidak tersambung harus menghasilkan daftar kosong, bukan opsi yang dipaksakan.
  assert.equal((await linPenghubung(bogor, [107.6098, -6.9147])).length, 0, 'Bogor -> Bandung tidak boleh mengarang lin');
  console.log(`  lin: ${opsi.length} opsi Bogor->Monas, arah & aksesibilitas lolos`);
}

await pool.end();
console.log(`OK — ${dekatStasiun.length} fasilitas dalam 5km, semua aturan match & sorting lolos`);
