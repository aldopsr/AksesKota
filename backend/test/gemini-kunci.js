// Uji giliran kunci Gemini: kunci yang kehabisan kuota dilewati, yang sehat dipakai.
// Jalankan: npm run test:kunci
import assert from 'node:assert/strict';
import http from 'node:http';

// Server tiruan: tiap kunci punya jawaban sendiri, dan tiap panggilan dicatat supaya
// bisa dipastikan kunci yang sudah diketahui habis TIDAK ditabrak berulang kali.
const jawaban = new Map();
const dipanggil = [];
const srv = http.createServer(async (req, res) => {
  for await (const _ of req) { /* buang body */ }
  const k = req.headers['x-goog-api-key'];
  dipanggil.push(k);
  res.setHeader('content-type', 'application/json');
  res.statusCode = jawaban.get(k) ?? 200;
  res.end(res.statusCode === 200 ? JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok ' + k }] } }] }) : '{}');
});
await new Promise((r) => srv.listen(4997, r));
process.env.GEMINI_API_BASE = 'http://localhost:4997';

const { generate, geminiEnabled } = await import('../src/ai/gemini.js');
const pakai = (...k) => { process.env.GEMINI_API_KEY = k.join(','); };
const teks = (hasil) => hasil.candidates[0].content.parts[0].text;

// 1. satu kunci sehat
pakai('k1');
assert.equal(geminiEnabled(), true);
assert.equal(teks(await generate({})), 'ok k1');

// 2. kunci pertama kehabisan kuota -> pindah ke kedua, tanpa galat ke pemanggil
pakai('habis', 'k2');
jawaban.set('habis', 429);
assert.equal(teks(await generate({})), 'ok k2');

// 3. kunci sehat diingat: panggilan berikutnya tidak menabrak yang habis lagi
dipanggil.length = 0;
assert.equal(teks(await generate({})), 'ok k2');
assert.deepEqual(dipanggil, ['k2'], 'kunci yang sudah habis seharusnya tidak dicoba lagi');

// 4. kunci tidak sah (400) dan ditolak (403) juga dilewati
pakai('tidaksah', 'ditolak', 'k3');
jawaban.set('tidaksah', 400);
jawaban.set('ditolak', 403);
assert.equal(teks(await generate({})), 'ok k3');

// 5. SEMUA kunci habis -> 503 dengan pesan kuota dan status asli Google
pakai('habis', 'habis2');
jawaban.set('habis2', 429);
const galat = await generate({}).catch((e) => e);
assert.equal(galat.status, 503);
assert.equal(galat.extra.upstream, 429);
assert.match(galat.message, /Kuota asisten AI hari ini sudah habis/);

// 6. 404 (nama model salah) TIDAK memicu giliran: sama untuk semua kunci, jadi
//    mengulanginya hanya memperlambat kegagalan yang sudah pasti.
pakai('model404', 'k4');
jawaban.set('model404', 404);
dipanggil.length = 0;
const g404 = await generate({}).catch((e) => e);
assert.equal(g404.extra.upstream, 404);
assert.deepEqual(dipanggil, ['model404'], '404 seharusnya berhenti di kunci pertama');

// 7. tanpa kunci sama sekali -> ditolak sebelum menyentuh jaringan
pakai('');
assert.equal(geminiEnabled(), false);
assert.equal((await generate({}).catch((e) => e)).status, 503);

srv.close();
console.log('OK — giliran kunci Gemini: lewati yang habis, ingat yang sehat, 404 tidak diulang');
