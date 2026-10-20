// Isi antrean verifikasi dengan kontribusi contoh untuk demo dan penjurian.
//   node --env-file-if-exists=.env db/seed-demo.js
//   node --env-file-if-exists=.env db/seed-demo.js --bersihkan
//
// Kenapa perlu: seluruh alur kontribusi sudah jalan, tetapi database hasil rebuild
// skema kosong. Dasbor admin yang menampilkan "Antrean kosong" saat penjurian
// terbaca sebagai fitur yang belum jadi, padahal kodenya benar.
//
// Yang TIDAK dilakukan skrip ini: melampirkan foto bukti. Menempelkan gambar entah
// dari mana pada fasilitas yang benar-benar ada sama dengan mengarang bukti, dan
// nilai jual AksesKota justru data yang bisa dipercaya. Layar verifikasi akan
// menulis "Tidak ada foto" — itu memang keadaan sebenarnya.

import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const bersihkan = process.argv.includes('--bersihkan');

// Semua baris demo dikenali dari domain email ini, jadi --bersihkan bisa menghapusnya
// tanpa menyentuh data sungguhan. Jangan dipakai untuk apa pun selain demo.
const DOMAIN = 'demo.akseskota.test';
// Kata sandi akun demo. Sengaja ditulis di berkas ini, bukan dikirim lewat percakapan:
// berkas ini memang bagian dari repo dan akun-akun ini hanya ada di database demo.
const SANDI = 'demo-akseskota-2026';

const AKUN = [
  { email: `admin@${DOMAIN}`, name: 'Admin Demo', role: 'admin' },
  { email: `rina@${DOMAIN}`, name: 'Rina Pratiwi', role: 'user' },
  { email: `dimas@${DOMAIN}`, name: 'Dimas Haryo', role: 'user' },
  { email: `sari@${DOMAIN}`, name: 'Sari Oktaviani', role: 'user' },
];

// Usulan ditulis relatif terhadap fasilitas yang benar-benar ada di database, diambil
// saat skrip jalan — supaya tetap benar setelah impor OSM mana pun.
const USULAN = [
  {
    oleh: 'rina', jam: 122, status: 'pending',
    attributes: [
      { code: 'ramp', status: 'available', notes: 'Di pintu samping, kemiringannya landai.' },
      { code: 'accessible_toilet', status: 'not_available', notes: null },
    ],
    note: 'Saya ke sini Sabtu lalu. Ramp-nya baru, belum ada di data.',
  },
  {
    oleh: 'dimas', jam: 29, status: 'pending',
    attributes: [
      { code: 'lift', status: 'not_available', notes: 'Liftnya rusak sejak awal bulan.' },
      { code: 'handrail', status: 'available', notes: null },
    ],
    note: 'Datanya bilang ada lift, tapi sedang tidak berfungsi.',
  },
  {
    oleh: 'sari', jam: 3, status: 'pending',
    attributes: [
      { code: 'guiding_block', status: 'available', notes: 'Dari pintu masuk sampai loket.' },
      { code: 'braille', status: 'unknown', notes: null },
    ],
    note: null,
  },
  {
    oleh: 'dimas', jam: 200, status: 'approved', jamTinjau: 190,
    review_note: 'Sesuai dengan kondisi lapangan. Terima kasih.',
    attributes: [{ code: 'accessible_parking', status: 'available', notes: 'Dua petak dekat pintu utama.' }],
    note: null,
  },
  {
    oleh: 'rina', jam: 400, status: 'rejected', jamTinjau: 380,
    review_note: 'Belum bisa diverifikasi tanpa foto. Silakan kirim ulang dengan foto rampnya.',
    attributes: [{ code: 'ramp', status: 'available', notes: null }],
    note: 'Seingat saya ada ramp di belakang.',
  },
];

const jam = (h) => new Date(Date.now() - h * 3600_000).toISOString();

async function hapus() {
  // Kontribusi lebih dulu: foreign key-nya tidak cascade dari users.
  const { rowCount: k } = await pool.query(
    `delete from contributions where submitted_by in (select id from users where email like $1)
        or reviewed_by in (select id from users where email like $1)`,
    [`%@${DOMAIN}`],
  );
  const { rowCount: u } = await pool.query('delete from users where email like $1', [`%@${DOMAIN}`]);
  console.log(`dihapus: ${k} kontribusi, ${u} akun demo`);
}

if (bersihkan) {
  await hapus();
  await pool.end();
  process.exit(0);
}

// Dijalankan ulang tidak menumpuk: baris demo lama dibuang dulu.
await hapus();

const hash = await bcrypt.hash(SANDI, 10);
const idAkun = {};
for (const a of AKUN) {
  const { rows: [row] } = await pool.query(
    `insert into users (email, password_hash, name, role) values ($1,$2,$3,$4) returning id`,
    [a.email, hash, a.name, a.role],
  );
  idAkun[a.email.split('@')[0]] = row.id;
}
console.log(`${AKUN.length} akun demo dibuat (kata sandi ada di db/seed-demo.js)`);

const { rows: fasilitas } = await pool.query(
  `select f.id, f.name from facilities f
    order by (select count(*) from accessibility_facilities af
               where af.facility_id = f.id and af.status <> 'unknown') desc, f.id
    limit $1`,
  [USULAN.length],
);
if (fasilitas.length < USULAN.length) {
  console.error(`Database hanya punya ${fasilitas.length} fasilitas, butuh ${USULAN.length}. Jalankan npm run import:osm dulu.`);
  await pool.end();
  process.exit(1);
}

for (const [i, u] of USULAN.entries()) {
  const f = fasilitas[i];
  const payload = { facility_id: f.id, attributes: u.attributes };
  if (u.note) payload.note = u.note;
  await pool.query(
    `insert into contributions (facility_id, submitted_by, change_type, payload, status,
                                review_note, reviewed_by, reviewed_at, created_at)
     values ($1,$2,'update',$3,$4,$5,$6,$7,$8)`,
    [
      f.id, idAkun[u.oleh], payload, u.status, u.review_note ?? null,
      u.status === 'pending' ? null : idAkun.admin,
      u.status === 'pending' ? null : jam(u.jamTinjau),
      jam(u.jam),
    ],
  );
  console.log(`  ${u.status.padEnd(8)} ${f.name}`);
}

const { rows: [ringkas] } = await pool.query(
  `select count(*) filter (where status = 'pending')::int menunggu,
          count(*) filter (where status = 'approved')::int disetujui,
          count(*) filter (where status = 'rejected')::int ditolak
     from contributions`,
);
console.log('\nantrean sekarang:');
console.table([ringkas]);
await pool.end();
