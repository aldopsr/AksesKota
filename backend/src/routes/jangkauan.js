// Jangkauan nyata: seberapa jauh seseorang benar-benar bisa bergerak dari satu titik
// dalam waktu tertentu, dihitung di atas jaringan pejalan kaki OSM.
//
// Ini jawaban atas keberatan yang paling sulit dibantah tentang aplikasi ini: "isinya
// cuma beberapa titik yang punya ramp". Pertanyaan yang sebenarnya penting bukan
// "apakah gedungnya aksesibel" melainkan "apakah saya bisa sampai ke sana" — dan
// jaringan jalannya (24.180 ruas, 2.228 di antaranya tangga) jauh lebih lengkap
// daripada atribut gedungnya.
//
// Dua perjalanan dihitung di atas graf yang sama: satu tanpa larangan, satu dengan
// tangga dan ruas bertanda tidak-dapat-dilalui DIBUANG dari graf. Selisih keduanya
// itulah yang ingin ditunjukkan.
import express from 'express';
import { z } from 'zod';
import { many } from '../db.js';
import { HttpError } from '../http.js';
import { rateLimit } from '../rateLimit.js';

export const router = express.Router();

const query = z.object({
  lon: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  menit: z.coerce.number().int().min(5).max(30).default(15),
});

// Asumsi kecepatan. Ditulis di sini supaya bisa diperdebatkan, bukan disembunyikan:
// 4,5 km/jam kecepatan jalan kaki santai orang dewasa, 3,0 km/jam angka yang lazim
// dipakai untuk pengguna kursi roda manual di trotoar perkotaan. Keduanya rata-rata
// kasar — yang dibandingkan bentuk jangkauannya, bukan detiknya.
const LAJU = { jalan: 4.5 / 3.6, kursi_roda: 3.0 / 3.6 }; // meter per detik

// Dua simpul dianggap sama bila koordinatnya sama sampai 5 desimal (~1,1 m).
// Tanpa pembulatan ini, ruas yang bertemu di persimpangan tidak pernah tersambung
// karena titik ujungnya beda di digit ke-7.
const kunci = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`;

const haversine = ([x1, y1], [x2, y2]) => {
  const R = 6371000;
  const dLat = ((y2 - y1) * Math.PI) / 180;
  const dLon = ((x2 - x1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((y1 * Math.PI) / 180) * Math.cos((y2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Dijkstra sederhana dengan batas waktu.
 *
 * ponytail: antrean prioritasnya array yang disortir ulang, bukan heap biner. Untuk
 * beberapa ribu simpul dalam radius 2 km ini di bawah 50 ms; kalau radiusnya nanti
 * dinaikkan sampai sekota, barulah heap-nya sepadan.
 */
function jelajah(graf, mulai, batasDetik, laju) {
  const terbaik = new Map([[mulai, 0]]);
  const antre = [[0, mulai]];
  const terpakai = new Set(); // id ruas yang terlewati

  while (antre.length) {
    antre.sort((a, b) => a[0] - b[0]);
    const [biaya, simpul] = antre.shift();
    if (biaya > (terbaik.get(simpul) ?? Infinity)) continue;
    for (const sisi of graf.get(simpul) ?? []) {
      const biayaBaru = biaya + sisi.panjang / laju;
      if (biayaBaru > batasDetik) continue;
      terpakai.add(sisi.id);
      if (biayaBaru < (terbaik.get(sisi.ke) ?? Infinity)) {
        terbaik.set(sisi.ke, biayaBaru);
        antre.push([biayaBaru, sisi.ke]);
      }
    }
  }
  return terpakai;
}

/** Graf dari daftar ruas. `lewat` menentukan ruas mana yang boleh dipakai. */
function bangunGraf(ruas, lewat) {
  const graf = new Map();
  const sambung = (a, b, sisi) => {
    if (!graf.has(a)) graf.set(a, []);
    graf.get(a).push({ ke: b, ...sisi });
  };
  ruas.forEach((r, iRuas) => {
    if (!lewat(r)) return;
    const titik = r.koordinat;
    for (let i = 0; i < titik.length - 1; i += 1) {
      const a = kunci(titik[i]);
      const b = kunci(titik[i + 1]);
      if (a === b) continue;
      const panjang = haversine(titik[i], titik[i + 1]);
      // Dua arah: trotoar tidak punya arah.
      sambung(a, b, { panjang, id: iRuas });
      sambung(b, a, { panjang, id: iRuas });
    }
  });
  return graf;
}

/** Simpul graf terdekat dari titik awal — supaya perjalanan mulai dari jalan, bukan dari udara. */
function simpulTerdekat(ruas, graf, asal) {
  let terdekat = null;
  let jarak = Infinity;
  ruas.forEach((r) => {
    r.koordinat.forEach((t) => {
      const k = kunci(t);
      if (!graf.has(k)) return;
      const d = haversine(asal, t);
      if (d < jarak) { jarak = d; terdekat = k; }
    });
  });
  return { simpul: terdekat, jarak };
}

const bolehKursiRoda = (r) => !(
  r.highway === 'steps'
  || r.wheelchair === 'no'
  || ['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'].includes(r.smoothness)
);

// Sejauh mana dari titik awal ruas diambil dari database. Lebih luas dari jarak
// tempuh teoretis supaya jalan memutar tetap terhitung, tapi tidak lebih — radius
// inilah yang menentukan berat query dan berat Dijkstra-nya.
const radiusAmbil = (menit) => Math.min(4000, menit * 60 * LAJU.jalan * 1.4);

router.get('/jangkauan', rateLimit({ windowMs: 60_000, max: 20 }), async (req, res, next) => {
  try {
    const p = query.safeParse(req.query);
    if (!p.success) throw new HttpError(400, 'Parameter titik atau menit tidak valid.');
    const { lon, lat, menit } = p.data;
    const asal = [lon, lat];
    const batas = menit * 60;

    const ruas = await many(
      `select w.highway, w.wheelchair, w.smoothness,
              st_asgeojson(w.geom::geometry) as geojson
         from pedestrian_ways w
        where st_dwithin(w.geom, st_setsrid(st_makepoint($1,$2),4326)::geography, $3)
        limit 8000`,
      [lon, lat, radiusAmbil(menit)],
    );
    if (!ruas.length) {
      return res.json({ ada_jaringan: false, menit, titik: { lon, lat } });
    }

    const daftar = ruas.map((r) => ({ ...r, koordinat: JSON.parse(r.geojson).coordinates }));

    const hasil = {};
    for (const mode of ['jalan', 'kursi_roda']) {
      const lewat = mode === 'jalan' ? () => true : bolehKursiRoda;
      const graf = bangunGraf(daftar, lewat);
      const { simpul, jarak } = simpulTerdekat(daftar, graf, asal);
      // Titik awal yang 300 m dari jalan terdekat berarti kita menebak, bukan menghitung.
      if (!simpul || jarak > 300) { hasil[mode] = { features: [], panjang_m: 0, jauh_dari_jaringan: true }; continue; }
      const terpakai = jelajah(graf, simpul, batas, LAJU[mode]);
      let panjang = 0;
      const features = [];
      terpakai.forEach((i) => {
        const r = daftar[i];
        for (let j = 0; j < r.koordinat.length - 1; j += 1) panjang += haversine(r.koordinat[j], r.koordinat[j + 1]);
        features.push({
          type: 'Feature',
          properties: { mode },
          geometry: { type: 'LineString', coordinates: r.koordinat },
        });
      });
      hasil[mode] = { features, panjang_m: Math.round(panjang), jauh_dari_jaringan: false };
    }

    const pj = hasil.jalan.panjang_m;
    const pk = hasil.kursi_roda.panjang_m;
    res.json({
      ada_jaringan: true,
      menit,
      titik: { lon, lat },
      laju_kmj: { jalan: 4.5, kursi_roda: 3.0 },
      jalan: { type: 'FeatureCollection', features: hasil.jalan.features },
      kursi_roda: { type: 'FeatureCollection', features: hasil.kursi_roda.features },
      panjang_m: { jalan: pj, kursi_roda: pk },
      // Berapa persen jangkauan yang tersisa bagi pengguna kursi roda. Inilah angkanya.
      persen_tersisa: pj > 0 ? Math.round((100 * pk) / pj) : null,
      jauh_dari_jaringan: hasil.jalan.jauh_dari_jaringan,
    });
  } catch (e) { next(e); }
});
