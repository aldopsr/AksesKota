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

// Operator dibatasi supaya angkot dan bus karyawan perumahan — yang dipetakan
// setengah jadi dan tidak punya pemberhentian tetap — tidak ikut masuk.
const OPERATOR = 'Transjakarta|KAI Commuter|MRT Jakarta|LRT Jabodebek';

const queryUntuk = (bbox) => `[out:json][timeout:240];
rel["type"="route"]["route"~"^(train|subway|light_rail|bus)$"]["operator"~"${OPERATOR}",i](${bbox});
out body;
node(r);
out tags center;`;

const relasi = new Map();
const nodes = new Map();

for (const w of WILAYAH) {
  console.log(`[${w.nama}] Overpass: relasi rute transportasi umum`);
  const { elements = [] } = await fetchOverpass(queryUntuk(w.bbox));
  for (const el of elements) {
    if (el.type === 'relation') relasi.set(el.id, el);
    else if (el.type === 'node') nodes.set(el.id, el);
  }
  console.log(`[${w.nama}] total terkumpul: ${relasi.size} relasi, ${nodes.size} node`);
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
  if (urut.filter((s) => s.lon != null).length < 2) { tanpaBerhenti++; continue; }

  lines.push({
    osm_id: rel.id,
    name: t.name ?? `${t.operator ?? 'Lin'} ${t.ref ?? rel.id}`,
    mode: t.route,
    operator: t.operator ?? null,
    ref: t.ref ?? null,
    colour: t.colour ?? null,
  });
  urut.forEach((s, i) => {
    if (s.lon == null) return;
    stops.push({ line_id: rel.id, seq: i, name: s.name, lon: s.lon, lat: s.lat });
  });
}

console.log(`\n${relasi.size} relasi -> ${lines.length} lin, ${stops.length} pemberhentian`);
console.log(`dilewati karena urutan berhentinya tidak terbaca: ${tanpaBerhenti}`);
console.table(
  Object.entries(lines.reduce((a, l) => ({ ...a, [l.mode]: (a[l.mode] ?? 0) + 1 }), {}))
    .map(([mode, jumlah]) => ({ mode, jumlah })),
);

if (dry) {
  console.log('\n--dry: tidak ada yang ditulis ke database.');
  process.exit(0);
}

const { pool } = await import('../src/db.js');

await pool.query(
  `insert into transit_lines (osm_id, name, mode, operator, ref, colour)
   select * from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
   on conflict (osm_id) do update set
     name=excluded.name, mode=excluded.mode, operator=excluded.operator,
     ref=excluded.ref, colour=excluded.colour`,
  ['osm_id', 'name', 'mode', 'operator', 'ref', 'colour'].map((k) => lines.map((l) => l[k])),
);

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
         (select count(*) from transit_lines where colour is not null) punya_warna`);
console.log('\ntersimpan:');
console.table(rows);
await pool.end();
