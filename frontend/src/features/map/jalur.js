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

export const WARNA_JALUR = {
  hambatan: '#dc2626',
  lolos: '#15803d',
  // Lebih tua dari abu-abu jalan di peta dasar. Dengan #94a3b8 lapisan ini memang
  // tergambar — queryRenderedFeatures menghitung 318 ruas — tapi tidak terlihat
  // sama sekali di atas jalan peta Mapbox yang nilainya hampir sama.
  belum: '#475569',
};

const SRC = 'jalur';
const LAYERS = ['jalur-belum', 'jalur-lolos', 'jalur-casing', 'jalur-hambatan'];

const kosong = { type: 'FeatureCollection', features: [] };

// Zoom di bawah ini tidak menggambar apa pun: satu kota penuh ruas trotoar pada
// zoom 11 adalah bubur abu-abu yang menutupi penanda, dan bbox-nya ditolak server.
export const ZOOM_MIN_JALUR = 13;

// Melebar mengikuti zoom supaya garisnya tetap terbaca saat menjauh dan tidak jadi
// pita tebal saat mendekat.
const lebarZoom = (l) => ['interpolate', ['linear'], ['zoom'], 13, l * 0.7, 16, l, 18, l * 1.6];

function garis(id, kelas, lebar, opsi = {}) {
  return {
    id,
    type: 'line',
    source: SRC,
    filter: ['==', ['get', 'kelas'], kelas],
    layout: { 'line-join': 'round', 'line-cap': kelas === 'belum' ? 'butt' : 'round' },
    paint: {
      'line-color': opsi.warna ?? WARNA_JALUR[kelas],
      // 'belum' sengaja paling tenang: ia 96% dari seluruh ruas, dan kalau digambar
      // sekeras dua kelas lainnya peta berubah jadi jaring yang menutupi segalanya.
      // Yang harus menonjol hambatannya, bukan ketidaktahuannya.
      'line-opacity': opsi.opacity ?? (kelas === 'belum' ? 0.45 : 1),
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
  const pantau = () => {
    if (!map.isStyleLoaded()) return;
    map.off('styledata', pantau);
    cb();
  };
  map.on('styledata', pantau);
}

/** Menambahkan source dan ketiga layer kalau belum ada. Aman dipanggil berulang. */
export function pasangJalur(map) {
  if (!map.isStyleLoaded()) { saatGayaSiap(map, () => pasangJalur(map)); return; }
  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: kosong });
  // Urutan sengaja: hambatan digambar paling akhir supaya tangga tidak pernah
  // tertutup trotoar biasa yang kebetulan berimpit.
  if (!map.getLayer('jalur-belum')) map.addLayer(garis('jalur-belum', 'belum', 2.5));
  if (!map.getLayer('jalur-lolos')) map.addLayer(garis('jalur-lolos', 'lolos', 4));
  // Garis putih di bawah hambatan: merah setipis ini hilang di atas jalan abu-abu
  // peta jalan, dan lebih parah lagi di atas citra satelit.
  if (!map.getLayer('jalur-casing')) map.addLayer(garis('jalur-casing', 'hambatan', 8, { warna: '#ffffff', opacity: 0.9 }));
  if (!map.getLayer('jalur-hambatan')) map.addLayer(garis('jalur-hambatan', 'hambatan', 5));
  // Rute pengguna harus tetap di atas lapisan ini kalau keduanya menyala bersamaan.
  ['route-casing', 'route-line'].forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
}

export function lepasJalur(map) {
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
  if (z < ZOOM_MIN_JALUR) return { data: kosong, terlaluJauh: true };
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(',');
  const simplify = z >= 16 ? 0 : z >= 14 ? 0.00002 : 0.00005;
  const data = await api('/ways', { params: { bbox, simplify }, signal });
  return { data, terlaluJauh: false };
}
