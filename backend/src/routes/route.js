import express from 'express';
import { z } from 'zod';
import { one } from '../db.js';
import { resolveNeeds } from '../match.js';
import { pakaiKuota, kuotaKey } from '../quota.js';

// PRD 27: target guardrail <= 5.000 Directions request/bulan.
// Guest dikunci per IP dan satu IP bisa mewakili sekelas orang di balik NAT,
// jadi jatahnya dilonggarkan — alasan yang sama seperti di routes/ai.js.
const KUOTA_USER = 50;
const KUOTA_GUEST_IP = 500;

// Seberapa jauh dari garis rute sebuah ruas pejalan kaki masih dianggap bagian dari rute.
const TOLERANSI_M = 15;

// Cakupan minimum sebelum skor aksesibilitas layak ditampilkan.
//
// Alasannya bias pemetaan OSM: tangga dipetakan rajin (76 ruas di Bogor) sementara
// `wheelchair=yes` hampir tidak pernah ditulis (6 ruas). Tanpa ambang ini, hampir semua
// rute mendapat skor 0.00 dari sampel 3% jalur — angka yang terlihat pasti padahal
// hanya mencerminkan bahwa OSM lebih rajin mencatat hambatan daripada kemudahan.
// Di bawah ambang: skor null (jujur "belum diketahui"), hambatan tetap dilaporkan.
const MIN_COVERAGE = 0.2;

// PRD 19.7 — bobot tetap MVP.
const BOBOT_AKSESIBILITAS = 0.7;
const BOBOT_JARAK = 0.3;

export const router = express.Router();

/**
 * Gabungkan skor aksesibilitas dan jarak jadi satu angka (PRD 19.7).
 *
 * `accessibility` null berarti TIDAK ADA data jalur yang diketahui pada rute ini.
 * Dalam keadaan itu rute diurutkan dengan jarak saja — `unknown` tidak boleh
 * diperlakukan sebagai `not_available`, jadi tidak ada penalti yang dikarang.
 *
 * Fungsi murni supaya bisa diuji tanpa Mapbox maupun database.
 */
export function skorRute({ accessibility, distanceM, tersingkatM }) {
  const distance_score = distanceM > 0 ? Math.min(1, tersingkatM / distanceM) : 1;
  if (accessibility === null || accessibility === undefined)
    return { distance_score, accessibility_score: null, score: distance_score, basis: 'jarak_saja' };
  return {
    distance_score,
    accessibility_score: accessibility,
    score: BOBOT_AKSESIBILITAS * accessibility + BOBOT_JARAK * distance_score,
    basis: 'aksesibilitas+jarak',
  };
}

/**
 * Nilai aksesibilitas satu rute dari jaringan pejalan kaki OSM (PRD 19.5).
 *
 * Hanya ruas yang statusnya DIKETAHUI yang masuk hitungan:
 *   accessibility = panjang_baik / (panjang_baik + panjang_buruk)
 * Ruas tanpa tag aksesibilitas tidak dihitung baik maupun buruk — itu `unknown`,
 * dan PRD 19.7 melarang memperlakukannya sebagai tidak tersedia.
 *
 * `coverage` dilaporkan terpisah supaya UI bisa jujur: skor 100% dengan coverage 5%
 * artinya "yang sedikit diketahui itu bagus", bukan "rutenya bebas hambatan".
 */
async function nilaiRute(geojson, panjangM) {
  // ponytail: panjang ruas dihitung PENUH, bukan hanya bagian yang berimpit dengan rute.
  // Ruas panjang yang cuma menyerempet jadi over-counted. Kalau presisinya kurang,
  // ganti ke ST_Intersection pada geometry terproyeksi (EPSG:32748 untuk Bogor).
  const r = await one(
    `with rute as (select st_setsrid(st_geomfromgeojson($1),4326)::geography g),
          dekat as (
            select w.*, st_length(w.geom) as len
              from pedestrian_ways w, rute r
             where st_dwithin(w.geom, r.g, $2)
          ),
          kelas as (
            select len, (highway = 'steps') as tangga, case
              when highway = 'steps' or wheelchair = 'no'
                   or smoothness in ('bad','very_bad','horrible','very_horrible','impassable')
                then 'buruk'
              when wheelchair in ('yes','designated') or tactile_paving = 'yes'
                   or smoothness in ('excellent','good')
                then 'baik'
              else 'unknown' end as kelas
              from dekat
          )
     select coalesce(sum(len) filter (where kelas = 'baik'), 0)::float  as baik_m,
            coalesce(sum(len) filter (where kelas = 'buruk'), 0)::float as buruk_m,
            count(*) filter (where kelas = 'buruk')::int as ruas_buruk,
            count(*) filter (where tangga)::int as ruas_tangga,
            count(*)::int as ruas_terdekat
       from kelas`,
    [JSON.stringify(geojson), TOLERANSI_M],
  );

  const diketahui = r.baik_m + r.buruk_m;
  const coverage = panjangM > 0 ? Math.min(1, diketahui / panjangM) : 0;
  const cukupData = coverage >= MIN_COVERAGE;

  return {
    // Skor hanya ditampilkan kalau sampelnya cukup besar untuk berarti.
    accessibility_score: diketahui > 0 && cukupData ? r.baik_m / diketahui : null,
    // Berapa bagian rute yang datanya memang diketahui. 0 = tidak ada data sama sekali.
    coverage,
    coverage_cukup: cukupData,
    ruas_diketahui_m: Math.round(diketahui),
    ruas_terdekat: r.ruas_terdekat,
    // Hambatan yang BENAR-BENAR terdeteksi. Ini sinyal paling kuat yang kita punya:
    // bukti negatif di OSM jauh lebih lengkap daripada bukti positif, jadi jumlah
    // tangga di jalur lebih layak dipercaya daripada skor rasio apa pun.
    hambatan: { ruas_buruk: r.ruas_buruk, ruas_tangga: r.ruas_tangga },
  };
}

const titik = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/**
 * POST /api/route  { from:{lat,lon}, to_facility_id }  atau  { from, to:{lat,lon} }
 *
 * MVP hanya walking route (PRD 19.3). Token Mapbox tidak pernah sampai ke browser (NFR-05).
 */
router.post('/', async (req, res) => {
  const { from, to, to_facility_id } = z
    .object({ from: titik, to: titik.optional(), to_facility_id: z.coerce.number().int().positive().optional() })
    .parse(req.body);
  if (!to && !to_facility_id)
    return res.status(400).json({ error: 'Tujuan wajib: kirim to_facility_id atau to {lat,lon}' });

  const token = process.env.MAPBOX_TOKEN;
  if (!token)
    return res.status(503).json({ error: 'Layanan rute sedang tidak tersedia.', fallback: 'map' });

  const needs = await resolveNeeds(req);

  // Tujuan dari database, bukan dari input bebas — supaya detail fasilitas yang
  // ditampilkan bersama rute tetap berasal dari data AksesKota.
  let tujuan = null;
  let dest = to;
  if (to_facility_id) {
    tujuan = await one(
      `select f.id, f.name, st_y(f.location::geometry) lat, st_x(f.location::geometry) lon
         from facilities f where f.id = $1`,
      [to_facility_id],
    );
    if (!tujuan) return res.status(404).json({ error: 'Fasilitas tujuan tidak ditemukan' });
    dest = { lat: tujuan.lat, lon: tujuan.lon };
  }

  const batas = req.user ? KUOTA_USER : KUOTA_GUEST_IP;
  const dipakai = await pakaiKuota(kuotaKey(req, 'route'));
  if (dipakai > batas)
    return res.status(429).json({ error: `Batas ${batas} permintaan rute per hari tercapai.`, fallback: 'map' });

  let mapbox;
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/walking/` +
      `${from.lon},${from.lat};${dest.lon},${dest.lat}` +
      `?alternatives=true&geometries=geojson&overview=full&steps=false&access_token=${token}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`Mapbox ${r.status}: ${(await r.text()).slice(0, 200)}`);
    mapbox = await r.json();
  } catch (e) {
    // NFR-04: gagal routing tidak boleh mematikan peta.
    console.error('Routing gagal:', e.message);
    return res.status(503).json({ error: 'Layanan rute sedang tidak tersedia.', fallback: 'map' });
  }

  if (!mapbox.routes?.length)
    return res.json({ routes: [], message: 'Tidak ada rute berjalan kaki yang ditemukan menuju lokasi tersebut.' });

  const tersingkatM = Math.min(...mapbox.routes.map((r) => r.distance));
  const routes = [];
  for (const r of mapbox.routes) {
    const nilai = await nilaiRute(r.geometry, r.distance);
    routes.push({
      distance_m: Math.round(r.distance),
      duration_s: Math.round(r.duration),
      geometry: r.geometry,
      ...nilai,
      ...skorRute({ accessibility: nilai.accessibility_score, distanceM: r.distance, tersingkatM }),
    });
  }
  routes.sort((a, b) => b.score - a.score);

  const adaData = routes.some((r) => r.accessibility_score !== null);
  const totalTangga = routes[0]?.hambatan?.ruas_tangga ?? 0;
  res.json({
    routes,
    destination: tujuan,
    needs,
    // Pesan dibentuk di backend dari data yang ada, bukan dikarang.
    message:
      (adaData
        ? `${routes.length} rute berjalan kaki. Peringkat memakai ${BOBOT_AKSESIBILITAS * 100}% aksesibilitas + ${BOBOT_JARAK * 100}% jarak.`
        : `${routes.length} rute berjalan kaki. Data aksesibilitas jalur pada rute ini belum cukup untuk dinilai, jadi peringkat memakai jarak saja.`) +
      (totalTangga ? ` Terdeteksi ${totalTangga} ruas tangga di sepanjang jalur.` : ''),
    disclaimer:
      'Rute diprioritaskan memakai informasi aksesibilitas jalur yang diketahui sistem. Ini bukan jaminan bahwa seluruh perjalanan bebas hambatan.',
  });
});
