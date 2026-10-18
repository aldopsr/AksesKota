// Import lin transportasi umum (KRL, MRT, LRT, Transjakarta) dari OSM ke
// transit_lines + transit_stops.
//   node --env-file-if-exists=.env db/import-transit.js --dry
//   node --env-file-if-exists=.env db/import-transit.js
//
// Kenapa OSM dan bukan GTFS resmi: GTFS Transjakarta dan KAI Commuter tidak
// diterbitkan sebagai umpan publik yang stabil, sementara relasi route di OSM
// memuat urutan pemberhentian untuk 32 dari 34 lin rel Jabodetabek lengkap dengan
// warna resminya. Kita memang hanya butuh daftar berhenti, bukan jadwal.

import { fetchOverpass } from './overpass.js';

const dry = process.argv.includes('--dry');

const WILAYAH = [
  { nama: 'Jabodetabek', bbox: '-6.60,106.60,-6.05,107.05' },
  { nama: 'Bandung Raya', bbox: '-7.05,107.45,-6.80,107.80' },
];

// Operator sempat dibatasi ke Transjakarta/KAI/MRT/LRT dengan alasan angkot tidak
// punya pemberhentian tetap. Alasannya benar, kesimpulannya salah: angkot justru
// tulang punggung angkutan DALAM kota, dan menyaringnya keluar membuat setiap
// perjalanan dalam Kota Bogor dijawab "tidak ada lin yang menghubungkan".
// Yang dibutuhkan bukan menyaringnya, melainkan menyimpan JALUR-nya.
// Himpunan relasi diberi nama (->.r). Tanpa itu, "way(r)" membaca himpunan hasil
// TERAKHIR — yang sudah berganti menjadi kumpulan node oleh baris sebelumnya — dan
// mengembalikan nol ruas tanpa pesan kesalahan apa pun.
const queryUntuk = (bbox) => `[out:json][timeout:240];
rel["type"="route"]["route"~"^(train|subway|light_rail|bus|minibus|share_taxi)$"](${bbox})->.r;
.r out body;
node(r.r); out tags center;
way(r.r); out geom;`;

const relasi = new Map();
const nodes = new Map();
const ways = new Map();

for (const w of WILAYAH) {
  console.log(`[${w.nama}] Overpass: relasi rute transportasi umum`);
  const { elements = [] } = await fetchOverpass(queryUntuk(w.bbox));
  for (const el of elements) {
    if (el.type === 'relation') relasi.set(el.id, el);
    else if (el.type === 'node') nodes.set(el.id, el);
    else if (el.type === 'way' && Array.isArray(el.geometry)) ways.set(el.id, el.geometry);
  }
  console.log(`[${w.nama}] total terkumpul: ${relasi.size} relasi, ${nodes.size} node, ${ways.size} ruas`);
}

const lines = [];
const stops = [];
let tanpaBerhenti = 0;

for (const rel of relasi.values()) {
  const t = rel.tags ?? {};
  const urut = [];
  for (const m of rel.members ?? []) {
    if (m.type !== 'node' || !/^(stop|platform)/.test(m.role)) continue;
    const n = nodes.get(m.ref);
    const nama = n?.tags?.name;
    if (!nama) continue;
    // Satu stasiun sering jadi dua anggota berturut-turut (stop_position + platform).
    // Yang kita simpan urutan stasiunnya, bukan urutan objek petanya.
    if (urut[urut.length - 1]?.name === nama) continue;
    urut.push({ name: nama, lon: n.lon ?? n.center?.lon, lat: n.lat ?? n.center?.lat });
  }
  // Jalur lin: gabungan ruas-ruas anggotanya. Tidak disambung jadi satu garis —
  // untuk menjawab "lin ini lewat dekat sini?" yang dibutuhkan hanya jaraknya,
  // dan menyambung ruas yang arahnya campur aduk justru menghasilkan garis ngawur.
  const potongan = [];
  for (const m of rel.members ?? []) {
    if (m.type !== 'way') continue;
    const g = ways.get(m.ref);
    if (!g || g.length < 2) continue;
    potongan.push(`(${g.map((t) => `${t.lon} ${t.lat}`).join(',')})`);
  }
  const berhenti = urut.filter((s) => s.lon != null);

  // Diterima bila punya urutan perhentian ATAU jalur. Dulu syaratnya perhentian saja,
  // dan itulah yang membuang seluruh angkot.
  if (berhenti.length < 2 && potongan.length === 0) { tanpaBerhenti++; continue; }

  lines.push({
    osm_id: rel.id,
    name: t.name ?? `${t.operator ?? 'Lin'} ${t.ref ?? rel.id}`,
    mode: t.route,
    operator: t.operator ?? null,
    ref: t.ref ?? null,
    colour: t.colour ?? null,
    wkt: potongan.length ? `MULTILINESTRING(${potongan.join(',')})` : null,
  });
  urut.forEach((s, i) => {
    if (s.lon == null) return;
    stops.push({ line_id: rel.id, seq: i, name: s.name, lon: s.lon, lat: s.lat });
  });
}

console.log(`\n${relasi.size} relasi -> ${lines.length} lin, ${stops.length} pemberhentian`);
console.log(`dilewati karena tidak punya perhentian maupun jalur: ${tanpaBerhenti}`);
console.log(`punya jalur: ${lines.filter((l) => l.wkt).length}, punya urutan perhentian: ${new Set(stops.map((s) => s.line_id)).size}`);
console.table(
  Object.entries(lines.reduce((a, l) => ({ ...a, [l.mode]: (a[l.mode] ?? 0) + 1 }), {}))
    .map(([mode, jumlah]) => ({ mode, jumlah })),
);

if (dry) {
  console.log('\n--dry: tidak ada yang ditulis ke database.');
  process.exit(0);
}

const { pool } = await import('../src/db.js');

// Jalur disimpan per potongan 200 lin: satu MULTILINESTRING angkot bisa puluhan ribu
// titik, dan mengirim semuanya dalam satu pernyataan melampaui batas parameter.
for (let i = 0; i < lines.length; i += 200) {
  const b = lines.slice(i, i + 200);
  await pool.query(
    `insert into transit_lines (osm_id, name, mode, operator, ref, colour, geom)
     select osm_id, name, mode, operator, ref, colour,
            case when wkt is null then null else st_geogfromtext('SRID=4326;' || wkt) end
       from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
            as t(osm_id, name, mode, operator, ref, colour, wkt)
     on conflict (osm_id) do update set
       name=excluded.name, mode=excluded.mode, operator=excluded.operator,
       ref=excluded.ref, colour=excluded.colour, geom=excluded.geom`,
    ['osm_id', 'name', 'mode', 'operator', 'ref', 'colour', 'wkt'].map((k) => b.map((l) => l[k])),
  );
}

// Urutan berhenti sebuah lin bisa BERUBAH panjangnya saat OSM diperbarui (stasiun baru,
// lin diperpanjang). Upsert per baris akan meninggalkan ekor baris lama, jadi
// pemberhentian lin yang diimpor dihapus dulu, bukan ditimpa satu per satu.
await pool.query(`delete from transit_stops where line_id = any($1::bigint[])`, [lines.map((l) => l.osm_id)]);

const UKURAN_BATCH = 500;
for (let i = 0; i < stops.length; i += UKURAN_BATCH) {
  const b = stops.slice(i, i + UKURAN_BATCH);
  await pool.query(
    `insert into transit_stops (line_id, seq, name, location)
     select line_id, seq, name, st_setsrid(st_makepoint(lon, lat), 4326)::geography
       from unnest($1::bigint[], $2::int[], $3::text[], $4::float8[], $5::float8[])
            as t(line_id, seq, name, lon, lat)`,
    [b.map((s) => s.line_id), b.map((s) => s.seq), b.map((s) => s.name), b.map((s) => s.lon), b.map((s) => s.lat)],
  );
  console.log(`  ${Math.min(i + UKURAN_BATCH, stops.length)}/${stops.length}`);
}

const { rows } = await pool.query(`
  select (select count(*) from transit_lines) lin,
         (select count(*) from transit_stops) pemberhentian,
         (select count(distinct lower(name)) from transit_stops) stasiun_unik,
         (select count(*) from transit_lines where geom is not null) punya_jalur`);
console.log('\ntersimpan:');
console.table(rows);
await pool.end();
