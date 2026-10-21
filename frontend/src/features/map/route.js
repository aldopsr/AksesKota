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
const LAYERS = ['route-hambatan', 'route-lolos', 'route-belum', 'route-casing'];

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
}

export function clearRoute(map) {
  if (!map.getStyle()) return;
  LAYERS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource(SRC)) map.removeSource(SRC);
}
