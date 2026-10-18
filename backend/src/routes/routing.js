// Rute jalan kaki (PRD 23): proxy Mapbox Directions + skor rute 70% aksesibilitas / 30% jarak.
// Token Mapbox disimpan di server (.env), tidak dikirim ke client lewat endpoint ini.
import express from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { HttpError } from '../http.js';
import { rateLimit } from '../rateLimit.js';
import { linPenghubung } from '../transit.js';

export const router = express.Router();

const point = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).transform((s) => s.split(',').map(Number));
const query = z.object({
  from: point, // "lon,lat"
  to: point,
  facility_id: z.coerce.number().int().positive().optional(),
});

// Seberapa jauh dari garis rute sebuah ruas pejalan kaki masih dianggap bagian dari rute.
const TOLERANSI_M = 15;

// Cakupan minimum sebelum skor aksesibilitas layak ditampilkan.
//
// Alasannya bias pemetaan OSM: tangga dipetakan rajin (2.221 ruas) sementara
// `wheelchair=yes` jarang ditulis (271 ruas). Tanpa ambang ini, rute dengan sampel
// 3% jalur bisa mendapat skor 0 — angka yang terlihat pasti padahal hanya mencerminkan
// kebiasaan pemetaan, bukan kondisi jalan.
const MIN_COVERAGE = 0.2;

/**
 * Nilai aksesibilitas JALUR yang dilewati rute, dari jaringan pejalan kaki OSM (PRD §19.5).
 *
 * Hanya ruas yang statusnya DIKETAHUI yang masuk hitungan:
 *   accessibility = panjang_baik / (panjang_baik + panjang_buruk)
 * Ruas tanpa tag aksesibilitas tidak dihitung baik maupun buruk — itu `unknown`,
 * dan PRD §19.7 melarang memperlakukannya sebagai tidak tersedia.
 */
async function nilaiJalur(geometry, panjangM) {
  // ponytail: panjang ruas dihitung PENUH, bukan hanya bagian yang berimpit dengan rute.
  // Ruas panjang yang cuma menyerempet jadi over-counted. Naik kelas ke ST_Intersection
  // pada geometry terproyeksi (EPSG:32748 untuk Jawa bagian barat) kalau presisinya kurang.
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
            count(*) filter (where tangga)::int as ruas_tangga,
            count(*)::int as ruas_terdekat
       from kelas`,
    [JSON.stringify(geometry), TOLERANSI_M],
  );

  const diketahui = r.baik_m + r.buruk_m;
  const coverage = panjangM > 0 ? Math.min(1, diketahui / panjangM) : 0;
  return {
    // Skor hanya ditampilkan kalau sampelnya cukup besar untuk berarti.
    accessibility_score: diketahui > 0 && coverage >= MIN_COVERAGE
      ? Math.round((100 * r.baik_m) / diketahui)
      : null,
    coverage: Math.round(coverage * 100) / 100,
    coverage_cukup: coverage >= MIN_COVERAGE,
    ruas_diketahui_m: Math.round(diketahui),
    // Hambatan yang BENAR-BENAR terdeteksi. Bukti negatif di OSM jauh lebih lengkap
    // daripada bukti positif, jadi jumlah tangga lebih layak dipercaya daripada rasio apa pun.
    hambatan: { ruas_tangga: r.ruas_tangga, ruas_terdekat: r.ruas_terdekat },
  };
}

// Di atas jarak ini, menyodorkan rute jalan kaki sebagai saran itu tidak jujur:
// 3 km berarti sekitar 40 menit berjalan, dan bagi banyak pengguna kursi roda atau
// lansia itu bukan pilihan. PRD §5 menutup integrasi transportasi umum sebagai non-goal,
// jadi kita TIDAK membuat rute transit — kita hanya menunjukkan fasilitas transportasi
// beraksesibilitas yang memang sudah ada di database kita, lengkap dengan apa yang
// diketahui dan apa yang belum.
const AMBANG_TRANSPORTASI_M = 3000;
const RADIUS_CARI_TRANSPORTASI_M = 2500;

/** "507 menit" tidak terbaca sebagai lama. Di atas 90 menit, tulis dalam jam. */
const lamaJalan = (detik) => {
  const menit = Math.round(detik / 60);
  if (menit < 90) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
};

/** Dua fasilitas transportasi terdekat dari sebuah titik, diurutkan dari yang paling aksesibel. */
async function transportTerdekat(lon, lat) {
  return many(
    `with titik as (select st_setsrid(st_makepoint($1,$2),4326)::geography g)
     select f.id, f.name, f.address,
            round(st_distance(f.location, t.g))::int as jarak_m,
            coalesce(array_agg(a.name order by a.sort) filter (where af.status = 'available'), '{}') as tersedia,
            count(*) filter (where af.status <> 'unknown')::int as atribut_diketahui
       from facilities f
       join categories c on c.id = f.category_id and c.code = 'transportasi'
       left join accessibility_facilities af on af.facility_id = f.id
       left join accessibility_attributes a on a.code = af.attribute_code
       cross join titik t
      where st_dwithin(f.location, t.g, $3)
      group by f.id, t.g
      -- yang paling banyak atribut tersedianya dulu, baru yang terdekat: bagi pengguna
      -- kursi roda, halte aksesibel 800 m lebih berguna daripada halte tak jelas 200 m
      order by count(*) filter (where af.status = 'available') desc, jarak_m
      limit 2`,
    [lon, lat, RADIUS_CARI_TRANSPORTASI_M],
  );
}

/**
 * Saran transportasi umum bila rutenya terlalu jauh untuk berjalan kaki, atau null.
 * Dipakai endpoint rute DAN tool AI `plan_route` — keduanya harus berhenti menyodorkan
 * jalan kaki berjam-jam, bukan hanya salah satunya.
 */
export async function saranTransportasi(from, to, route) {
  if (route.distance <= AMBANG_TRANSPORTASI_M) return null;
  const alasan = `Jarak ${(route.distance / 1000).toFixed(1)} km, sekitar ${lamaJalan(route.duration)} berjalan kaki. Pertimbangkan transportasi umum.`;

  // Jawaban yang sebenarnya dicari pengguna adalah "naik apa dari sini ke sana".
  const lin = await linPenghubung(from, to);
  if (lin.length) {
    return {
      alasan,
      lin,
      catatan: 'Lin dan urutan pemberhentian berasal dari OpenStreetMap. AksesKota tidak menyediakan jadwal, tarif, atau waktu tempuh — periksa jadwal resmi operator sebelum berangkat.',
    };
  }

  // Tidak ada lin yang menghubungkan keduanya di data kami. Daripada diam, tunjukkan
  // titik transportasi terdekat — pengguna masih bisa melanjutkan dari sana sendiri.
  return {
    alasan,
    lin: [],
    dekat_anda: await transportTerdekat(from[0], from[1]),
    dekat_tujuan: await transportTerdekat(to[0], to[1]),
    // Dinyatakan terpisah supaya UI bisa bilang "belum terdata" alih-alih
    // menampilkan daftar kosong yang terbaca seperti kerusakan.
    radius_cari_m: RADIUS_CARI_TRANSPORTASI_M,
    catatan: 'Tidak ada lin transportasi umum di data kami yang menghubungkan kedua titik ini. Daftar di bawah hanya fasilitas transportasi terdekat.',
  };
}

/**
 * Route Score = 70% aksesibilitas jalur + 30% jarak (PRD §19.7).
 *
 * `geometry` adalah garis rute dari Mapbox. Sebelumnya fungsi ini menerima atribut
 * FASILITAS TUJUAN dan menyebutnya skor aksesibilitas rute — itu mengukur hal yang salah:
 * aksesibilitas tujuan sudah dihitung terpisah sebagai Accessibility Match, dan tidak
 * mengatakan apa pun tentang perjalanannya.
 */
export async function scoreRoute(distanceM, geometry) {
  const jalur = await nilaiJalur(geometry, distanceM);
  const distance = Math.max(0, Math.min(100, Math.round(100 - (distanceM / 1000) * 10)));
  const a = jalur.accessibility_score;
  // Data jalur tidak diketahui -> urutkan dengan jarak saja. Tidak ada penalti karangan.
  const route = a === null ? distance : Math.round(a * 0.7 + distance * 0.3);
  return {
    ...jalur,
    distance_score: distance,
    route_score: route,
    basis: a === null ? 'jarak_saja' : 'aksesibilitas_jalur+jarak',
  };
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

  // Jarak jauh: jangan diam-diam menyodorkan rute jalan kaki 3 jam sebagai saran.
  const saran = await saranTransportasi(from, to, route);

  // facility_id tidak lagi dipakai untuk menilai rute — aksesibilitas tujuan sudah
  // dilaporkan terpisah sebagai Accessibility Match di endpoint fasilitas. Parameternya
  // dibiarkan diterima agar panggilan frontend yang sudah ada tidak perlu diubah.
  res.json({
    distance_m: Math.round(route.distance),
    duration_s: Math.round(route.duration),
    geometry: route.geometry,
    facility_id: facility_id ?? null,
    terlalu_jauh_untuk_jalan_kaki: saran !== null,
    saran_transportasi: saran,
    ...(await scoreRoute(route.distance, route.geometry)),
  });
});
