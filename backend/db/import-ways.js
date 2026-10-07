// Import jaringan pejalan kaki Kota Bogor dari OSM ke tabel pedestrian_ways.
//   node --env-file-if-exists=.env db/import-ways.js --dry
//   node --env-file-if-exists=.env db/import-ways.js
//
// Dipakai POST /api/route untuk menilai aksesibilitas rute (PRD 19.5).
// Tanpa tabel ini terisi, skor aksesibilitas rute null — dan itu memang jawaban
// yang benar: tidak ada data, bukan "aman".

import { fetchOverpass } from './overpass.js';

const dry = process.argv.includes('--dry');
const BBOX = '-6.68,106.73,-6.53,106.86'; // sama dengan db/import-osm.js

const query = `[out:json][timeout:180];
(
  way["highway"~"^(footway|path|pedestrian|steps)$"](${BBOX});
  way["sidewalk"]["highway"](${BBOX});
);
out geom;`;

console.log('Overpass: jaringan pejalan kaki, bbox ' + BBOX);
const { elements = [] } = await fetchOverpass(query);

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
let n = 0;
// ponytail: satu insert per ruas. Beberapa ribu baris selesai dalam puluhan detik dan
// hanya dijalankan sesekali; kalau nanti mencakup seluruh Jabodetabek, pindah ke COPY.
for (const w of ways) {
  await pool.query(
    `insert into pedestrian_ways (osm_id, highway, wheelchair, tactile_paving, surface, smoothness,
                                  incline, kerb, width, tags, geom)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, st_geogfromtext($11))
     on conflict (osm_id) do update set
       highway=excluded.highway, wheelchair=excluded.wheelchair, tactile_paving=excluded.tactile_paving,
       surface=excluded.surface, smoothness=excluded.smoothness, incline=excluded.incline,
       kerb=excluded.kerb, width=excluded.width, tags=excluded.tags, geom=excluded.geom`,
    [w.osm_id, w.highway, w.wheelchair, w.tactile_paving, w.surface, w.smoothness,
     w.incline, w.kerb, w.width, w.tags, `SRID=4326;${w.wkt}`],
  );
  if (++n % 500 === 0) console.log(`  ${n}/${ways.length}`);
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
