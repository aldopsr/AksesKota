// Mencari lin transportasi umum yang menghubungkan dua titik, dari data OSM yang
// diimpor db/import-transit.js.
//
// Ini BUKAN perencana perjalanan. Tidak ada jadwal, tarif, atau waktu tempuh —
// PRD §5 menutup itu sebagai non-goal, dan mengarang angka-angka itu justru
// berbahaya bagi pengguna yang merencanakan perjalanan berdasarkan jawaban kita.
// Yang dijawab di sini hanya: "lin apa yang berhenti dekat Anda DAN dekat tujuan",
// lalu ditempeli data aksesibilitas stasiun naik/turun yang memang kita punya.
import { many } from './db.js';

// Sejauh apa orang dianggap masih bisa mencapai pemberhentian. 1,2 km sudah jauh
// untuk pengguna kursi roda, tapi stasiun KRL memang jarang: di bawah ini banyak
// perjalanan lintas kota kehilangan opsi rel sama sekali dan jatuh ke "tidak ada".
const RADIUS_M = 1200;

// Berapa lin terdekat yang ikut dipertimbangkan saat mencari perjalanan satu kali
// ganti. Tanpa batas ini, satu titik di pusat Jakarta menyentuh puluhan koridor
// dan perkalian silangnya membengkak tanpa menambah jawaban yang berguna.
const LIN_DIPERTIMBANGKAN = 8;

// Pemberhentian -> fasilitas transportasi di database kita, untuk menempelkan
// aksesibilitas yang sudah diverifikasi. 250 m: cukup longgar untuk peron yang
// titiknya tidak persis di gedung stasiun, cukup ketat agar tidak mengambil
// halte seberang jalan milik lin lain.
const RADIUS_COCOK_FASILITAS_M = 250;

const fasilitasDi = (titik) => `
  left join lateral (
    select f.id, f.name,
           coalesce(array_agg(a.name order by a.sort) filter (where af.status = 'available'), '{}') as tersedia,
           count(*) filter (where af.status <> 'unknown')::int as atribut_diketahui
      from facilities f
      join categories c on c.id = f.category_id and c.code = 'transportasi'
      left join accessibility_facilities af on af.facility_id = f.id
      left join accessibility_attributes a on a.code = af.attribute_code
     where st_dwithin(f.location, ${titik}, ${RADIUS_COCOK_FASILITAS_M})
     group by f.id
     -- Yang paling banyak datanya dulu, baru yang terdekat. Impor OSM sering
     -- meninggalkan duplikat stasiun tanpa atribut apa pun beberapa puluh meter
     -- dari entri terverifikasi; tanpa urutan ini, duplikat kosong itu yang menang.
     order by count(*) filter (where af.status <> 'unknown') desc,
              min(st_distance(f.location, ${titik}))
     limit 1
  )`;

// Pemberhentian dalam jangkauan sebuah titik, satu baris per lin (yang terdekat).
const DEKAT = `
  select distinct on (s.line_id) s.line_id, s.seq, s.name, s.location,
         round(st_distance(s.location, $TITIK$::geography))::int as jarak_m
    from transit_stops s
   where st_dwithin(s.location, $TITIK$::geography, $3)
   order by s.line_id, st_distance(s.location, $TITIK$::geography)`;

const titikAwal = DEKAT.replaceAll('$TITIK$', 'st_setsrid(st_makepoint($1,$2),4326)');
const titikAkhir = DEKAT.replaceAll('$TITIK$', 'st_setsrid(st_makepoint($4,$5),4326)');

const bentuk = (r, jenis) => ({
  jenis,
  lin: r.lin,
  moda: r.moda,
  warna: r.warna,
  operator: r.operator,
  naik: { nama: r.naik, jarak_m: r.naik_m, fasilitas_id: r.naik_fid, tersedia: r.naik_tersedia ?? [] },
  turun: { nama: r.turun, jarak_m: r.turun_m, fasilitas_id: r.turun_fid, tersedia: r.turun_tersedia ?? [] },
});

/** Perjalanan tanpa ganti: satu lin berhenti dekat kedua titik. */
async function langsung(params) {
  const rows = await many(
    `with o as (${titikAwal}), d as (${titikAkhir}),
     pasangan as (
       select distinct on (o.line_id)
              o.line_id, o.name as naik, o.jarak_m as naik_m, o.location as naik_loc,
              d.name as turun, d.jarak_m as turun_m, d.location as turun_loc,
              (d.seq - o.seq) as berhenti
         -- d.seq > o.seq, bukan <>: relasi route OSM satu arah, dan "Lin Bogor:
         -- Jakarta Kota → Bogor" tidak bisa dipakai untuk berangkat DARI Bogor.
         from o join d on d.line_id = o.line_id and d.seq > o.seq
        -- per lin, ambil pasangan naik/turun dengan total jalan kaki terpendek
        order by o.line_id, o.jarak_m + d.jarak_m
     )
     select l.name as lin, l.mode as moda, l.colour as warna, l.operator, p.berhenti,
            p.naik, p.naik_m, fn.id as naik_fid, fn.tersedia as naik_tersedia,
            p.turun, p.turun_m, ft.id as turun_fid, ft.tersedia as turun_tersedia
       from pasangan p
       join transit_lines l on l.osm_id = p.line_id
       ${fasilitasDi('p.naik_loc')} fn on true
       ${fasilitasDi('p.turun_loc')} ft on true
      -- yang paling sedikit jalan kakinya dulu; itu yang paling menentukan
      -- bagi pengguna yang kesulitan berjalan jauh
      order by p.naik_m + p.turun_m
      limit 3`,
    params,
  );
  return rows.map((r) => ({ ...bentuk(r, 'langsung'), jumlah_berhenti: r.berhenti }));
}

/** Perjalanan dengan satu kali ganti di pemberhentian yang namanya sama. */
async function satuGanti(params) {
  const rows = await many(
    `with o as (${titikAwal} limit ${LIN_DIPERTIMBANGKAN}),
          d as (${titikAkhir} limit ${LIN_DIPERTIMBANGKAN}),
     sambung as (
       select distinct on (o.line_id, d.line_id)
              o.line_id as lin_a, d.line_id as lin_b,
              o.name as naik, o.jarak_m as naik_m, o.location as naik_loc,
              d.name as turun, d.jarak_m as turun_m, d.location as turun_loc,
              sa.name as ganti
         from o
         join transit_stops sa on sa.line_id = o.line_id and sa.seq > o.seq
         -- titik ganti dicocokkan lewat NAMA, bukan jarak: peron KRL dan peron
         -- MRT di stasiun yang sama bisa terpisah ratusan meter di peta.
         join transit_stops sb on lower(sb.name) = lower(sa.name) and sb.line_id <> sa.line_id
         join d on d.line_id = sb.line_id and d.seq > sb.seq
        order by o.line_id, d.line_id, o.jarak_m + d.jarak_m
     )
     select la.name as lin, la.mode as moda, la.colour as warna, la.operator,
            lb.name as lin_lanjutan, lb.mode as moda_lanjutan, lb.colour as warna_lanjutan,
            s.ganti, s.naik, s.naik_m, fn.id as naik_fid, fn.tersedia as naik_tersedia,
            s.turun, s.turun_m, ft.id as turun_fid, ft.tersedia as turun_tersedia
       from sambung s
       join transit_lines la on la.osm_id = s.lin_a
       join transit_lines lb on lb.osm_id = s.lin_b
       ${fasilitasDi('s.naik_loc')} fn on true
       ${fasilitasDi('s.turun_loc')} ft on true
      order by s.naik_m + s.turun_m
      limit 2`,
    params,
  );
  return rows.map((r) => ({
    ...bentuk(r, 'satu_ganti'),
    ganti: { nama: r.ganti, lin: r.lin_lanjutan, moda: r.moda_lanjutan, warna: r.warna_lanjutan },
  }));
}

/**
 * Lin yang menghubungkan dua titik. Perjalanan langsung dicari dulu; pencarian
 * satu kali ganti yang jauh lebih mahal baru dijalankan kalau tidak ada yang langsung.
 */
export async function linPenghubung(from, to, { radius = RADIUS_M } = {}) {
  const params = [from[0], from[1], radius, to[0], to[1]];
  const hasil = await langsung(params);
  return unik(hasil.length ? hasil : await satuGanti(params));
}

// OSM memecah satu lin jadi beberapa relasi varian ("full racket", "half racket",
// pola akhir pekan). Bagi pengguna itu perjalanan yang sama, dan menampilkan
// tiga baris yang hanya beda nama varian membuat daftarnya terbaca seperti pilihan
// padahal bukan.
const unik = (daftar) => {
  const terlihat = new Set();
  return daftar.filter((o) => {
    const kunci = [o.naik.nama, o.turun.nama, o.ganti?.nama ?? ''].join('|');
    if (terlihat.has(kunci)) return false;
    terlihat.add(kunci);
    return true;
  });
};
