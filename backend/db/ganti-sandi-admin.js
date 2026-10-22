/**
 * Ganti kata sandi akun admin.
 *
 * Dibuat setelah menyadari satu hal yang tidak enak: kata sandi admin awal ditulis di
 * README dan di reset.js, dan basis data pengembangan ini ADALAH basis data produksi.
 * Artinya siapa pun yang membaca repositori ini bisa masuk sebagai admin dan menyetujui
 * atau menolak kontribusi siapa saja. Berkas ini ada supaya menggantinya tidak perlu
 * menulis SQL tangan — dan supaya bisa diulang kapan pun kata sandinya perlu dirotasi.
 *
 * Kata sandinya DIKETIK saat dijalankan, tidak pernah tersimpan di berkas mana pun:
 *   node --env-file=.env db/ganti-sandi-admin.js admin@akseskota.id
 */
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { q, pool } from '../src/db.js';

const email = process.argv[2] ?? 'admin@akseskota.id';
const rl = createInterface({ input: process.stdin, output: process.stdout });
const sandi = await rl.question(`Kata sandi baru untuk ${email}: `);
rl.close();

if (sandi.length < 10) {
  console.error('Terlalu pendek. Minimal 10 karakter.');
  process.exit(1);
}

const { rowCount } = await q('update users set password_hash = $2 where email = $1', [email, await bcrypt.hash(sandi, 10)]);
console.log(rowCount ? `Selesai. Kata sandi ${email} sudah diganti.` : `Akun ${email} tidak ditemukan.`);
await pool.end();
