// Klien tipis untuk Gemini generateContent (REST). Kunci API hanya di server dan dikirim lewat header.
import { HttpError } from '../http.js';

/**
 * GEMINI_API_KEY boleh berisi BEBERAPA kunci, dipisah koma.
 *
 * Kuota gratis Gemini habis per hari per proyek, dan kalau itu terjadi di tengah
 * penjurian asisten mati total tanpa ada yang bisa dikerjakan dari luar. Dengan daftar
 * kunci, yang kehabisan cukup dilewati — tidak ada env yang perlu diganti, tidak ada
 * deploy ulang, tidak ada yang perlu menunggui dasbor.
 *
 * Satu kunci tetap sah: string tanpa koma menghasilkan daftar berisi satu.
 */
const daftarKunci = () =>
  (process.env.GEMINI_API_KEY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const geminiEnabled = () => daftarKunci().length > 0;

/**
 * Status yang berarti "coba kunci berikutnya", bukan "menyerah".
 *
 * 429 kuota habis, 403 ditolak, 400 tidak sah — ketiganya tentang KUNCI ITU.
 *
 * 404 juga, dan ini sempat salah dirancang. Mudah mengira 404 berarti "nama modelnya
 * keliru", yang sama untuk semua kunci sehingga tidak perlu diulang. Ternyata Google
 * memakai 404 yang sama untuk "akun ini tidak boleh memakai model tersebut" — pesan
 * aslinya pernah terbaca persis begitu: "no longer available to new users". Jadi 404
 * BISA tentang kuncinya, dan akun yang baru dibuat justru yang paling mungkin kena.
 *
 * Harga memasukkannya kecil: kalau nama modelnya memang keliru, tiap kunci membalas
 * 404 dalam ~300 ms lalu berhenti, dan kode 404 tetap dilaporkan apa adanya.
 */
const COBA_KUNCI_LAIN = new Set([400, 403, 404, 429]);

/**
 * GEMINI_MODEL juga boleh berisi beberapa nama model, dipisah koma.
 *
 * Alasannya sama tidak menyenangkannya dengan kunci: ketersediaan model BERBEDA per
 * akun. Akun lama bisa memakai gemini-2.5-flash, akun yang baru dibuat membalas 404
 * untuk model yang sama ("no longer available to new users"). Jadi satu nama model
 * tidak pernah cukup untuk sekumpulan kunci dari beberapa akun — dan menebak-nebak
 * nama yang benar untuk tiap akun di tengah penjurian bukan rencana.
 *
 * Bawaannya empat, urutannya hasil pengukuran pada dua akun nyata (24 Okt 2026):
 *   gemini-2.5-flash          jalan di akun lama; akun BARU membalas 404 untuk ini
 *   gemini-3.5-flash          kebalikannya — jalan di akun baru (2,4 dtk)
 *   gemini-flash-lite-latest  alias model ringan termutakhir, jalan di keduanya, dan
 *                             KUOTANYA TERPISAH: masih menjawab saat jatah 2.5-flash
 *                             pada kunci yang sama sudah 429
 *   gemini-2.5-flash-lite     cadangan untuk akun yang punya ini tapi bukan aliasnya
 *
 * gemini-flash-latest sengaja TIDAK dipakai: diuji pada hari yang sama di dua akun, ia
 * tidak menjawab sampai 25 detik sementara yang lain menjawab di bawah tiga detik.
 *
 * Daftar ini sengaja lebar karena harga menebaknya murah (404 kembali dalam ~400 ms)
 * sedangkan harga salah tebak mahal: asisten mati total di depan juri. Pasangan yang
 * berhasil diingat, jadi pemborosan itu paling banyak sekali per cold start.
 */
const daftarModel = () =>
  (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash,gemini-3.5-flash,gemini-flash-lite-latest,gemini-2.5-flash-lite')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Pasangan (kunci, model) yang terakhir berhasil. Bertahan selama instance serverless
// hidup, jadi permintaan berikutnya tidak menabrak lagi yang sudah diketahui gagal.
let mulai = 0;

export async function generate(body) {
  const kunci = daftarKunci();
  if (!kunci.length) throw new HttpError(503, 'Asisten AI belum diaktifkan di server.', { fallback: true });

  const base = process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';
  const model = daftarModel();
  // Satu daftar datar berisi semua pasangan, diurut per kunci: habiskan model-model satu
  // kunci dulu sebelum pindah kunci. Kuota dihitung per model per akun, jadi kunci yang
  // satu modelnya habis masih mungkin punya sisa di model lainnya.
  const pasangan = kunci.flatMap((k, ik) => model.map((m, im) => ({ k, m, label: `kunci #${ik + 1}/${kunci.length} ${m}` })));
  let galatTerakhir = null;

  for (let n = 0; n < pasangan.length; n += 1) {
    const i = (mulai + n) % pasangan.length;
    const { k, m, label } = pasangan[i];
    let res;
    try {
      res = await fetch(`${base}/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      // Jaringan putus bukan salah kuncinya — pasangan lain akan gagal dengan cara sama.
      console.error('[gemini] gagal terhubung:', e.name);
      throw new HttpError(503, 'Asisten AI tidak dapat dihubungi saat ini.', { fallback: true });
    }

    if (res.ok) {
      mulai = i; // pasangan ini sehat; mulai dari sini lain kali
      return res.json();
    }

    // Nomor urut dan nama model, tidak pernah kuncinya: log cukup untuk tahu pasangan
    // mana yang gagal tanpa menuliskan satu pun karakter rahasia.
    console.error(`[gemini] ${label} status`, res.status); // jangan log body/kunci
    galatTerakhir = res.status;
    if (!COBA_KUNCI_LAIN.has(res.status)) break;
  }

  // Kode status ikut dikirim ke klien, dan sebabnya pahit: di Vercel log runtime tidak
  // selalu bisa dibaca, jadi "asisten sedang sibuk" adalah jalan buntu — tidak ada cara
  // membedakan kunci yang salah (403), model yang tidak ada (404), dan kuota habis (429)
  // tanpa menebak. Kode statusnya bukan rahasia; isi body-nya tidak pernah dikirim
  // karena di situlah kunci bisa terpantul kembali.
  //
  // Sampai di sini berarti SEMUA pasangan kunci-model sudah dicoba. 429 dipisah
  // pesannya: itu
  // satu-satunya yang akan dialami pengguna biasa, dan "coba lagi sebentar lagi" di
  // situ menyesatkan — kuota harian tidak pulih dalam hitungan menit.
  const pesan = galatTerakhir === 429
    ? 'Kuota asisten AI hari ini sudah habis. Pencarian dan peta tetap bisa dipakai.'
    : 'Asisten AI sedang sibuk. Coba lagi sebentar lagi.';
  throw new HttpError(503, pesan, { fallback: true, upstream: galatTerakhir });
}
