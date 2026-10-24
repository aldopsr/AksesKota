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
  const m = req.url.match(/models\/([^:]+):/)[1];
  dipanggil.push(`${k}|${m}`);
  res.setHeader('content-type', 'application/json');
  // Jawaban bisa dipatok per pasangan "kunci|model", atau per kunci saja.
  res.statusCode = jawaban.get(`${k}|${m}`) ?? jawaban.get(k) ?? 200;
  res.end(res.statusCode === 200 ? JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok ' + k }] } }] }) : '{}');
});
await new Promise((r) => srv.listen(4997, r));
process.env.GEMINI_API_BASE = 'http://localhost:4997';

const { generate, geminiEnabled } = await import('../src/ai/gemini.js');
const pakai = (...k) => { process.env.GEMINI_API_KEY = k.join(','); };
// Satu model saja, kecuali kasus yang memang menguji cadangan model.
process.env.GEMINI_MODEL = 'm1';
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
assert.deepEqual(dipanggil, ['k2|m1'], 'kunci yang sudah habis seharusnya tidak dicoba lagi');

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

// 6. 404 IKUT memicu giliran. Google memakai 404 yang sama untuk "akun ini tidak boleh
//    memakai model tersebut", jadi akun lain masih berpeluang — ini kasus nyata: satu
//    kunci baru membalas 404 sementara kunci lama di daftar yang sama berfungsi.
pakai('model404', 'k4');
jawaban.set('model404', 404);
assert.equal(teks(await generate({})), 'ok k4');

// 6b. Kalau SEMUA kunci membalas 404 (nama model yang memang keliru), kodenya tetap
//     dilaporkan apa adanya supaya sebabnya bisa dibedakan dari kuota habis.
pakai('model404', 'model404b');
jawaban.set('model404b', 404);
const g404 = await generate({}).catch((e) => e);
assert.equal(g404.extra.upstream, 404);
assert.match(g404.message, /sedang sibuk/);

// 6c. Model cadangan: kunci yang sama, model pertama 404, model kedua jalan. Ini kasus
//     akun baru — gemini-2.5-flash ditolak untuknya, yang lebih ringan diterima.
process.env.GEMINI_MODEL = 'mBaru,mLama';
pakai('kbaru');
jawaban.set('kbaru|mBaru', 404);
assert.equal(teks(await generate({})), 'ok kbaru');

// 6d. Model dicoba habis dulu pada satu kunci sebelum pindah kunci: kuota dihitung per
//     model per akun, jadi kunci yang satu modelnya habis bisa punya sisa di model lain.
//     Disetel ulang ke pasangan pertama dulu lewat satu panggilan yang pasti berhasil,
//     karena "ingat yang sehat" dari kasus sebelumnya membuat titik mulainya bergeser.
process.env.GEMINI_MODEL = 'mLama';
pakai('kA');
assert.equal(teks(await generate({})), 'ok kA');
process.env.GEMINI_MODEL = 'mBaru,mLama';
pakai('kA', 'kB');
jawaban.set('kA|mBaru', 429);
dipanggil.length = 0;
assert.equal(teks(await generate({})), 'ok kA');
assert.deepEqual(dipanggil, ['kA|mBaru', 'kA|mLama'], 'model kedua pada kunci yang sama harus dicoba sebelum pindah kunci');
process.env.GEMINI_MODEL = 'm1';

// 6e. GEMINI_MODEL yang ADA tapi kosong harus jatuh ke daftar bawaan, bukan jadi
//     "tidak ada model" yang membuat perulangannya tidak berjalan sama sekali.
process.env.GEMINI_MODEL = '';
pakai('kKosong');
assert.equal(teks(await generate({})), 'ok kKosong');
// Model MANA yang dipakai tergantung titik mulai yang diingat dari kasus sebelumnya;
// yang diuji di sini cuma satu: daftarnya tidak kosong, jadi salah satu bawaan terpakai.
assert.ok(
  ['gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash'].some((m) => dipanggil.at(-1).endsWith('|' + m)),
  'harus memakai salah satu model bawaan, bukan daftar kosong',
);
process.env.GEMINI_MODEL = 'm1';

// 7. tanpa kunci sama sekali -> ditolak sebelum menyentuh jaringan
pakai('');
assert.equal(geminiEnabled(), false);
assert.equal((await generate({}).catch((e) => e)).status, 503);

srv.close();
console.log('OK — giliran kunci & model Gemini: lewati yang habis/ditolak/404, ingat yang sehat');
