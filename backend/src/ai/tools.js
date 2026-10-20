// Alat yang boleh dipanggil model. Semua membaca DATABASE; model tidak punya sumber data lain,
// sehingga rekomendasi tidak bisa mengarang fasilitas atau atribut (PRD AI Safety).
import { z } from 'zod';
import { many, one } from '../db.js';
import { sanitizeNeeds } from '../match.js';
import { searchFacilities } from '../routes/facilities.js';
import { fetchWalkingRoute, saranTransportasi, scoreRoute } from '../routes/routing.js';

const CATEGORIES = ['kesehatan', 'pendidikan', 'layanan_publik', 'transportasi', 'komersial'];
const NEEDS = ['ramp', 'guiding_block', 'accessible_toilet', 'lift', 'accessible_parking', 'wheelchair_path', 'braille', 'audio_access', 'accessible_entrance', 'handrail'];

export const declarations = [
  {
    name: 'search_facilities',
    description: 'Cari fasilitas di database AksesKota, diurutkan dari yang paling cocok dengan kebutuhan aksesibilitas lalu yang terdekat. Pakai untuk mencari tempat, mencari nama tempat tertentu, atau mengumpulkan kandidat rekomendasi.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', enum: CATEGORIES, description: 'Jenis tempat.' },
        needs: { type: 'ARRAY', items: { type: 'STRING', enum: NEEDS }, description: 'Kebutuhan aksesibilitas yang disebut pengguna. Kosongkan bila tidak disebut, maka profil tersimpan dipakai.' },
        query: { type: 'STRING', description: 'Nama fasilitas YANG DICARI pengguna, bila ia menyebut namanya (mis. "cari Botani Square" -> "Botani Square"). JANGAN isi dengan tempat yang hanya dipakai sebagai patokan lokasi — itu milik near_place.' },
        near_place: { type: 'STRING', description: 'Tempat yang dipakai pengguna sebagai PATOKAN LOKASI, bukan yang dicari (mis. "rumah sakit di dekat Stasiun Bogor" -> "Stasiun Bogor"). Pencarian akan dipusatkan ke titik itu.' },
        radius_m: { type: 'INTEGER', description: 'Radius dalam meter dari titik pusat pencarian ("dekat saya" = 2000).' },
        limit: { type: 'INTEGER', description: 'Jumlah hasil, 1 sampai 8. Default 5.' },
        use_profile: { type: 'BOOLEAN', description: 'false bila pengguna jelas tidak ingin memakai profil kebutuhannya.' },
      },
    },
  },
  {
    name: 'get_facility_details',
    description: 'Ambil rincian satu fasilitas: status tiap atribut aksesibilitas, rating, dan kesegaran data. Pakai untuk menjawab pertanyaan spesifik atau membandingkan tempat.',
    parameters: { type: 'OBJECT', properties: { facility_id: { type: 'INTEGER' } }, required: ['facility_id'] },
  },
  {
    name: 'plan_route',
    description: 'Buatkan rute jalan kaki dari lokasi pengguna ke satu fasilitas. Aplikasi akan langsung menampilkan rutenya di peta. facility_id HARUS berasal dari hasil search_facilities atau get_facility_details.',
    parameters: { type: 'OBJECT', properties: { facility_id: { type: 'INTEGER' } }, required: ['facility_id'] },
  },
  {
    name: 'recommend_facilities',
    description: 'Tandai 1 sampai 3 fasilitas sebagai rekomendasi akhir agar tampil sebagai kartu rekomendasi. ID harus dari hasil pencarian sebelumnya. Panggil sebelum menulis jawaban rekomendasi.',
    parameters: { type: 'OBJECT', properties: { facility_ids: { type: 'ARRAY', items: { type: 'INTEGER' } } }, required: ['facility_ids'] },
  },
];

const STATUS_ID = { available: 'tersedia', not_available: 'tidak tersedia', unknown: 'belum diketahui' };

async function withRatings(rows) {
  if (!rows.length) return rows;
  const r = await many(
    `select facility_id, round(avg(rating),1)::float as rating_avg, count(*)::int as rating_count
       from reviews where facility_id = any($1::int[]) group by facility_id`,
    [rows.map((x) => x.id)],
  );
  const by = Object.fromEntries(r.map((x) => [x.facility_id, x]));
  return rows.map((x) => ({ ...x, rating_avg: by[x.id]?.rating_avg ?? null, rating_count: by[x.id]?.rating_count ?? 0 }));
}

const forModel = (f) => ({
  id: f.id, nama: f.name, kategori: f.category_name, alamat: f.address,
  jarak_m: f.distance_m, kecocokan_persen: f.match_pct, label: f.label ?? null,
  kebutuhan_terpenuhi: f.needs_total ? `${f.needs_met} dari ${f.needs_total}` : null,
  kebutuhan_belum_diketahui: f.needs_unknown ?? 0,
  kesegaran_data: f.freshness === 'verified_recently' ? 'baru diverifikasi' : 'perlu verifikasi ulang',
  rating: f.rating_avg, jumlah_ulasan: f.rating_count ?? 0,
});

/** ctx: { origin:{lat,lon}|null, profile:string[], seen:Map, lastResults, applied, recommended, routeFacilityId, usedProfile } */
export function createExecutors(ctx) {
  const remember = (rows) => rows.forEach((r) => ctx.seen.set(r.id, r));

  async function search_facilities(args) {
    const a = z.object({
      category: z.enum(CATEGORIES).optional(),
      needs: z.array(z.string()).max(10).optional(),
      query: z.string().trim().max(80).optional(),
      near_place: z.string().trim().max(80).optional(),
      radius_m: z.coerce.number().int().min(100).max(50_000).optional(),
      limit: z.coerce.number().int().min(1).max(8).default(5),
      use_profile: z.boolean().optional(),
    }).parse(args ?? {});

    let needs = await sanitizeNeeds(a.needs ?? []);
    let usedProfile = false;
    if (!needs.length && a.use_profile !== false && ctx.profile.length) { needs = ctx.profile; usedProfile = true; }

    // "di dekat Stasiun Bogor" artinya pusat pencarian pindah ke sana, BUKAN menyaring
    // nama fasilitas. Titiknya dicari di tabel fasilitas kita sendiri — tidak memanggil
    // layanan geocoding luar, dan tidak ada koordinat karangan dari model.
    let origin = ctx.origin;
    let nearResolved = null;
    if (a.near_place) {
      const p = await one(
        `select name, st_y(location::geometry) as lat, st_x(location::geometry) as lon
           from facilities where name ilike '%' || $1 || '%'
          order by length(name) limit 1`,
        [a.near_place],
      );
      if (p) { origin = { lat: p.lat, lon: p.lon }; nearResolved = p.name; }
    }

    const radius = origin && a.radius_m ? a.radius_m : null;
    const cari = (q) => searchFacilities({
      q: q || null, category: a.category ?? null, needs,
      lat: origin?.lat ?? null, lon: origin?.lon ?? null, radius, limit: a.limit,
    });

    let rows = await cari(a.query);
    // Model kadang tetap memasukkan jenis atau patokan tempat ke `query`, dan itu
    // menyaring NAMA fasilitas sehingga hasil yang benar hilang diam-diam. Kalau
    // gabungan kategori+nama tidak menghasilkan apa pun, ulangi tanpa saringan nama.
    let namaDiabaikan = false;
    if (!rows.length && a.query && a.category) { rows = await cari(null); namaDiabaikan = rows.length > 0; }

    rows = await withRatings(rows);
    remember(rows);
    ctx.lastResults = rows;
    ctx.usedProfile = ctx.usedProfile || usedProfile;
    ctx.applied = {
      category: a.category ?? null, needs, radius_m: radius,
      query: namaDiabaikan ? null : a.query ?? null,
      near_place: nearResolved, used_profile: usedProfile,
    };

    return {
      jumlah: rows.length,
      hasil: rows.map(forModel),
      kebutuhan_dipakai: needs,
      memakai_profil_tersimpan: usedProfile,
      lokasi_pengguna_diketahui: !!origin,
      pusat_pencarian: nearResolved ?? (ctx.origin ? 'lokasi pengguna' : null),
      catatan: [
        a.near_place && !nearResolved
          ? `"${a.near_place}" tidak ada di database AksesKota, jadi pencarian tidak dipusatkan ke sana. Sampaikan hal ini ke pengguna.`
          : null,
        namaDiabaikan ? `Saringan nama "${a.query}" diabaikan karena tidak ada yang cocok; hasil di bawah berdasarkan kategori saja.` : null,
        a.radius_m && !origin ? 'Radius diabaikan karena titik pusat belum diketahui; hasil tidak diurutkan menurut jarak.' : null,
        !rows.length ? 'Tidak ada fasilitas yang cocok di database. Sampaikan jujur dan sarankan melonggarkan kriteria.' : null,
      ].filter(Boolean),
    };
  }

  async function get_facility_details(args) {
    const { facility_id } = z.object({ facility_id: z.coerce.number().int().positive() }).parse(args ?? {});
    const needs = ctx.applied?.needs?.length ? ctx.applied.needs : ctx.profile;
    const [row] = await withRatings(await searchFacilities({
      needs, lat: ctx.origin?.lat ?? null, lon: ctx.origin?.lon ?? null, ids: [facility_id], limit: 1,
    }));
    if (!row) return { error: 'Fasilitas tidak ditemukan.' };
    remember([row]);
    const attrs = await many(
      `select a.name, coalesce(af.status,'unknown') as status, af.notes
         from accessibility_attributes a
         left join accessibility_facilities af on af.attribute_code = a.code and af.facility_id = $1
        order by a.sort`,
      [facility_id],
    );
    return {
      ...forModel(row),
      deskripsi: row.description,
      atribut: attrs.map((x) => ({ nama: x.name, status: STATUS_ID[x.status], catatan: x.notes })),
    };
  }

  async function plan_route(args) {
    const { facility_id } = z.object({ facility_id: z.coerce.number().int().positive() }).parse(args ?? {});
    const [row] = await withRatings(await searchFacilities({
      needs: ctx.applied?.needs ?? [], lat: ctx.origin?.lat ?? null, lon: ctx.origin?.lon ?? null, ids: [facility_id], limit: 1,
    }));
    if (!row) return { error: 'Fasilitas tidak ditemukan. Cari dulu dengan search_facilities.' };
    remember([row]);
    ctx.routeFacilityId = facility_id;
    const out = { fasilitas: row.name };
    if (!ctx.origin) {
      return { ...out, perlu_lokasi: true, catatan: 'Lokasi pengguna belum aktif. Aplikasi akan meminta izin lokasi lalu menampilkan rute. Beri tahu pengguna untuk mengizinkan lokasi.' };
    }
    try {
      const route = await fetchWalkingRoute([ctx.origin.lon, ctx.origin.lat], [row.lon, row.lat]);
      const s = await scoreRoute(route.distance, route.geometry);
      // Tanpa ini model menjawab "44 km, 8 jam jalan kaki" dengan nada menyarankan.
      const saran = await saranTransportasi([ctx.origin.lon, ctx.origin.lat], [row.lon, row.lat], route);
      return {
        ...out,
        jarak_m: Math.round(route.distance),
        durasi_menit: Math.max(1, Math.round(route.duration / 60)),
        skor_aksesibilitas_jalur: s.accessibility_score,
        skor_rute: s.route_score,
        cakupan_data_jalur: s.coverage,
        ruas_tangga_di_jalur: s.hambatan.ruas_tangga,
        saran_transportasi: saran,
        catatan: [
          'Rute sudah ditampilkan di peta.',
          // Skor null berarti data jalur belum cukup — model harus mengatakannya apa adanya,
          // bukan menyimpulkan rutenya mulus.
          s.accessibility_score === null
            ? 'Data aksesibilitas jalur pada rute ini belum cukup untuk dinilai; sampaikan apa adanya.'
            : null,
          s.hambatan.ruas_tangga ? `Terdeteksi ${s.hambatan.ruas_tangga} ruas tangga di sepanjang jalur.` : null,
          // "Terlalu jauh" adalah penilaian, dan model bisa tidak sependapat untuk
          // 2,8 km lalu diam soal transportasi umum — itu yang terjadi. Instruksinya
          // dibuat tidak bisa ditafsir: ambangnya sudah diputuskan di sini, tugas model
          // hanya menyampaikan isinya.
          saran
            ? `WAJIB disebutkan: jarak ini melewati ambang jalan kaki AksesKota, jadi sampaikan ${saran.lin.length} pilihan transportasi umum pada saran_transportasi — sebut nama linnya. Jangan menilai ulang apakah jaraknya masih bisa dijalani, dan jangan mengarang jadwal, tarif, atau waktu tempuh.`
            : null,
        ].filter(Boolean).join(' '),
      };
    } catch {
      return { ...out, rute_tidak_dapat_dihitung: true, catatan: 'Estimasi rute belum tersedia saat ini, tetapi tempat tujuan sudah ditampilkan.' };
    }
  }

  async function recommend_facilities(args) {
    const { facility_ids } = z.object({ facility_ids: z.array(z.coerce.number().int().positive()).min(1).max(3) }).parse(args ?? {});
    // hanya ID yang benar-benar pernah muncul dari database pada percakapan ini
    ctx.recommended = [...new Set(facility_ids)].filter((id) => ctx.seen.has(id));
    return { diterima: ctx.recommended.length, ditolak: facility_ids.length - ctx.recommended.length };
  }

  return { search_facilities, get_facility_details, plan_route, recommend_facilities };
}

