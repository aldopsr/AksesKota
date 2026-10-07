import express from 'express';
import { z } from 'zod';
import { many } from '../db.js';
import { semuaKode, resolveNeeds, sanitizeNeeds } from '../match.js';
import { searchFacilities } from './facilities.js';
import { pakaiKuota, kuotaKey } from '../quota.js';

// PRD 27: guardrail kuota. 10 query/hari itu per USER seperti di PRD.
//
// Guest dapat jatah jauh lebih besar karena kuncinya alamat IP, dan satu IP publik
// bisa mewakili banyak orang di balik NAT — di venue lomba, seluruh juri dan penonton
// berbagi satu IP. Memberi mereka jatah 10 berarti AI mati di menit kedua penilaian
// padahal berfungsi. Jadi batas Guest dilonggarkan, bukan batas per orang.
const KUOTA_USER = 10;
const KUOTA_GUEST_IP = 200;
const RADIUS_MAKS = 20_000;
const HASIL_MAKS = 10;

// Model dibuat bisa diganti lewat env: nama model Gemini berubah lebih cepat
// daripada kode ini. Kalau dapat 404 dari Google, ganti GEMINI_MODEL.
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const INTENT = ['search_facility', 'search_nearest_facility', 'get_facility_details', 'generate_route', 'clarify'];

export const router = express.Router();

// ---------------------------------------------------------------------------
// Validasi output LLM (FR-16)
// ---------------------------------------------------------------------------

/**
 * Batas kepercayaan. Apa pun yang keluar dari Gemini lewat sini dulu sebelum
 * menyentuh database: intent di luar daftar ditolak, radius dijepit, kode atribut
 * yang tidak dikenal dibuang, teks dipotong.
 *
 * Fungsi ini sengaja murni (tanpa I/O selain daftar kode atribut) supaya bisa diuji
 * tanpa memanggil Gemini — lihat test/smoke.js.
 */
export async function validateIntent(raw) {
  const skema = z.object({
    intent: z.enum(INTENT),
    category: z.string().max(50).nullish(),
    query: z.string().trim().max(120).nullish(),
    origin: z.enum(['user_location', 'named_place']).nullish(),
    origin_name: z.string().trim().max(120).nullish(),
    radius_m: z.coerce.number().int().positive().nullish(),
    accessibility_requirements: z.array(z.string().max(40)).max(10).nullish(),
    question: z.string().trim().max(200).nullish(),
  });
  const p = skema.parse(raw);

  const valid = await semuaKode();
  const kategoriValid = new Set((await many('select code from categories')).map((r) => r.code));

  return {
    intent: p.intent,
    // Kategori halusinasi dibuang, bukan diteruskan ke SQL sebagai string bebas.
    category: kategoriValid.has(p.category) ? p.category : null,
    query: p.query || null,
    origin: p.origin ?? null,
    origin_name: p.origin_name || null,
    radius_m: p.radius_m ? Math.min(p.radius_m, RADIUS_MAKS) : null,
    accessibility_requirements: (p.accessibility_requirements ?? []).filter((c) => valid.has(c)),
    question: p.question || null,
  };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const skemaRespons = (kodeAtribut, kodeKategori) => ({
  type: 'object',
  properties: {
    intent: { type: 'string', enum: INTENT },
    category: { type: 'string', enum: kodeKategori, nullable: true },
    query: { type: 'string', nullable: true },
    origin: { type: 'string', enum: ['user_location', 'named_place'], nullable: true },
    origin_name: { type: 'string', nullable: true },
    radius_m: { type: 'integer', nullable: true },
    accessibility_requirements: { type: 'array', items: { type: 'string', enum: kodeAtribut } },
    question: { type: 'string', nullable: true },
  },
  required: ['intent'],
});

const INSTRUKSI = `Kamu adalah pengubah perintah bahasa Indonesia menjadi parameter pencarian untuk AksesKota, peta aksesibilitas Kota Bogor.

Tugasmu HANYA menerjemahkan maksud pengguna menjadi parameter. Kamu TIDAK punya pengetahuan tentang fasilitas apa pun.
JANGAN pernah menyebut nama fasilitas, menyatakan suatu tempat punya ramp/lift/toilet, atau mengarang data. Seluruh data berasal dari database aplikasi.

Pilih intent:
- search_facility: mencari fasilitas berdasarkan kategori/nama, tanpa penekanan pada jarak.
- search_nearest_facility: pengguna menyebut "terdekat", "dekat saya", "di sekitar sini", atau menyebut radius.
- get_facility_details: pengguna menanyakan satu tempat tertentu yang dia sebut namanya.
- generate_route: pengguna meminta rute, arah, atau "antar saya ke".
- clarify: parameter penting benar-benar tidak bisa ditentukan. Isi "question" dengan SATU pertanyaan singkat.

Aturan:
- "query" hanya untuk nama tempat yang disebut pengguna, bukan untuk jenis tempat. "cari mall" -> category, bukan query.
- Masukkan kebutuhan aksesibilitas yang disebut pengguna ke accessibility_requirements. Jangan menambah yang tidak disebut.
- Kalau pengguna hanya bilang "yang aksesibel" tanpa menyebut kebutuhan spesifik, biarkan accessibility_requirements kosong.
- Gunakan clarify hemat-hemat. Kalau intent sudah cukup jelas, langsung keluarkan parameternya.
- TAPI kalau pengguna tidak menyebut jenis tempat MAUPUN nama tempat, wajib clarify. Contoh:
  "Cari tempat yang aksesibel" -> {"intent":"clarify","question":"Tempat apa yang ingin Anda cari?"}
  "Ada rekomendasi?" -> {"intent":"clarify","question":"Tempat apa yang ingin Anda cari?"}
  Mencari tanpa tahu jenis tempatnya hanya menghasilkan daftar acak, jadi lebih baik bertanya.`;

async function tanyaGemini(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY belum diisi'), { aiDown: true });

  const [kodeAtribut, kodeKategori] = await Promise.all([
    semuaKode().then((s) => [...s]),
    many('select code from categories').then((r) => r.map((x) => x.code)),
  ]);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUKSI }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: skemaRespons(kodeAtribut, kodeKategori),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok)
    throw Object.assign(new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`), { aiDown: true });

  const json = await res.json();
  const teks = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!teks) throw Object.assign(new Error('Gemini tidak mengembalikan isi'), { aiDown: true });
  return JSON.parse(teks);
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

/**
 * POST /api/ai/query  { text, lat?, lon?, needs? }
 *
 * Alur: teks -> Gemini (structured output) -> validateIntent -> searchFacilities -> hasil.
 * Speech-to-text dikerjakan di browser (Web Speech API), jadi endpoint ini menerima teks.
 */
router.post('/query', async (req, res) => {
  const { text, lat, lon } = z
    .object({
      text: z.string().trim().min(3).max(500),
      lat: z.coerce.number().min(-90).max(90).nullish(),
      lon: z.coerce.number().min(-180).max(180).nullish(),
    })
    .parse(req.body);

  const batas = req.user ? KUOTA_USER : KUOTA_GUEST_IP;
  const dipakai = await pakaiKuota(kuotaKey(req, 'ai'));
  if (dipakai > batas)
    return res.status(429).json({
      error: `Batas ${batas} pencarian AI per hari sudah tercapai. Pencarian dan filter biasa tetap bisa dipakai.`,
      fallback: 'search',
      query: text,
    });

  let parsed;
  try {
    parsed = await validateIntent(await tanyaGemini(text));
  } catch (e) {
    // NFR-04 / PRD 30.7: AI mati tidak boleh mematikan peta & pencarian biasa.
    // Frontend diberi `fallback` supaya bisa langsung menjalankan pencarian teks biasa.
    if (e.aiDown || e instanceof SyntaxError || e instanceof z.ZodError) {
      console.error('AI gagal:', e.message);
      return res.status(503).json({
        error: 'Layanan AI sedang tidak tersedia. Coba pencarian atau filter biasa.',
        fallback: 'search',
        query: text,
      });
    }
    throw e;
  }

  if (parsed.intent === 'clarify')
    return res.json({
      intent: 'clarify',
      question: parsed.question ?? 'Tempat apa yang ingin Anda cari?',
      parsed,
    });

  // PRD 18: kalau pengguna tidak menyebut kebutuhan spesifik, pakai profil aksesibilitasnya.
  const needs = parsed.accessibility_requirements.length
    ? await sanitizeNeeds(parsed.accessibility_requirements)
    : await resolveNeeds(req);

  const butuhLokasi = parsed.intent === 'search_nearest_facility' || parsed.origin === 'user_location';
  if (butuhLokasi && (lat == null || lon == null))
    return res.json({
      intent: 'clarify',
      question: 'Saya butuh lokasi Anda untuk mencari yang terdekat. Izinkan akses lokasi, atau sebutkan nama tempat asal.',
      parsed,
    });

  // Model sering menaruh JENIS tempat ("mall", "taman") ke `query`, padahal `query`
  // memfilter NAMA fasilitas. Akibatnya Botani Square hilang dari pencarian "mall"
  // hanya karena namanya tidak mengandung kata "mall" — hasil benar tersaring diam-diam.
  //
  // Prompt sudah melarangnya dan model besar patuh, model kecil tidak. Jadi ditutup di sini:
  // kalau kategori sudah ada, kategori yang dipakai — itu nilai tervalidasi terhadap tabel kita,
  // sedangkan `query` cuma teks bebas. `query` tetap dipertahankan saat pengguna memang
  // menyebut nama tempat tertentu (get_facility_details) atau tidak ada kategori sama sekali.
  const pakaiQuery = parsed.intent === 'get_facility_details' || !parsed.category;

  const results = await searchFacilities({
    q: pakaiQuery ? parsed.query : null,
    category: parsed.category,
    needs,
    lat: lat ?? null,
    lon: lon ?? null,
    radius: parsed.radius_m,
    limit: parsed.intent === 'get_facility_details' ? 1 : HASIL_MAKS,
  });

  // Kalimat jawaban dibentuk di sini, BUKAN oleh LLM. Dengan begitu tidak ada
  // kalimat yang menyebut fasilitas atau atribut yang tidak ada di database (PRD 30.1-30.5).
  const message = results.length
    ? `Ditemukan ${results.length} fasilitas${needs.length ? ` yang dinilai terhadap ${needs.length} kebutuhan Anda` : ''}.`
    : 'Tidak ditemukan fasilitas yang cocok dengan kriteria tersebut di data AksesKota.';

  res.json({
    intent: parsed.intent,
    parsed,
    needs,
    message,
    count: results.length,
    results,
    // generate_route: tujuan sudah dipilih di sini, pembuatan rutenya menyusul di endpoint routing.
    ...(parsed.intent === 'generate_route' && results[0] ? { destination: results[0] } : {}),
    quota: { used: dipakai, limit: batas },
    disclaimer:
      'Kondisi fasilitas di lapangan dapat berubah. AksesKota tidak menjamin suatu fasilitas atau rute sepenuhnya bebas hambatan bagi semua pengguna.',
  });
});
