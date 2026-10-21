// Lapisan jaringan pejalan kaki: 24.180 ruas yang selama ini hanya dipakai diam-diam
// untuk menilai rute, sekarang bisa digambar di peta.
//
// Kenapa ini ada: yang tampil di peta selama ini 138 titik fasilitas — tabel paling
// sedikit dan paling kosong atributnya yang kita punya. Jaringan jalannya justru padat
// (2.228 tangga, 144 guiding block), dan justru itu yang menjawab pertanyaan sebenarnya:
// bukan "apakah gedungnya aksesibel", tapi "apakah saya bisa sampai ke sana".
import express from 'express';
import { z } from 'zod';
import { many } from '../db.js';
import { HttpError } from '../http.js';
import { rateLimit } from '../rateLimit.js';

export const router = express.Router();

const query = z.object({
  // "minLon,minLat,maxLon,maxLat"
  bbox: z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/),
  // Toleransi penyederhanaan garis dalam derajat. Dinaikkan saat peta jauh supaya
  // yang dikirim tetap ringan; di zoom dekat 0 supaya belokan trotoar tidak hilang.
  simplify: z.coerce.number().min(0).max(0.001).default(0),
  limit: z.coerce.number().int().min(1).max(6000).default(4000),
});

// Luas bbox maksimum dalam derajat persegi (± sekota). Lebih luas dari ini, ruasnya
// terlalu banyak untuk dikirim sebagai GeoJSON dan peta hanya akan tersendat.
const MAKS_LUAS = 0.25;

/**
 * Tiga kelas, bukan gradasi: hambatan / terdata lolos / belum diketahui.
 *
 * "Belum diketahui" sengaja jadi kelas tersendiri dan bukan dianggap lolos — aturan
 * yang sama dengan atribut fasilitas (PRD §19.7). Di peta ia abu-abu tipis, dan
 * justru keabuan yang mendominasi itulah temuan yang ingin kami tunjukkan.
 */
const KELAS = `case
  when w.highway = 'steps' or w.wheelchair = 'no' then 'hambatan'
  when w.wheelchair in ('yes','designated') or w.tactile_paving = 'yes' then 'lolos'
  else 'belum'
end`;

// Pembatas laju, sama seperti /jangkauan yang membaca tabel yang sama. Ini bacaan
// TERBERAT di aplikasi — 24.180 ruas, dipindai per kotak tampilan lalu disederhanakan —
// dan satu-satunya yang dipanggil ulang tiap kali peta digeser. Dibiarkan tanpa batas,
// satu skrip yang menggeser peta terus-menerus cukup untuk menghabiskan koneksi basis
// data. 60/menit longgar untuk pemakaian jujur: penjaga anti-ulang di frontend membuat
// penggeseran normal hanya memicu beberapa permintaan per menit.
router.get('/ways', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res, next) => {
  try {
    const p = query.safeParse(req.query);
    if (!p.success) throw new HttpError(400, 'Parameter bbox tidak valid.');
    const [minLon, minLat, maxLon, maxLat] = p.data.bbox.split(',').map(Number);
    if (maxLon <= minLon || maxLat <= minLat) throw new HttpError(400, 'bbox terbalik.');
    if ((maxLon - minLon) * (maxLat - minLat) > MAKS_LUAS) {
      // Bukan galat: peta memang belum perlu lapisan ini saat dizoom keluar sejauh itu.
      return res.json({ type: 'FeatureCollection', features: [], terlalu_luas: true });
    }

    const rows = await many(
      `with kotak as (select st_makeenvelope($1,$2,$3,$4,4326) as g)
       select w.osm_id,
              ${KELAS} as kelas,
              w.highway,
              st_asgeojson(
                case when $5::float > 0
                     then st_simplify(w.geom::geometry, $5::float)
                     else w.geom::geometry end
              ) as geojson
         from pedestrian_ways w, kotak k
        where w.geom::geometry && k.g
        -- Hambatan didahulukan saat jumlahnya dipotong limit: kalau harus memilih,
        -- tangga yang tidak tergambar lebih berbahaya daripada trotoar biasa yang hilang.
        order by (${KELAS} = 'hambatan') desc, st_length(w.geom) desc
        limit $6`,
      [minLon, minLat, maxLon, maxLat, p.data.simplify, p.data.limit],
    );

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        id: Number(r.osm_id),
        properties: { kelas: r.kelas, highway: r.highway },
        geometry: JSON.parse(r.geojson),
      })),
    });
  } catch (e) { next(e); }
});

// Ringkasan untuk keterangan lapisan: berapa yang terdata di kotak yang sedang dilihat.
router.get('/ways/ringkasan', rateLimit({ windowMs: 60_000, max: 30 }), async (req, res, next) => {
  try {
    const p = query.safeParse(req.query);
    if (!p.success) throw new HttpError(400, 'Parameter bbox tidak valid.');
    const [minLon, minLat, maxLon, maxLat] = p.data.bbox.split(',').map(Number);
    const rows = await many(
      `select ${KELAS} as kelas, count(*)::int as jumlah,
              round(sum(st_length(w.geom))::numeric / 1000, 1)::float as km
         from pedestrian_ways w
        where w.geom::geometry && st_makeenvelope($1,$2,$3,$4,4326)
        group by 1`,
      [minLon, minLat, maxLon, maxLat],
    );
    const ambil = (k) => rows.find((r) => r.kelas === k) ?? { jumlah: 0, km: 0 };
    res.json({ hambatan: ambil('hambatan'), lolos: ambil('lolos'), belum: ambil('belum') });
  } catch (e) { next(e); }
});
