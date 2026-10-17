// Import fasilitas publik Kota Bogor dari OpenStreetMap lewat Overpass API.
//   node --env-file-if-exists=.env db/import-osm.js --dry    -> cuma tampilkan hasil, tidak sentuh DB
//   node --env-file-if-exists=.env db/import-osm.js          -> tulis ke DB (idempotent)
//
// Aturan yang tidak boleh dilanggar (PRD 8.2 / 11):
//   tag OSM tidak ada  ->  status tetap `unknown`, JANGAN diasumsikan available.
//   Data OSM juga TIDAK ditandai terverifikasi (verified_at dibiarkan null) karena
//   belum ada bukti lapangan — fasilitas hasil import akan tampil `needs_reverification`.

import { fetchOverpass } from './overpass.js';

const dry = process.argv.includes('--dry');

// PRD 2.0: scope nasional. Dataset awal diambil dari beberapa kota dengan data OSM
// terkaya — bukan klaim cakupan merata, dan itu dilaporkan apa adanya lewat /api/coverage.
//
// ponytail: bounding box, bukan lookup batas administratif. Konsekuensinya ikut terambil
// sedikit area kabupaten di pinggiran. Tambah kota cukup dengan menambah baris di sini.
const KOTA = [
  { nama: 'Kota Bogor',    bbox: '-6.68,106.73,-6.53,106.86' },
  { nama: 'DKI Jakarta',   bbox: '-6.37,106.70,-6.08,106.97' },
  { nama: 'Kota Bandung',  bbox: '-6.98,107.55,-6.84,107.74' },
];

const FILTERS = [
  '["amenity"~"^(hospital|clinic|doctors|puskesmas)$"]',
  '["amenity"~"^(school|college|university|kindergarten)$"]',
  '["amenity"~"^(townhall|police|post_office|library|courthouse)$"]',
  '["office"="government"]',
  '["railway"="station"]',
  '["amenity"~"^(bus_station|terminal)$"]',
  '["public_transport"="station"]',
  '["shop"="mall"]',
  '["amenity"="marketplace"]',
  '["leisure"="park"]',
  '["tourism"~"^(attraction|museum|zoo)$"]',
];

const queryUntuk = (bbox) => `[out:json][timeout:90];
(
${FILTERS.map((f) => `  nwr${f}(${bbox});`).join('\n')}
);
out center tags;`;

/** Kategori AksesKota dari tag OSM. null = bukan fasilitas yang kita petakan. */
function classify(t) {
  if (/^(hospital|clinic|doctors|puskesmas)$/.test(t.amenity)) return 'kesehatan';
  if (/^(school|college|university|kindergarten)$/.test(t.amenity)) return 'pendidikan';
  if (/^(townhall|police|post_office|library|courthouse)$/.test(t.amenity) || t.office === 'government')
    return 'layanan_publik';
  if (t.railway === 'station' || t.amenity === 'bus_station' || t.public_transport === 'station')
    return 'transportasi';
  if (t.shop === 'mall' || t.amenity === 'marketplace' || t.leisure === 'park' || t.tourism)
    return 'komersial';
  return null;
}

// `limited` sengaja dipetakan ke unknown, bukan available: akses terbatas bukan akses tersedia.
const yn = (v) =>
  v === 'yes' || v === 'designated' ? 'available' : v === 'no' ? 'not_available' : undefined;

const count = (v) => (v === undefined ? undefined : Number(v) > 0 ? 'available' : 'not_available');

/** Tag OSM -> atribut aksesibilitas AksesKota. undefined = biarkan unknown. */
function attributes(t) {
  const map = {
    wheelchair_path: yn(t.wheelchair),
    accessible_entrance: yn(t['entrance:wheelchair'] ?? t['door:wheelchair']),
    accessible_toilet: yn(t['toilets:wheelchair']),
    guiding_block: yn(t.tactile_paving),
    ramp: yn(t.ramp ?? t['ramp:wheelchair']),
    lift: yn(t.elevator),
    accessible_parking: count(t['capacity:disabled']) ?? yn(t['parking:disabled']),
    braille: yn(t.braille),
    handrail: yn(t.handrail),
    // audio_access: tidak ada tag OSM yang andal -> selalu unknown.
  };
  return Object.entries(map).filter(([, v]) => v !== undefined);
}

const address = (t) =>
  [[t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' No.'), t['addr:village'], t['addr:suburb']]
    .filter(Boolean).join(', ') || null;

const KUOTA = { kesehatan: 10, pendidikan: 8, layanan_publik: 8, transportasi: 6, komersial: 10 };

/** Ambil dan saring kandidat untuk satu kota. */
async function kandidatKota({ nama, bbox }) {
  console.log(`
[${nama}] Overpass: ${FILTERS.length} filter, bbox ${bbox}`);
  const { elements = [] } = await fetchOverpass(queryUntuk(bbox));

  const seen = new Map();
  for (const el of elements) {
    const t = el.tags ?? {};
    const name = t.name?.trim();
    const category = classify(t);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!name || name.length < 4 || !category || lat === undefined) continue; // tanpa nama jelas = tidak berguna di UI
    const attrs = attributes(t);
    const f = {
      name, category, lat, lon, region: nama,
      address: address(t),
      osm_id: `${el.type}/${el.id}`,
      attrs,
      // Prioritas import. Bobot terbesar ke fasilitas yang sudah punya data aksesibilitas —
      // itu barang paling berharga dan paling jarang di OSM.
      score: attrs.length * 10 + Object.keys(t).length + (el.type !== 'node' ? 3 : 0),
    };
    const bentrok = seen.get(name.toLowerCase());
    if (!bentrok || f.score > bentrok.score) seen.set(name.toLowerCase(), f); // nama kembar: ambil yang paling kaya data
  }

  const semua = [...seen.values()].sort((a, b) => b.score - a.score);
  const dipilih = process.argv.includes('--all')
    ? semua
    : Object.entries(KUOTA).flatMap(([cat, n]) => semua.filter((f) => f.category === cat).slice(0, n));
  const berdata = dipilih.filter((f) => f.attrs.length > 0).length;
  console.log(`[${nama}] ${elements.length} elemen -> ${semua.length} kandidat unik -> ${dipilih.length} dipilih, ${berdata} punya tag aksesibilitas`);
  return dipilih;
}

const facilities = [];
for (const kota of KOTA) facilities.push(...(await kandidatKota(kota)));

const perWilayah = facilities.reduce((a, f) => ({ ...a, [f.region]: (a[f.region] ?? 0) + 1 }), {});
const perKategori = facilities.reduce((a, f) => ({ ...a, [f.category]: (a[f.category] ?? 0) + 1 }), {});
const berdata = facilities.filter((f) => f.attrs.length > 0).length;
console.log(`
TOTAL: ${facilities.length} fasilitas dari ${KOTA.length} wilayah`);
console.table(perWilayah);
console.table(perKategori);
const persen = Math.round((100 * berdata) / facilities.length);
console.log(`punya minimal 1 atribut aksesibilitas dari OSM: ${berdata}/${facilities.length} (${persen}%)`);
if (persen < 70)
  console.warn(
    `
PERHATIAN: target PRD adalah >=70% fasilitas pada dataset awal punya data aksesibilitas.
` +
    `OSM hanya menyediakan ${persen}%. Sisanya HARUS diisi lewat survei manual / crowdsourcing
` +
    `(ini memang peran OSM di PRD 11.1: data dasar lokasi, bukan sumber data aksesibilitas).`,
  );

if (dry) {
  console.table(facilities.slice(0, 15).map((f) => ({ ...f, attrs: f.attrs.map(([k, v]) => `${k}=${v}`).join(' ') })));
  console.log('\n--dry: tidak ada yang ditulis ke database.');
  process.exit(0);
}

const { pool, one, q } = await import('../src/db.js');
let baru = 0, dikoreksi = 0, lewat = 0, atribut = 0;

// ponytail: sekuensial, ~4 query per fasilitas. Untuk ~100 baris ini selesai dalam hitungan detik;
// kalau datasetnya nanti ribuan, bungkus jadi satu transaksi + batch insert.
for (const f of facilities) {
  const ada = await one('select id, osm_id from facilities where name = $1', [f.name]);

  // Fasilitas yang sudah ada dan BELUM pernah disentuh OSM: koordinatnya dikoreksi.
  // Titik dari OSM lebih dipercaya daripada koordinat yang diisi tangan di seed.
  // Kalau osm_id sudah terisi, baris itu tidak diutak-utik lagi — supaya koreksi manual
  // yang dilakukan admin setelah import tidak tertimpa saat import diulang.
  if (ada) {
    if (ada.osm_id) { lewat++; continue; }
    await q(
      `update facilities
          set location = st_setsrid(st_makepoint($2,$3),4326),
              address  = coalesce(address, $4),
              osm_id   = $5,
              region   = coalesce(region, $6),
              updated_at = now()
        where id = $1`,
      [ada.id, f.lon, f.lat, f.address, f.osm_id, f.region],
    );
    dikoreksi++;
    continue; // data aksesibilitas hasil survei tidak ditimpa data OSM
  }

  const row = await one(
    `insert into facilities (name, category_id, address, location, osm_id, source, region)
     values ($1, (select id from categories where code = $2), $3,
             st_setsrid(st_makepoint($4,$5),4326), $6, 'osm', $7)
     returning id`,
    [f.name, f.category, f.address, f.lon, f.lat, f.osm_id, f.region],
  );
  baru++;

  // 10 baris unknown dulu, baru yang diketahui di-update. unknown adalah default yang benar.
  await q(
    `insert into accessibility_facilities (facility_id, attribute_code)
     select $1, code from accessibility_attributes on conflict do nothing`,
    [row.id],
  );
  for (const [code, status] of f.attrs) {
    // verified_at dibiarkan null: data OSM belum diverifikasi lapangan.
    await q(
      'update accessibility_facilities set status = $3 where facility_id = $1 and attribute_code = $2',
      [row.id, code, status],
    );
    atribut++;
  }
}

const { rows } = await pool.query(`
  select (select count(*) from facilities) total,
         (select count(*) from facilities where source = 'osm') dari_osm,
         (select count(distinct facility_id) from accessibility_facilities where status <> 'unknown') ada_data_aksesibilitas`);
console.log(`\nbaru: ${baru}, koordinat dikoreksi dari OSM: ${dikoreksi}, dilewati: ${lewat}, atribut terisi: ${atribut}`);
console.table(rows);
await pool.end();
