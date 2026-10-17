// npm run test:api — uji alur API end-to-end terhadap server sungguhan + database sungguhan.
// Butuh DATABASE_URL yang sudah di-`npm run db:reset`. Mapbox diganti server tiruan lokal.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createGeminiStub } from './gemini-stub.js';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}/api`;

const mapbox = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ routes: [{ distance: 1200, duration: 900, geometry: { type: 'LineString', coordinates: [[106.79, -6.595], [106.80, -6.60]] } }] }));
}).listen(4999);

const gemini = createGeminiStub().listen(4998);

const server = spawn('node', ['--env-file-if-exists=.env', 'src/index.js'], {
  env: { ...process.env, PORT, PUBLIC_URL: `http://127.0.0.1:${PORT}`, MAPBOX_TOKEN: 'test-token', MAPBOX_API_BASE: 'http://127.0.0.1:4999', UPLOAD_DIR: 'uploads-test', SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '', GEMINI_API_KEY: 'test-key', GEMINI_API_BASE: 'http://127.0.0.1:4998', AI_DAILY_LIMIT: '6' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => server.stdout.on('data', (d) => d.toString().includes('AksesKota API') && r()));

const call = async (path, { method = 'GET', body, token, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

// PNG 1x1 valid
// Nama unik per jalanan, sama alasannya dengan email uji di bawah: tes ini membuat
// fasilitas lalu menyetujuinya, jadi kalau namanya tetap, jalanan kedua akan menemukan
// sisa jalanan pertama dan assertion "belum approve" jatuh.
const NAMA_UJI = `Klinik Uji Aksesibel ${Date.now()}`;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const contribution = (payload, photos = []) => {
  const fd = new FormData();
  fd.append('payload', JSON.stringify(payload));
  photos.forEach((b, i) => fd.append('photos', new Blob([b], { type: 'image/png' }), `f${i}.png`));
  return fd;
};

try {
  const email = `uji${Date.now()}@mail.id`;

  // --- auth ---
  assert.equal((await call('/health')).status, 200);
  const reg = await call('/auth/register', { method: 'POST', body: { email, password: 'rahasia123', name: 'Penguji' } });
  assert.equal(reg.status, 201);
  const token = reg.json.token;
  assert.equal((await call('/auth/register', { method: 'POST', body: { email, password: 'rahasia123', name: 'X' } })).status, 409);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email, password: 'salah-salah' } })).status, 401);
  assert.equal((await call('/auth/me', { token })).json.email, email);
  assert.equal((await call('/me/accessibility-profile')).status, 401, 'guest tidak boleh');

  // --- profil dipakai otomatis ---
  const put = await call('/me/accessibility-profile', { method: 'PUT', token, body: { attributes: ['ramp', 'lift', 'ngawur'] } });
  assert.deepEqual(put.json.attributes, ['ramp', 'lift'], 'kode tak dikenal harus dibuang');
  const list = await call('/facilities', { token });
  assert.deepEqual(list.json.needs.sort(), ['lift', 'ramp']);
  assert.deepEqual((await call('/facilities?needs=none', { token })).json.needs, []);

  // --- kontribusi: usulan baru ---
  const baru = { facility: { name: NAMA_UJI, category: 'kesehatan', address: 'Jl. Uji No. 1, Bogor', description: 'x', lat: -6.59, lon: 106.8 },
    attributes: [{ code: 'ramp', status: 'available', notes: 'landai' }, { code: 'braille', status: 'not_available' }], note: 'Saya cek langsung kemarin.' };
  assert.equal((await call('/contributions', { method: 'POST', token, form: contribution(baru) })).status, 422, 'atribut utama tanpa foto harus ditolak');
  assert.equal((await call('/contributions', { method: 'POST', form: contribution(baru, [PNG]) })).status, 401);
  const bad = await call('/contributions', { method: 'POST', token, form: contribution(baru, [Buffer.from('bukan gambar')]) });
  assert.equal(bad.status, 400, 'file non-gambar ditolak');
  const c1 = await call('/contributions', { method: 'POST', token, form: contribution(baru, [PNG]) });
  assert.equal(c1.status, 201);
  assert.ok(c1.json.payload.photos[0].includes('/uploads/'));
  assert.equal(c1.json.payload.note, 'Saya cek langsung kemarin.', 'catatan kontributor tersimpan');
  assert.equal((await fetch(c1.json.payload.photos[0])).status, 200, 'foto harus bisa diakses');
  assert.equal((await call(`/facilities?q=${encodeURIComponent(NAMA_UJI)}`)).json.count, 0, 'belum approve: tidak boleh tampil');

  // --- admin ---
  assert.equal((await call('/admin/contributions', { token })).status, 403);
  const adm = (await call('/auth/login', { method: 'POST', body: { email: 'admin@akseskota.id', password: 'admin12345' } })).json.token;
  const pending = await call('/admin/contributions?status=pending', { token: adm });
  assert.ok(pending.json.some((c) => c.id === c1.json.id));
  assert.equal((await call(`/admin/contributions/${c1.json.id}`, { method: 'PATCH', token: adm, body: { status: 'rejected' } })).status, 422);
  const ok = await call(`/admin/contributions/${c1.json.id}`, { method: 'PATCH', token: adm, body: { status: 'approved', review_note: 'ok' } });
  assert.equal(ok.json.status, 'approved');
  assert.equal((await call(`/admin/contributions/${c1.json.id}`, { method: 'PATCH', token: adm, body: { status: 'approved' } })).status, 409);
  const found = await call(`/facilities?q=${encodeURIComponent(NAMA_UJI)}`);
  assert.equal(found.json.count, 1);
  const fid = found.json.results[0].id;
  const detail = (await call(`/facilities/${fid}?needs=ramp,braille`)).json;
  assert.equal(detail.attributes.length, 10);
  assert.equal(detail.attributes.find((a) => a.code === 'ramp').status, 'available');
  assert.equal(detail.photos.length, 1);
  assert.equal(detail.match_pct, 50);

  // --- kontribusi: ubah atribut fasilitas yang ada ---
  const upd = await call('/contributions', { method: 'POST', token, form: contribution({ facility_id: fid, attributes: [{ code: 'lift', status: 'available' }] }, [PNG]) });
  assert.equal(upd.status, 201);
  const prev = (await call(`/admin/contributions/${upd.json.id}`, { token: adm })).json;
  assert.equal(prev.previous.attributes[0].status, 'unknown', 'nilai lama harus ikut tampil untuk diff');
  await call(`/admin/contributions/${upd.json.id}`, { method: 'PATCH', token: adm, body: { status: 'approved' } });
  assert.equal((await call(`/facilities/${fid}`)).json.attributes.find((a) => a.code === 'lift').status, 'available');
  assert.equal((await call('/me/contributions', { token })).json.length, 2);

  // --- review & report ---
  assert.equal((await call(`/facilities/${fid}/reviews`, { method: 'POST', token, body: { rating: 4, content: 'Bagus' } })).status, 201);
  await call(`/facilities/${fid}/reviews`, { method: 'POST', token, body: { rating: 5, content: 'Sangat bagus' } }); // upsert
  const d2 = (await call(`/facilities/${fid}`)).json;
  assert.equal(d2.rating_count, 1);
  assert.equal(d2.rating_avg, 5);
  const rep = await call(`/facilities/${fid}/reports`, { method: 'POST', token, body: { report_type: 'data_salah', description: 'Data ramp sudah tidak sesuai.' } });
  assert.equal(rep.status, 201);
  assert.equal((await call(`/facilities/${fid}/reports`, { method: 'POST', token, body: { report_type: 'ngawur', description: 'x'.repeat(12) } })).status, 400);
  const reps = (await call('/admin/reports', { token: adm })).json;
  assert.equal(reps.find((r) => r.id === rep.json.id).status, 'open');
  assert.equal((await call(`/admin/reports/${rep.json.id}`, { method: 'PATCH', token: adm, body: { status: 'resolved' } })).json.status, 'resolved');
  const rv = (await call('/admin/reviews', { token: adm })).json;
  assert.equal((await call(`/admin/reviews/${rv[0].id}`, { method: 'DELETE', token: adm })).status, 204);

  // --- rute ---
  const route = await call(`/routes/walking?from=106.79,-6.595&to=106.80,-6.60&facility_id=${fid}`);
  assert.equal(route.status, 200);
  assert.equal(route.json.distance_m, 1200);
  assert.ok(route.json.accessibility_score !== null && route.json.route_score > 0);
  assert.equal((await call('/routes/walking?from=abc&to=1,2')).status, 400);

  // --- asisten AI (Gemini tiruan) ---
  const chat = (message, extra = {}, tk = token) => call('/ai/chat', { method: 'POST', token: tk, body: { message, ...extra } });
  assert.equal((await call('/ai/status')).json.enabled, true);
  assert.equal((await chat('halo', {}, null)).status, 401, 'AI wajib login');
  assert.equal((await chat('x'.repeat(301))).status, 400);
  const sBefore = (await call('/ai/status', { token })).json.used_today;
  const hi = await chat('halo');
  assert.equal(hi.status, 200);
  assert.match(hi.json.reply, /asisten AksesKota/);
  assert.equal(hi.json.usage.used, sBefore + 1);
  const origin = { lat: -6.595, lon: 106.79 };
  const ru = await chat('tolong buatkan rute ke stasiun', { origin });
  assert.equal(ru.json.actions.find((a) => a.type === 'route').facility_id, ru.json.facilities[0].id);
  assert.match(ru.json.reply, /Rute ke Stasiun .* 15 menit/);
  assert.ok(ru.json.actions.some((a) => a.type === 'show_results'));
  const noLoc = await chat('buatkan rute ke stasiun');
  assert.ok(noLoc.json.actions.some((a) => a.type === 'route'), 'tanpa lokasi: aksi rute tetap dikirim, UI meminta izin lokasi');
  assert.match(noLoc.json.reply, /izinkan lokasi/);
  const rek = await chat('beri rekomendasi rumah sakit yang cocok', { origin });
  assert.equal(rek.json.recommended_ids.length, 2, 'ID karangan (424242) harus dibuang');
  assert.equal(rek.json.facilities[0].id, rek.json.recommended_ids[0], 'rekomendasi tampil paling atas');
  assert.deepEqual(rek.json.applied.needs.sort(), ['lift', 'ramp']);
  assert.equal((await chat('ngawur')).json.recommended_ids.length, 0, 'ID yang tak pernah muncul dari DB ditolak');
  const used = (await call('/ai/status', { token })).json.used_today;
  const gdown = await chat('error500');
  assert.equal(gdown.status, 503);
  assert.equal(gdown.json.fallback, true, 'frontend harus tahu untuk beralih ke mode dasar');
  assert.equal((await call('/ai/status', { token })).json.used_today, used, 'jatah dikembalikan bila Gemini gagal');
  assert.equal((await chat('halo lagi')).status, 200); // jatah ke-6
  assert.equal((await chat('halo ketujuh')).status, 429, 'kuota harian ditegakkan');

  console.log('OK — semua alur API lolos (auth, profil, kontribusi, admin, review, report, rute, asisten AI)');
} finally {
  server.kill();
  mapbox.close();
  gemini.close();

  // Hapus jejak: fasilitas uji beserta kontribusi/review/laporan yang menggantung padanya.
  // Tanpa ini database ikut kotor setiap kali tes dijalankan.
  // contributions.submitted_by tidak cascade, jadi kontribusi dihapus sebelum akunnya.
  const { pool } = await import('../src/db.js');
  const uji = "select id from users where email like 'uji%@mail.id'";
  await pool.query(`delete from contributions where submitted_by in (${uji}) or reviewed_by in (${uji})`);
  await pool.query('delete from facilities where name = $1', [NAMA_UJI]);
  await pool.query(`delete from users where id in (${uji})`);
  await pool.end();
}
