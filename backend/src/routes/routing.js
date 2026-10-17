// Rute jalan kaki (PRD 23): proxy Mapbox Directions + skor rute 70% aksesibilitas / 30% jarak.
// Token Mapbox disimpan di server (.env), tidak dikirim ke client lewat endpoint ini.
import express from 'express';
import { z } from 'zod';
import { many } from '../db.js';
import { HttpError } from '../http.js';
import { rateLimit } from '../rateLimit.js';

export const router = express.Router();

const point = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).transform((s) => s.split(',').map(Number));
const query = z.object({
  from: point, // "lon,lat"
  to: point,
  facility_id: z.coerce.number().int().positive().optional(),
});

/** Skor aksesibilitas hanya dari atribut yang DIKETAHUI; unknown tidak dihitung (PRD 23.4). */
export function scoreRoute(distanceM, attributes) {
  const known = attributes.filter((a) => a.status !== 'unknown');
  const accessibility = known.length
    ? Math.round((100 * known.filter((a) => a.status === 'available').length) / known.length)
    : null;
  const distance = Math.max(0, Math.min(100, Math.round(100 - (distanceM / 1000) * 10)));
  const route = accessibility === null ? distance : Math.round(accessibility * 0.7 + distance * 0.3);
  return { accessibility_score: accessibility, distance_score: distance, route_score: route, known_attributes: known.length };
}

/** Panggil Mapbox Directions (walking). Melempar HttpError bila tidak tersedia. */
export async function fetchWalkingRoute(from, to) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new HttpError(503, 'Layanan rute belum dikonfigurasi di server.');
  const base = process.env.MAPBOX_API_BASE ?? 'https://api.mapbox.com';
  const url = `${base}/directions/v5/mapbox/walking/${from.join(',')};${to.join(',')}?geometries=geojson&overview=full&access_token=${token}`;
  let data;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    data = await r.json();
  } catch {
    throw new HttpError(502, 'Rute tidak dapat dibuat saat ini. Coba lagi nanti.');
  }
  const route = data.routes?.[0];
  if (!route) throw new HttpError(404, 'Tidak ada rute jalan kaki antara dua titik ini.');
  return route;
}

router.get('/routes/walking', rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const { from, to, facility_id } = query.parse(req.query);
  const route = await fetchWalkingRoute(from, to);
  const attributes = facility_id
    ? await many('select status from accessibility_facilities where facility_id = $1', [facility_id])
    : [];
  res.json({
    distance_m: Math.round(route.distance),
    duration_s: Math.round(route.duration),
    geometry: route.geometry,
    ...scoreRoute(route.distance, attributes),
  });
});
