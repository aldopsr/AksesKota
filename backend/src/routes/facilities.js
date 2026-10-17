import express from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { matchLabel, freshness, resolveNeeds } from '../match.js';

export const router = express.Router();

const DISCLAIMER =
  'Kondisi fasilitas di lapangan dapat berubah. AksesKota tidak menjamin suatu fasilitas atau rute sepenuhnya bebas hambatan bagi semua pengguna.';

/**
 * Satu query untuk semua jalur pencarian: filter biasa, filter aksesibilitas,
 * dan hasil parsing AI. Sorting dilakukan di SQL (match desc, lalu jarak asc — PRD 15),
 * bukan di JS, supaya LIMIT benar-benar membatasi hasil terbaik.
 *
 * unknown TIDAK PERNAH dihitung sebagai terpenuhi (PRD 8.2 / AC-03).
 */
export async function searchFacilities({
  q = null, category = null, needs = [], lat = null, lon = null, radius = null, limit = 50, ids = null,
} = {}) {
  const rows = await many(
    `select f.id, f.name, f.address, f.description, f.last_verified_at,
            c.code as category_code, c.name as category_name,
            st_y(f.location::geometry) as lat, st_x(f.location::geometry) as lon,
            coalesce(m.tersedia, 0)::int      as needs_met,
            coalesce(m.tidak_tersedia, 0)::int as needs_unavailable,
            case when cardinality($3::text[]) = 0 then null
                 else round(100.0 * coalesce(m.tersedia,0) / cardinality($3::text[]))::int end as match_pct,
            case when $4::float8 is null then null
                 else round(st_distance(f.location, st_setsrid(st_makepoint($5,$4),4326)::geography))::int end as distance_m
       from facilities f
       left join categories c on c.id = f.category_id
       left join lateral (
         select count(*) filter (where af.status = 'available')     as tersedia,
                count(*) filter (where af.status = 'not_available') as tidak_tersedia
           from accessibility_facilities af
          where af.facility_id = f.id and af.attribute_code = any($3::text[])
       ) m on true
      where ($1::text is null or f.name ilike '%' || $1 || '%' or f.address ilike '%' || $1 || '%')
        and ($2::text is null or c.code = $2)
        and ($6::float8 is null or $4::float8 is null
             or st_dwithin(f.location, st_setsrid(st_makepoint($5,$4),4326)::geography, $6))
        and ($8::int[] is null or f.id = any($8))
      order by match_pct desc nulls last, distance_m asc nulls last, f.name
      limit $7`,
    [q, category, needs, lat, lon, radius, limit, ids],
  );

  return rows.map((r) => {
    // Atribut tanpa baris di DB dihitung sebagai unknown, bukan diabaikan.
    const unknown = needs.length - r.needs_met - r.needs_unavailable;
    return {
      ...r,
      needs_total: needs.length,
      needs_unknown: unknown,
      ...(matchLabel(r.match_pct, needs.length ? unknown / needs.length : 0) ?? {}),
      freshness: freshness(r.last_verified_at),
    };
  });
}

const listQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().max(50).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(50_000).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

router.get('/facilities', async (req, res) => {
  const p = listQuery.parse(req.query);
  const needs = await resolveNeeds(req);
  const results = await searchFacilities({ ...p, needs, lat: p.lat ?? null, lon: p.lon ?? null });
  res.json({ needs, count: results.length, results, disclaimer: DISCLAIMER });
});

router.get('/facilities/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const needs = await resolveNeeds(req);

  const facility = await one(
    `select f.id, f.name, f.address, f.description, f.last_verified_at, f.created_at,
            c.code as category_code, c.name as category_name,
            st_y(f.location::geometry) as lat, st_x(f.location::geometry) as lon
       from facilities f left join categories c on c.id = f.category_id
      where f.id = $1`,
    [id],
  );
  if (!facility) return res.status(404).json({ error: 'Fasilitas tidak ditemukan' });

  // Left join dari tabel atribut: atribut yang belum punya baris tetap muncul sebagai unknown,
  // jadi UI selalu menampilkan 10 baris penuh dengan tanda ? (PRD 14).
  const [attributes, photos, reviews, ringkasan] = await Promise.all([
    many(
      `select a.code, a.name, a.icon, a.is_core,
              coalesce(af.status, 'unknown') as status, af.notes, af.verified_at
         from accessibility_attributes a
         left join accessibility_facilities af on af.attribute_code = a.code and af.facility_id = $1
        order by a.sort`,
      [id],
    ),
    many('select id, url, caption, created_at from facility_photos where facility_id = $1 order by id desc', [id]),
    many(
      `select r.id, r.rating, r.content, r.created_at, u.name as user_name
         from reviews r join users u on u.id = r.user_id
        where r.facility_id = $1 order by r.id desc limit 20`,
      [id],
    ),
    one('select round(avg(rating),1)::float as rating_avg, count(*)::int as rating_count from reviews where facility_id = $1', [id]),
  ]);

  const met = attributes.filter((a) => needs.includes(a.code) && a.status === 'available').length;
  const unknown = attributes.filter((a) => needs.includes(a.code) && a.status === 'unknown').length;
  const match_pct = needs.length ? Math.round((100 * met) / needs.length) : null;

  res.json({
    ...facility,
    needs,
    needs_met: met,
    needs_unknown: unknown,
    needs_total: needs.length,
    match_pct,
    ...(matchLabel(match_pct, needs.length ? unknown / needs.length : 0) ?? {}),
    freshness: freshness(facility.last_verified_at),
    attributes,
    photos,
    reviews,
    ...ringkasan,
    disclaimer: DISCLAIMER,
  });
});

router.get('/categories', async (_req, res) => {
  res.json(await many('select code, name from categories order by name'));
});

router.get('/attributes', async (_req, res) => {
  res.json(await many('select code, name, icon, is_core from accessibility_attributes order by sort'));
});
