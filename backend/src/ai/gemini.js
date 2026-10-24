// Klien tipis untuk Gemini generateContent (REST). Kunci API hanya di server dan dikirim lewat header.
import { HttpError } from '../http.js';

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;

export async function generate(body) {
  const base = process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  let res;
  try {
    res = await fetch(`${base}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    console.error('[gemini] gagal terhubung:', e.name);
    throw new HttpError(503, 'Asisten AI tidak dapat dihubungi saat ini.', { fallback: true });
  }
  if (!res.ok) {
    console.error('[gemini] status', res.status); // jangan log body/kunci
    // Kode status ikut dikirim ke klien, dan sebabnya pahit: di Vercel log runtime
    // tidak selalu bisa dibaca, jadi "asisten sedang sibuk" adalah jalan buntu — tidak
    // ada cara membedakan kunci yang salah (403), model yang tidak ada (404), dan kuota
    // habis (429) tanpa menebak. Kode statusnya bukan rahasia; isi body-nya tidak
    // pernah dikirim karena di situlah kunci bisa terpantul kembali.
    //
    // 429 dipisah pesannya: itu satu-satunya yang akan terjadi pada pengguna biasa,
    // dan "coba lagi sebentar lagi" di situ justru menyesatkan — kuota harian tidak
    // pulih dalam hitungan menit.
    const pesan = res.status === 429
      ? 'Kuota asisten AI hari ini sudah habis. Pencarian dan peta tetap bisa dipakai.'
      : 'Asisten AI sedang sibuk. Coba lagi sebentar lagi.';
    throw new HttpError(503, pesan, { fallback: true, upstream: res.status });
  }
  return res.json();
}
