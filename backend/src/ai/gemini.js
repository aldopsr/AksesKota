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
    throw new HttpError(503, 'Asisten AI sedang sibuk. Coba lagi sebentar lagi.', { fallback: true });
  }
  return res.json();
}
