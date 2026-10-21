import { saatGayaSiap, WARNA_JALUR } from './jalur';

/**
 * Garis rute di peta.
 *
 * Dulu satu garis ungu polos: rute 10 km yang mulus 9 km lalu berakhir di tangga
 * terlihat persis sama dengan rute yang mulus seluruhnya. Satu angka persentase di
 * kartu meratakan hal yang justru tidak rata. Sekarang tiap penggal diwarnai menurut
 * jalur yang dilaluinya, jadi tangga itu punya tempatnya sendiri di peta.
 *
 * Warnanya sengaja sama dengan lapisan jaringan pejalan kaki — merah hambatan, hijau
 * terdata lolos, abu belum terdata. Yang membedakan rute dari jaringan di bawahnya
 * bukan warnanya, melainkan tebal garis dan kelim putihnya.
 */

const SRC = 'route';
const LAYERS = ['route-titik-hambatan', 'route-hambatan', 'route-lolos', 'route-belum', 'route-casing'];

const kelasRute = (id, kelas, lebar) => ({
  id,
  type: 'line',
  source: SRC,
  filter: ['==', ['get', 'kelas'], kelas],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': WARNA_JALUR[kelas], 'line-width': lebar },
});

export function drawRoute(map, geometry, segmen) {
  // Gaya peta bisa sedang dimuat ulang (mis. sesaat setelah berganti ke satelit).
  // addSource pada saat itu melempar dan merobohkan komponen peta.
  if (!map.isStyleLoaded()) { saatGayaSiap(map, () => drawRoute(map, geometry, segmen)); return; }
  // Tanpa data segmen (rute lama di cache, atau jaringan pejalan kaki belum diimpor
  // untuk kota itu) seluruh rute diperlakukan sebagai "belum diketahui" — bukan
  // sebagai aman. Aturan yang sama dengan atribut fasilitas.
  const data = segmen?.features?.length
    ? segmen
    : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kelas: 'belum' }, geometry }] };

  const src = map.getSource(SRC);
  if (src) { src.setData(data); return; }

  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({
    id: 'route-casing', type: 'line', source: SRC,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 11 },
  });
  // Urutan: hambatan paling akhir supaya tangga tidak pernah tertutup penggal lain
  // yang berimpit di tikungan.
  map.addLayer(kelasRute('route-belum', 'belum', 6));
  map.addLayer(kelasRute('route-lolos', 'lolos', 6));
  map.addLayer(kelasRute('route-hambatan', 'hambatan', 7));
  // Titik penanda di tiap simpul penggal berhambatan.
  //
  // Perlu karena panjangnya sebenarnya: satu ruas tangga 20 m hanya 3 piksel di zoom
  // kota — terukur begitu di layar 375 px. Penggal merahnya ada, tapi tidak akan
  // pernah tertangkap mata. Lingkaran diukur dalam piksel, jadi ia tetap terlihat di
  // zoom berapa pun, dan ukurannya tidak berpura-pura menggambarkan panjang tangga.
  map.addLayer({
    id: 'route-titik-hambatan',
    type: 'circle',
    source: SRC,
    filter: ['==', ['get', 'kelas'], 'hambatan'],
    paint: {
      'circle-color': WARNA_JALUR.hambatan,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 6, 18, 8],
    },
  });
}

export function clearRoute(map) {
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
