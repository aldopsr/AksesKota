// Pencarian alamat/nama tempat (Mapbox Search Box, hanya Indonesia). Memakai token PUBLIK (pk.).
//
// Search Box, BUKAN Geocoding v6. Geocoding v6 tidak memuat POI sama sekali — hanya
// alamat dan wilayah administratif. Terukur dengan token yang sama: "Stasiun Bogor"
// menghasilkan ["Bogor", "Bogor Selatan", "Bogor Timur", ...] di v6, dan empat
// "Stasiun Bogor" yang sebenarnya di Search Box. Padahal yang ditambahkan kontributor
// ke aplikasi ini justru POI: mal, rumah sakit, stasiun. Bentuk jawabannya sama persis,
// jadi hanya alamat URL-nya yang berbeda.
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const geocodingAvailable = !!TOKEN;

export async function searchPlaces(query, signal) {
  if (!TOKEN) throw new Error('Pencarian lokasi belum tersedia.');
  const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(query)}&country=id&language=id&limit=5&access_token=${TOKEN}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Pencarian lokasi gagal. Coba lagi atau klik peta untuk menentukan titik.');
  const data = await res.json();
  return (data.features ?? []).map((f) => ({
    // Search Box menaruh pengenalnya di properties.mapbox_id; f.id selalu undefined
    // di sini. Dibiarkan begitu, keempat hasil "Stasiun Bogor" dapat key yang sama
    // (undefined) dan React tidak bisa membedakan barisnya.
    id: f.properties?.mapbox_id ?? `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`,
    name: f.properties?.name ?? f.properties?.full_address ?? 'Lokasi',
    address: f.properties?.full_address ?? f.properties?.place_formatted ?? '',
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));
}
