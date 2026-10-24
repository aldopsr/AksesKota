/**
 * Periksa tiap kunci Gemini di .env: model apa saja yang benar-benar bisa dipakainya.
 *
 * Dibuat karena pertanyaan "kenapa kunci baru tidak jalan" tidak bisa dijawab dengan
 * menebak. Ketersediaan model berbeda per akun dan kuota dihitung per model, jadi yang
 * dibutuhkan adalah matriks kunci × model, bukan satu panggilan.
 *
 * Isi kuncinya TIDAK PERNAH dicetak — hanya nomor urutnya.
 *
 *   cd backend && npm run cek:gemini
 */
const kunci = (process.env.GEMINI_API_KEY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!kunci.length) {
  console.error('GEMINI_API_KEY kosong di .env. Isi dulu (boleh beberapa, dipisah koma).');
  process.exit(1);
}

// Model yang ditanyakan: daftar bawaan aplikasi, ditambah beberapa kandidat lain supaya
// kelihatan kalau sebuah akun ternyata hanya punya yang lebih baru.
const MODEL = [
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
];

const ARTI = {
  200: 'BISA',
  400: 'kunci tidak sah',
  403: 'ditolak',
  404: 'model tidak tersedia untuk akun ini',
  429: 'kuota habis (akun sah, model sah)',
};

console.log(`Memeriksa ${kunci.length} kunci × ${MODEL.length} model. Isi kunci tidak dicetak.\n`);

for (const [i, k] of kunci.entries()) {
  console.log(`kunci #${i + 1}`);
  // Daftar model yang diakui milik kunci ini. Gratis, tidak memotong kuota generateContent.
  let punya = null;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': k },
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) {
      const j = await r.json();
      punya = new Set((j.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => m.name.replace('models/', '')));
    } else {
      console.log(`  daftar model: GAGAL (${r.status}) — kuncinya sendiri bermasalah`);
    }
  } catch (e) {
    console.log(`  daftar model: GAGAL (${e.name})`);
  }

  for (const m of MODEL) {
    if (punya && !punya.has(m)) { console.log(`  ${m.padEnd(26)} -   tidak ada di daftar akun ini`); continue; }
    const t = Date.now();
    let s;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'halo' }] }] }),
        signal: AbortSignal.timeout(25_000),
      });
      s = r.status;
    } catch (e) {
      s = e.name;
    }
    console.log(`  ${m.padEnd(26)} ${String(s).padEnd(5)} ${ARTI[s] ?? ''} (${Date.now() - t} ms)`);
  }
  console.log('');
}

console.log('Pakai yang berstatus BISA. Taruh di GEMINI_API_KEY (kunci) dan GEMINI_MODEL (model),');
console.log('keduanya boleh berisi daftar dipisah koma.');
