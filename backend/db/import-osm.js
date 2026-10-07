// Import fasilitas publik Kota Bogor dari OpenStreetMap lewat Overpass API.
//   node --env-file-if-exists=.env db/import-osm.js --dry    -> cuma tampilkan hasil, tidak sentuh DB
//   node --env-file-if-exists=.env db/import-osm.js          -> tulis ke DB (idempotent)
//
// Aturan yang tidak boleh dilanggar (PRD 8.2 / 11):
//   tag OSM tidak ada  ->  status tetap `unknown`, JANGAN diasumsikan available.
//   Data OSM juga TIDAK ditandai terverifikasi (verified_at dibiarkan null) karena
//   belum ada bukti lapangan — fasilitas hasil import akan tampil `needs_reverification`.

const dry = process.argv.includes('--dry');

// ponytail: bounding box, bukan lookup batas administratif.
// Konsekuensi: ikut terambil sedikit area Kabupaten Bogor di pinggiran.
// Kalau itu mengganggu, ganti ke: area["name"="Kota Bogor"]["admin_level"="5"]->.a; lalu nwr(area.a).
const BBOX = '-6.68,106.73,-6.53,106.86'; // selatan,barat,utara,timur

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

const query = `[out:json][timeout:90];
(
${FILTERS.map((f) => `  nwr${f}(${BBOX});`).join('\n')}
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

console.log(`Overpass: ${FILTERS.length} filter, bbox ${BBOX}`);
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  // Overpass menolak request tanpa User-Agent dengan 406. Jangan dihapus.
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'AksesKota/0.1 (riset aksesibilitas Kota Bogor)',
  },
  body: new URLSearchParams({ data: query }),
});
if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
const { elements = [] } = await res.json();
console.log(`${elements.length} elemen mentah dari OSM`);

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
    name, category, lat, lon,
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

// OSM punya >1700 fasilitas di Bogor tapi hampir semuanya sekolah tanpa data aksesibilitas.
// Kuota per kategori menjaga dataset tetap seimbang dan sebesar target PRD (~100), bukan 1700 marker kosong.
const KUOTA = { kesehatan: 25, pendidikan: 20, layanan_publik: 20, transportasi: 15, komersial: 25 };
const semua = [...seen.values()].sort((a, b) => b.score - a.score);
const facilities = process.argv.includes('--all')
  ? semua
  : Object.entries(KUOTA).flatMap(([cat, n]) => semua.filter((f) => f.category === cat).slice(0, n));

const perKategori = facilities.reduce((a, f) => ({ ...a, [f.category]: (a[f.category] ?? 0) + 1 }), {});
const berdata = facilities.filter((f) => f.attrs.length > 0).length;
console.log(`${semua.length} kandidat unik -> ${facilities.length} dipilih${process.argv.includes('--all') ? ' (--all)' : ' (kuota per kategori)'}`);
console.table(perKategori);
const persen = Math.round((100 * berdata) / facilities.length);
console.log(`punya minimal 1 atribut aksesibilitas dari OSM: ${berdata}/${facilities.length} (${persen}%)`);
if (persen < 70)
  console.warn(
    `\nPERHATIAN: target PRD adalah >=70% fasilitas punya data aksesibilitas terisi.\n` +
    `OSM hanya menyediakan ${persen}%. Sisanya HARUS diisi lewat survei manual / crowdsourcing\n` +
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
              updated_at = now()
        where id = $1`,
      [ada.id, f.lon, f.lat, f.address, f.osm_id],
    );
    dikoreksi++;
    continue; // data aksesibilitas hasil survei tidak ditimpa data OSM
  }

  const row = await one(
    `insert into facilities (name, category_id, address, location, osm_id, source)
     values ($1, (select id from categories where code = $2), $3,
             st_setsrid(st_makepoint($4,$5),4326), $6, 'osm')
     returning id`,
    [f.name, f.category, f.address, f.lon, f.lat, f.osm_id],
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
