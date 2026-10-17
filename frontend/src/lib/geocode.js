// Pencarian alamat/nama tempat (Mapbox Geocoding, hanya Indonesia). Memakai token PUBLIK (pk.).
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const geocodingAvailable = !!TOKEN;

export async function searchPlaces(query, signal) {
  if (!TOKEN) throw new Error('Pencarian lokasi belum tersedia.');
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&country=id&language=id&limit=5&access_token=${TOKEN}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Pencarian lokasi gagal. Coba lagi atau klik peta untuk menentukan titik.');
  const data = await res.json();
  return (data.features ?? []).map((f) => ({
    id: f.id,
    name: f.properties?.name ?? f.properties?.full_address ?? 'Lokasi',
    address: f.properties?.full_address ?? f.properties?.place_formatted ?? '',
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));
}
