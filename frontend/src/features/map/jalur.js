import { api } from '../../lib/api';

/**
 * Lapisan jaringan pejalan kaki di atas peta.
 *
 * Selama ini peta hanya menggambar 138 titik fasilitas — tabel paling sedikit dan
 * paling kosong atributnya yang kami punya, sementara 24.180 ruas jalan berikut 2.228
 * tangga cuma dipakai diam-diam untuk menilai rute. Lapisan ini membalik itu: yang
 * terlihat sekarang jalannya, bukan cuma tujuannya.
 *
 * Tiga kelas, bukan gradasi, dan "belum diketahui" punya warnanya sendiri. Abu-abu
 * yang mendominasi itu bukan kegagalan tampilan — itu temuannya.
 */

// Dua palet, karena satu warna tidak bisa benar di atas dua latar.
//
// Di peta jalan, "belum" harus lebih TUA dari abu-abu jalan Mapbox; di atas citra
// satelit yang gelap, warna tua itu hilang sepenuhnya — terbukti saat diperiksa:
// 41 ruas tergambar di satelit dan tidak satu pun terlihat. Jadi di satelit palet
// dibalik: terang di atas gelap.
export const PALET_JALUR = {
  jalan: { hambatan: '#dc2626', lolos: '#15803d', belum: '#475569', opasitasBelum: 0.45 },
  satelit: { hambatan: '#f87171', lolos: '#4ade80', belum: '#e2e8f0', opasitasBelum: 0.8 },
};

// Dipakai keterangan peta dan rute bersegmen; keduanya di atas kertas putih, jadi
// palet peta jalan yang berlaku di sana.
export const WARNA_JALUR = PALET_JALUR.jalan;

const SRC = 'jalur';
const LAYERS = ['jalur-belum', 'jalur-lolos', 'jalur-casing', 'jalur-hambatan'];

const kosong = { type: 'FeatureCollection', features: [] };

// Zoom di bawah ini tidak menggambar apa pun: satu kota penuh ruas trotoar pada
// zoom 11 adalah bubur abu-abu yang menutupi penanda, dan bbox-nya ditolak server.
export const ZOOM_MIN_JALUR = 13;

// Melebar mengikuti zoom supaya garisnya tetap terbaca saat menjauh dan tidak jadi
// pita tebal saat mendekat.
const lebarZoom = (l) => ['interpolate', ['linear'], ['zoom'], 13, l * 0.7, 16, l, 18, l * 1.6];

function garis(id, kelas, lebar, opsi = {}, palet = PALET_JALUR.jalan) {
  return {
    id,
    type: 'line',
    source: SRC,
    filter: ['==', ['get', 'kelas'], kelas],
    layout: { 'line-join': 'round', 'line-cap': kelas === 'belum' ? 'butt' : 'round' },
    paint: {
      'line-color': opsi.warna ?? palet[kelas],
      // 'belum' sengaja paling tenang: ia 96% dari seluruh ruas, dan kalau digambar
      // sekeras dua kelas lainnya peta berubah jadi jaring yang menutupi segalanya.
      // Yang harus menonjol hambatannya, bukan ketidaktahuannya.
      'line-opacity': opsi.opacity ?? (kelas === 'belum' ? palet.opasitasBelum : 1),
      'line-width': lebarZoom(lebar),
      // Putus-putus untuk "belum diketahui". Bentuk, bukan hanya warna — kunci warna
      // saja tidak terbaca oleh sebagian pengguna, dan aplikasi ini justru tentang itu.
      ...(kelas === 'belum' ? { 'line-dasharray': [2, 1.6] } : {}),
    },
  };
}

/**
 * Menjalankan cb begitu gaya peta benar-benar siap menerima source dan layer.
 *
 * Perlu karena `ready` kita menyala pada event `load`, sementara style bisa kembali
 * "belum selesai" setelah setStyle — dan addSource pada saat itu MELEMPAR, yang
 * sebelumnya merobohkan seluruh komponen peta (rute pun ikut hilang, bukan hanya
 * lapisan jalurnya).
 */
export function saatGayaSiap(map, cb) {
  if (map.isStyleLoaded()) { cb(); return; }
  let selesai = false;
  const beres = () => {
    if (selesai || !map.isStyleLoaded()) return;
    selesai = true;
    map.off('styledata', pantau);
    map.off('idle', pantau);
    clearInterval(jaga);
    cb();
  };
  const pantau = () => beres();
  map.on('styledata', pantau);
  map.on('idle', pantau);
  // Penjaga terakhir, dan ini bukan kemewahan: `styledata` menyala beberapa kali
  // selama gaya dimuat, dan isStyleLoaded() bisa baru menjadi true SETELAH event
  // terakhirnya lewat. Ketika itu terjadi, tidak ada lagi event yang akan datang dan
  // layer kita tidak pernah terpasang — persis yang terjadi pada rute setelah
  // berganti gaya: kartunya ada, garisnya hilang.
  const jaga = setInterval(beres, 150);
  setTimeout(() => { clearInterval(jaga); }, 30000);
}

/** Menambahkan source dan ketiga layer kalau belum ada. Aman dipanggil berulang. */
export function pasangJalur(map, gaya = 'jalan') {
  if (!map.isStyleLoaded()) { saatGayaSiap(map, () => pasangJalur(map, gaya)); return; }
  const palet = PALET_JALUR[gaya] ?? PALET_JALUR.jalan;
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: kosong });
    // Source baru berarti isinya hilang — termasuk setelah setStyle. Kotak yang
    // "sudah diambil" tidak lagi berlaku, jadi penjaga anti-ulang harus dilupakan.
    // Tanpa baris ini lapisan tetap kosong sampai pengguna kebetulan menggeser peta.
    kunciDipakai = null;
  }
  // Urutan sengaja: hambatan digambar paling akhir supaya tangga tidak pernah
  // tertutup trotoar biasa yang kebetulan berimpit.
  if (!map.getLayer('jalur-belum')) map.addLayer(garis('jalur-belum', 'belum', 2.5, {}, palet));
  if (!map.getLayer('jalur-lolos')) map.addLayer(garis('jalur-lolos', 'lolos', 4, {}, palet));
  // Garis putih di bawah hambatan: merah setipis ini hilang di atas jalan abu-abu
  // peta jalan, dan lebih parah lagi di atas citra satelit.
  if (!map.getLayer('jalur-casing')) map.addLayer(garis('jalur-casing', 'hambatan', 8, { warna: '#ffffff', opacity: 0.9 }, palet));
  if (!map.getLayer('jalur-hambatan')) map.addLayer(garis('jalur-hambatan', 'hambatan', 5, {}, palet));
  warnaiJalur(map, gaya);
  // Rute pengguna harus tetap di atas lapisan ini kalau keduanya menyala bersamaan.
  ['route-casing', 'route-line'].forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
}

/** Mengganti palet pada layer yang sudah terpasang (mis. saat peta berganti gaya). */
export function warnaiJalur(map, gaya = 'jalan') {
  const palet = PALET_JALUR[gaya] ?? PALET_JALUR.jalan;
  if (map.getLayer('jalur-belum')) {
    map.setPaintProperty('jalur-belum', 'line-color', palet.belum);
    map.setPaintProperty('jalur-belum', 'line-opacity', palet.opasitasBelum);
  }
  if (map.getLayer('jalur-lolos')) map.setPaintProperty('jalur-lolos', 'line-color', palet.lolos);
  if (map.getLayer('jalur-hambatan')) map.setPaintProperty('jalur-hambatan', 'line-color', palet.hambatan);
}

export function lepasJalur(map) {
  // isStyleLoaded(), BUKAN getStyle(). getStyle() MELEMPAR ("Style is not done
  // loading") selagi gaya peta dimuat ulang — jadi penjaga yang dimaksudkan untuk
  // mengamankan pembersihan justru merobohkan seluruh komponen peta, dan bersamanya
  // rute serta semua lapisan ikut hilang. Inilah sebab sebenarnya dari "layer hilang
  // setelah ganti ke satelit"; tiga teori sebelumnya meleset.
  // Lagi pula tidak ada yang perlu dibersihkan saat gaya diganti: setStyle sudah
  // membuang semua source dan layer kita.
  if (!map.isStyleLoaded()) return;
  LAYERS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function isiJalur(map, data) {
  map.getSource(SRC)?.setData(data ?? kosong);
}

/**
 * Ambil ruas untuk kotak yang sedang terlihat.
 *
 * Penyederhanaan garis mengikuti zoom: saat menjauh, belokan trotoar tidak terlihat
 * bedanya tapi tetap dikirim sebagai ratusan titik koordinat.
 */
export async function ambilJalur(map, { signal } = {}) {
  const z = map.getZoom();
  if (z < ZOOM_MIN_JALUR) return { data: kosong, terlaluJauh: true, kunci: 'jauh' };
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(',');
  const simplify = z >= 16 ? 0 : z >= 14 ? 0.00002 : 0.00005;
  const data = await api('/ways', { params: { bbox, simplify }, signal });
  // Kunci dipakai pemanggil untuk melewati permintaan yang sama berulang kali.
  return { data, terlaluJauh: false, kunci: `${bbox}|${simplify}` };
}

// Kotak terakhir yang datanya sudah masuk ke source. Disimpan di sini, bukan di
// pemanggil, supaya ia bisa DILUPAKAN tepat ketika source-nya dibuat ulang — dan
// itu hanya diketahui oleh pasangJalur.
let kunciDipakai = null;

/**
 * Apakah kotak tampilan sekarang perlu diambil datanya?
 *
 * Dua hal yang dijaga sekaligus: permintaan berulang untuk kotak yang sama (penting
 * sejak `idle` jadi pemicu — tanpa itu setiap data yang masuk memicu permintaan
 * berikutnya tanpa henti), dan source kosong setelah gaya peta diganti.
 */
export function perluMuatUlang(map) {
  const k = kunciTampilan(map);
  if (k === kunciDipakai) return false;
  kunciDipakai = k;
  return true;
}

/** Kunci kotak tampilan saat ini, tanpa mengambil data. */
export function kunciTampilan(map) {
  if (map.getZoom() < ZOOM_MIN_JALUR) return 'jauh';
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(',');
  const z = map.getZoom();
  const simplify = z >= 16 ? 0 : z >= 14 ? 0.00002 : 0.00005;
  return `${bbox}|${simplify}`;
}
