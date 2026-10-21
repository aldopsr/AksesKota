/**
 * Lapisan "jangkauan nyata" di peta.
 *
 * Dua jaringan digambar bertumpuk dari titik yang sama: biru tipis untuk sejauh mana
 * pejalan kaki bisa pergi dalam batas waktu, hijau tebal untuk sejauh mana pengguna
 * kursi roda bisa pergi setelah tangga dan ruas bertanda tidak-dapat-dilalui dibuang
 * dari jaringan.
 *
 * Yang bercerita bukan salah satu di antaranya, melainkan selisihnya — biru yang
 * menjulur jauh sementara hijau berhenti beberapa blok dari titik awal.
 */

const SRC_JALAN = 'jangkauan-jalan';
const SRC_KURSI = 'jangkauan-kursi';
const LAYERS = ['jangkauan-jalan-garis', 'jangkauan-kursi-garis'];

export const WARNA_JANGKAUAN = { jalan: '#0284c7', kursi_roda: '#15803d' };

const kosong = { type: 'FeatureCollection', features: [] };

export function pasangJangkauan(map) {
  if (!map.isStyleLoaded()) return false;
  if (!map.getSource(SRC_JALAN)) map.addSource(SRC_JALAN, { type: 'geojson', data: kosong });
  if (!map.getSource(SRC_KURSI)) map.addSource(SRC_KURSI, { type: 'geojson', data: kosong });
  if (!map.getLayer('jangkauan-jalan-garis')) {
    map.addLayer({
      id: 'jangkauan-jalan-garis', type: 'line', source: SRC_JALAN,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': WARNA_JANGKAUAN.jalan, 'line-width': 7, 'line-opacity': 0.6 },
    });
  }
  if (!map.getLayer('jangkauan-kursi-garis')) {
    map.addLayer({
      id: 'jangkauan-kursi-garis', type: 'line', source: SRC_KURSI,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': WARNA_JANGKAUAN.kursi_roda, 'line-width': 4, 'line-opacity': 0.95 },
    });
  }
  return true;
}

export function isiJangkauan(map, data) {
  map.getSource(SRC_JALAN)?.setData(data?.jalan ?? kosong);
  map.getSource(SRC_KURSI)?.setData(data?.kursi_roda ?? kosong);
}

export function lepasJangkauan(map) {
  if (!map.getStyle()) return;
  LAYERS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  [SRC_JALAN, SRC_KURSI].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
}
