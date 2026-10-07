// Import jaringan pejalan kaki Kota Bogor dari OSM ke tabel pedestrian_ways.
//   node --env-file-if-exists=.env db/import-ways.js --dry
//   node --env-file-if-exists=.env db/import-ways.js
//
// Dipakai POST /api/route untuk menilai aksesibilitas rute (PRD 19.5).
// Tanpa tabel ini terisi, skor aksesibilitas rute null — dan itu memang jawaban
// yang benar: tidak ada data, bukan "aman".

import { fetchOverpass } from './overpass.js';

const dry = process.argv.includes('--dry');
const KOTA = [ // sama dengan daftar di db/import-osm.js
  { nama: 'Kota Bogor',   bbox: '-6.68,106.73,-6.53,106.86' },
  { nama: 'DKI Jakarta',  bbox: '-6.37,106.70,-6.08,106.97' },
  { nama: 'Kota Bandung', bbox: '-6.98,107.55,-6.84,107.74' },
];

const queryUntuk = (bbox) => `[out:json][timeout:180];
(
  way["highway"~"^(footway|path|pedestrian|steps)$"](${bbox});
  way["sidewalk"]["highway"](${bbox});
);
out geom;`;

const elements = [];
for (const kota of KOTA) {
  console.log(`[${kota.nama}] Overpass: jaringan pejalan kaki`);
  const { elements: e = [] } = await fetchOverpass(queryUntuk(kota.bbox));
  console.log(`[${kota.nama}] ${e.length} elemen`);
  elements.push(...e);
}

const angka = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const ways = [];
for (const el of elements) {
  if (el.type !== 'way' || !Array.isArray(el.geometry)) continue;
  const titik = el.geometry.filter((p) => p && p.lat !== undefined);
  if (titik.length < 2) continue;
  const t = el.tags ?? {};
  ways.push({
    osm_id: el.id,
    highway: t.highway ?? null,
    wheelchair: t.wheelchair ?? null,
    tactile_paving: t.tactile_paving ?? null,
    surface: t.surface ?? null,
    smoothness: t.smoothness ?? null,
    incline: t.incline ?? null,
    kerb: t.kerb ?? null,
    width: angka(t.width),
    tags: t,
    wkt: `LINESTRING(${titik.map((p) => `${p.lon} ${p.lat}`).join(',')})`,
  });
}

const berdata = ways.filter((w) => w.wheelchair || w.tactile_paving || w.smoothness || w.surface || w.highway === 'steps');
console.log(`${elements.length} elemen -> ${ways.length} ruas pejalan kaki`);
console.log(`punya tag aksesibilitas yang bisa dinilai: ${berdata.length} (${Math.round((100 * berdata.length) / (ways.length || 1))}%)`);
console.table(
  Object.entries(
    ways.reduce((a, w) => ({ ...a, [w.highway ?? 'sidewalk-tag']: (a[w.highway ?? 'sidewalk-tag'] ?? 0) + 1 }), {}),
  ).map(([highway, jumlah]) => ({ highway, jumlah })),
);

if (dry) {
  console.log('\n--dry: tidak ada yang ditulis ke database.');
  process.exit(0);
}

const { pool } = await import('../src/db.js');

// Insert per baris sempat dipakai saat datanya ~2000 ruas Bogor saja. Dengan Jakarta
// ikut masuk, jumlahnya puluhan ribu dan satu round-trip per baris ke region DB
// membuatnya berjam-jam. Satu INSERT multi-baris per 500 ruas memangkasnya jadi puluhan query.
const UKURAN_BATCH = 500;
const KOLOM = 11;
let n = 0;

for (let i = 0; i < ways.length; i += UKURAN_BATCH) {
  const batch = ways.slice(i, i + UKURAN_BATCH);
  // Kolom terakhir (geom) dibungkus st_geogfromtext supaya EWKT-nya di-parse eksplisit,
  // tidak bergantung pada cast implisit text -> geography.
  const nilai = batch.map((_, b) => {
    const p = Array.from({ length: KOLOM }, (_, c) => `$${b * KOLOM + c + 1}`);
    p[KOLOM - 1] = `st_geogfromtext(${p[KOLOM - 1]})`;
    return `(${p.join(',')})`;
  });
  const params = batch.flatMap((w) => [
    w.osm_id, w.highway, w.wheelchair, w.tactile_paving, w.surface, w.smoothness,
    w.incline, w.kerb, w.width, w.tags, `SRID=4326;${w.wkt}`,
  ]);
  await pool.query(
    `insert into pedestrian_ways (osm_id, highway, wheelchair, tactile_paving, surface, smoothness,
                                  incline, kerb, width, tags, geom)
     values ${nilai.join(',')}
     on conflict (osm_id) do update set
       highway=excluded.highway, wheelchair=excluded.wheelchair, tactile_paving=excluded.tactile_paving,
       surface=excluded.surface, smoothness=excluded.smoothness, incline=excluded.incline,
       kerb=excluded.kerb, width=excluded.width, tags=excluded.tags, geom=excluded.geom`,
    params,
  );
  n += batch.length;
  console.log(`  ${n}/${ways.length}`);
}

const { rows } = await pool.query(`
  select count(*) total,
         count(*) filter (where wheelchair is not null) ada_tag_wheelchair,
         count(*) filter (where highway = 'steps') tangga,
         round(sum(st_length(geom))/1000)::int panjang_km
    from pedestrian_ways`);
console.log(`\n${n} ruas tersimpan`);
console.table(rows);
await pool.end();
