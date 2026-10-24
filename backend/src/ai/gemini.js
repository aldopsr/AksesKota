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

// Kunci yang terakhir berhasil. Bertahan selama instance serverless-nya hidup, jadi
// permintaan berikutnya tidak menabrak lagi kunci yang sudah diketahui habis.
let mulai = 0;

export async function generate(body) {
  const kunci = daftarKunci();
  if (!kunci.length) throw new HttpError(503, 'Asisten AI belum diaktifkan di server.', { fallback: true });

  const base = process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  let galatTerakhir = null;

  for (let n = 0; n < kunci.length; n += 1) {
    const i = (mulai + n) % kunci.length;
    let res;
    try {
      res = await fetch(`${base}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': kunci[i] },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      // Jaringan putus bukan salah kuncinya — kunci lain akan gagal dengan cara sama.
      console.error('[gemini] gagal terhubung:', e.name);
      throw new HttpError(503, 'Asisten AI tidak dapat dihubungi saat ini.', { fallback: true });
    }

    if (res.ok) {
      mulai = i; // kunci ini sehat; mulai dari sini lain kali
      return res.json();
    }

    // Nomor urutnya, bukan kuncinya: log bisa menunjukkan kunci ke berapa yang habis
    // tanpa pernah menuliskan satu pun karakter rahasianya.
    console.error(`[gemini] kunci #${i + 1}/${kunci.length} status`, res.status); // jangan log body/kunci
    galatTerakhir = res.status;
    if (!COBA_KUNCI_LAIN.has(res.status)) break;
  }

  // Kode status ikut dikirim ke klien, dan sebabnya pahit: di Vercel log runtime tidak
  // selalu bisa dibaca, jadi "asisten sedang sibuk" adalah jalan buntu — tidak ada cara
  // membedakan kunci yang salah (403), model yang tidak ada (404), dan kuota habis (429)
  // tanpa menebak. Kode statusnya bukan rahasia; isi body-nya tidak pernah dikirim
  // karena di situlah kunci bisa terpantul kembali.
  //
  // Sampai di sini berarti SEMUA kunci sudah dicoba. 429 dipisah pesannya: itu
  // satu-satunya yang akan dialami pengguna biasa, dan "coba lagi sebentar lagi" di
  // situ menyesatkan — kuota harian tidak pulih dalam hitungan menit.
  const pesan = galatTerakhir === 429
    ? 'Kuota asisten AI hari ini sudah habis. Pencarian dan peta tetap bisa dipakai.'
    : 'Asisten AI sedang sibuk. Coba lagi sebentar lagi.';
  throw new HttpError(503, pesan, { fallback: true, upstream: galatTerakhir });
}
