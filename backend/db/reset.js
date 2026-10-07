// npm run db:reset           -> jalankan schema.sql + seed.sql, pastikan ada akun admin
// npm run db:reset -- --fresh -> HAPUS semua tabel AksesKota lebih dulu, lalu bangun ulang
//
// --fresh diperlukan sekali saat pindah ke Supabase Auth (v2): id pengguna berubah dari
// integer ke uuid, dan 8 foreign key ikut berubah. Tidak ada jalur alter yang lebih murah
// daripada bangun ulang, karena data fasilitas bisa diisi lagi lewat npm run import:osm.
import { readFileSync } from 'node:fs';
import { pool } from '../src/db.js';
import { sbUrl, sbServiceKey } from '../src/supabase.js';

const fresh = process.argv.includes('--fresh');
const sql = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

const ADMIN = { email: 'admin@akseskota.id', password: 'admin12345' };

if (fresh) {
  // Urutan tidak penting karena cascade; pedestrian_ways & facilities ikut terhapus,
  // keduanya bisa diisi ulang dari OSM.
  await pool.query(`drop table if exists
    ai_usage, login_attempts, reports, reviews, contributions, facility_photos,
    accessibility_profiles, accessibility_facilities, pedestrian_ways,
    facilities, categories, accessibility_attributes, profiles, users cascade`);
  console.log('--fresh: tabel lama dihapus');
}

await pool.query(sql('./schema.sql'));
console.log('schema ok');

await pool.query(sql('./seed.sql'));
console.log('seed ok');

// --- Akun admin lewat Supabase Auth -------------------------------------------------
// Password TIDAK lagi disimpan di database kita. Yang kita simpan hanya role di `profiles`.
const base = sbUrl();
const service = sbServiceKey();

if (!base || !service) {
  console.warn('SUPABASE_URL / SUPABASE_SERVICE_KEY kosong — akun admin dilewati.');
} else {
  const adminApi = (path, init = {}) =>
    fetch(`${base}/auth/v1/admin/${path}`, {
      ...init,
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    });

  let id;
  const buat = await adminApi('users', {
    method: 'POST',
    body: JSON.stringify({ ...ADMIN, email_confirm: true }),
  });

  if (buat.ok) {
    id = (await buat.json()).id;
    console.log(`admin dibuat -> ${ADMIN.email} / ${ADMIN.password}`);
  } else {
    // Sudah ada dari run sebelumnya: cari id-nya, jangan buat ulang.
    const daftar = await adminApi('users?per_page=200');
    if (!daftar.ok) throw new Error(`Supabase admin API ${daftar.status}: ${(await daftar.text()).slice(0, 200)}`);
    id = (await daftar.json()).users?.find((u) => u.email === ADMIN.email)?.id;
    if (!id) throw new Error(`Gagal membuat admin: ${(await buat.text()).slice(0, 200)}`);
    console.log(`admin sudah ada -> ${ADMIN.email}`);
  }

  await pool.query(
    `insert into profiles (id, display_name, role) values ($1, 'Admin AksesKota', 'admin')
     on conflict (id) do update set role = 'admin'`,
    [id],
  );
  console.log('role admin ok');
}

const { rows } = await pool.query(`
  select (select count(*) from facilities)::int fasilitas,
         (select count(distinct facility_id) from accessibility_facilities where status <> 'unknown')::int berdata,
         (select count(*) from profiles)::int profil`);
console.table(rows);

await pool.end();
