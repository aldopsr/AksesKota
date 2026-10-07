// npm run db:reset -> jalankan schema.sql + seed.sql, lalu pastikan ada akun admin.
// Idempotent: aman dijalankan berulang, tidak menghapus data yang sudah ada.
import { readFileSync } from 'node:fs';
import { pool } from '../src/db.js';
import bcrypt from 'bcryptjs';

const sql = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

const ADMIN = { email: 'admin@akseskota.id', password: 'admin12345', name: 'Admin AksesKota' };

await pool.query(sql('./schema.sql'));
console.log('schema ok');

await pool.query(sql('./seed.sql'));
console.log('seed ok');

await pool.query(
  `insert into users (email, password_hash, name, role) values ($1,$2,$3,'admin')
   on conflict (email) do update set role = 'admin'`,
  [ADMIN.email, await bcrypt.hash(ADMIN.password, 10), ADMIN.name],
);
console.log(`admin ok -> ${ADMIN.email} / ${ADMIN.password}`);

const { rows } = await pool.query(`
  select (select count(*) from facilities) facilities,
         (select count(*) from accessibility_facilities where status <> 'unknown') attr_terisi,
         (select count(distinct facility_id) from accessibility_facilities where status <> 'unknown') fasilitas_berdata`);
console.table(rows);

await pool.end();
