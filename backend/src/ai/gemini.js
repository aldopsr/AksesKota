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
 * Urutannya hasil pengukuran empat kunci nyata dari akun berbeda (24 Okt 2026):
 *
 *                            kunci1  kunci2  kunci3  kunci4
 *   gemini-3.5-flash           ok      ok      ok      ok     <- jalan di SEMUA akun
 *   gemini-flash-lite-latest   ok      ok      ok      ok     <- jalan di semua akun
 *   gemini-2.5-flash           ok     429     404     404     <- hanya akun lama
 *   gemini-2.5-flash-lite     404     404     404     404     <- dibuang
 *   gemini-flash-latest      timeout timeout timeout  503     <- dibuang
 *
 * Yang paling luas didahulukan supaya tidak ada ketukan sia-sia: menaruh 2.5-flash di
 * depan membuat tiga dari empat kunci membuang satu panggilan 404 lebih dulu. Ia tetap
 * dipertahankan di urutan ketiga karena kuota dihitung PER MODEL — pada kunci yang
 * memilikinya, ia menambah jatah, bukan menggantikan.
 *
 * Harga menebak murah (404 kembali ~300 ms) sedangkan harga salah tebak mahal: asisten
 * mati total di depan juri. Pasangan yang berhasil diingat, jadi ketukan sia-sia paling
 * banyak terjadi sekali per cold start.
 */
const MODEL_BAWAAN = ['gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
const daftarModel = () => {
  const isi = (process.env.GEMINI_MODEL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // KOSONG = pakai bawaan, bukan "tidak ada model".
  //
  // `?? bawaan` saja tidak cukup: variabel yang ADA tapi isinya kosong bukan nullish,
  // jadi ia lolos dan menghasilkan daftar nol panjang — lalu perulangannya tidak pernah
  // berjalan sekali pun dan asisten membalas 503 tanpa pernah menyentuh Google. Itu
  // bukan kasus teoretis: mengosongkan GEMINI_MODEL adalah cara yang kami sarankan
  // sendiri untuk "kembali ke bawaan", dan di Vercel variabel kosong juga biasa.
  return isi.length ? isi : MODEL_BAWAAN;
};

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
