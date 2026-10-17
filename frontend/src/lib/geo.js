const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

// a, b = [lng, lat]
export function distanceMeters(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatDistance(m) {
  if (m === null || m === undefined) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

export function formatDuration(s) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} menit`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}

// Batas kasar wilayah Indonesia untuk validasi koordinat
export const ID_BOUNDS = { latMin: -11.5, latMax: 6.5, lngMin: 94, lngMax: 141.5 };
