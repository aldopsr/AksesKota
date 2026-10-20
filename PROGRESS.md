# AksesKota — Progress Backend

Catatan kerja. Diperbarui setiap akhir fase. Deadline PRD: **25 Okt 2026**.

## Keputusan teknis (terkunci 7 Okt 2026)

| Hal | Pilihan | Alasan |
|---|---|---|
| Database | **Supabase** (Postgres + PostGIS) | PostGIS sudah aktif, free tier cukup |
| Storage foto | **Supabase Storage** | menutup open decision #1 di PRD §37 |
| Data layer | **node-postgres (`pg`) + SQL murni** | query PostGIS jadi penghalang di ORM |
| Auth | **JWT sendiri** (bcryptjs + jsonwebtoken) | ~60 baris, frontend cuma kirim Bearer token |
| Speech-to-Text | **Web Speech API di browser** dulu | gratis, nol setup; endpoint Google STT disiapkan sebagai jalur kedua |
| Framework | **Express 5** | async error otomatis masuk error handler, tanpa wrapper per-route |
| Validasi input | **zod** | satu-satunya dependency "mewah"; ini trust boundary, bukan tempat berhemat |

## Status fase

- [x] **Fase 1 — Fondasi + Facilities (P0 no. 1–7)** · selesai 7 Okt 2026
- [x] **Fase 2 — Accessibility Profile + Crowdsourcing + Admin verifikasi** (P0 no. 8–10, P1 no. 1) · ditambahkan saat integrasi frontend, **perlu direview tim BE**
- [x] **Fase 3 — AI pipeline** (P0 no. 11–14): Gemini + function calling di atas data DB (`routes/ai.js`, `src/ai/*`), kuota harian di `ai_usage`, fallback ke mode dasar di frontend · ditambahkan saat integrasi, **perlu direview dan diuji dengan Gemini sungguhan**
- [x] **Fase 4 — Routing** (P0 no. 15, P1 no. 5): proxy Mapbox Directions + route scoring 70/30 · ditambahkan saat integrasi frontend
- [~] **Fase 5 — Review, Report, rate limit, deploy** (P1 no. 3–4): review, report, dan rate limit dasar sudah ada; deploy belum

---

## Fase 1 — selesai

### File yang dibuat

```
backend/
  package.json              deps + script dev/start/db:reset/test
  .env.example              contoh konfigurasi
  db/schema.sql             10 tabel, idempotent
  db/seed.sql               5 kategori, 10 atribut, 14 fasilitas Bogor
  db/reset.js               runner schema+seed, bikin akun admin
  src/db.js                 pool pg + helper q/one/many
  src/auth.js               register/login/me + middleware optionalAuth/requireAuth/requireAdmin
  src/match.js              label marker, freshness, resolve kebutuhan user
  src/routes/facilities.js  searchFacilities() + 4 endpoint
  src/index.js              app, CORS, error handler terpusat
  test/smoke.js             assert biasa, tanpa framework
```

### Endpoint siap pakai untuk frontend

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/health` | — | cek server hidup |
| POST | `/api/auth/register` | — | body: `{email, password, name}` → `{token, user}` |
| POST | `/api/auth/login` | — | body: `{email, password}` → `{token, user}` |
| GET | `/api/auth/me` | Bearer | profil akun |
| GET | `/api/facilities` | opsional | query: `q, category, needs, lat, lon, radius, limit` |
| GET | `/api/facilities/:id` | opsional | detail + 10 atribut + foto + review |
| GET | `/api/categories` | — | isi dropdown kategori |
| GET | `/api/attributes` | — | isi checkbox filter aksesibilitas |

Catatan untuk frontend:
- `needs` = CSV kode atribut, contoh `?needs=ramp,lift,accessible_toilet`.
- Kalau user login dan `needs` tidak dikirim, **profil aksesibilitasnya dipakai otomatis**. Kirim `?needs=none` untuk mematikannya satu kali pencarian.
- Tiap hasil membawa `match_pct`, `label` (Sangat Sesuai / Sebagian Sesuai / Kurang Sesuai / Data Terbatas), `color`, `distance_m`, `freshness`.
- `GET /api/facilities/:id` **selalu** mengembalikan 10 atribut lengkap; yang belum ada datanya berstatus `unknown`.

### Keputusan implementasi yang perlu diingat

1. **Sorting dilakukan di SQL**, bukan di JS — kalau diurut di JS, `LIMIT` memotong hasil sebelum diurutkan dan hasil terbaik bisa hilang.
2. **`accessibility_facilities` pakai primary key komposit** `(facility_id, attribute_code)`, menyimpang dari PRD §26 yang menuliskan kolom `id`. Alasannya satu fasilitas tidak boleh punya dua baris atribut yang sama — dijaga constraint DB, bukan app code.
3. **`unknown` dihitung eksplisit.** `match_pct` hanya menjumlah `status = 'available'`. Atribut yang bahkan belum punya baris di DB tetap dihitung sebagai unknown di `searchFacilities()`, bukan diabaikan.
4. **`ai_usage`** sudah ada di schema (kuota AI per user per hari). Pakai tabel, bukan counter di memori, supaya restart server tidak me-reset kuota.
5. **`searchFacilities()` di `routes/facilities.js` adalah satu-satunya jalur query fasilitas.** Fase 3 (AI) dan fase 4 (routing) **wajib** memakai fungsi ini, jangan tulis query baru — itu yang menjamin AI tidak bisa mengarang data (PRD §17.4 / AC-05).
6. **Ambang label marker dan `HARI_PERLU_VERIFIKASI_ULANG`** ada sebagai konstanta di `src/match.js`, siap ditala setelah lihat sebaran data nyata.

### Hutang yang sengaja ditinggalkan

| Apa | Kapan dibereskan |
|---|---|
| Baru 14 fasilitas, target PRD ~100 | fase tersendiri: script import Overpass API (OSM) + Open Data Kota Bogor |
| **Koordinat 14 fasilitas masih perkiraan** | verifikasi manual lewat OSM sebelum demo — ada di komentar `db/seed.sql` |
| Belum ada rate limit HTTP global | fase 5, bareng rate limit AI |
| Belum ada pagination (hanya `limit`) | kalau dataset lewat ~500 fasilitas |
| Refresh token | tidak perlu untuk MVP; token berlaku 30 hari |

---

## Cara jalanin (sekali setup)

1. Buat project di [supabase.com](https://supabase.com) → **Project Settings → Database → Connection string (URI)**.
2. `cd backend` lalu salin `.env.example` jadi `.env`, isi `DATABASE_URL` dan `JWT_SECRET`.
3. `npm install`
4. `npm run db:reset` — bikin tabel + seed + akun admin (`admin@akseskota.id` / `admin12345`)
5. `npm run dev` → cek `http://localhost:3000/api/health`
6. `npm test` — tanpa `DATABASE_URL` cuma tes logika; dengan `DATABASE_URL` ikut tes query match & sorting.

> PostGIS di Supabase: kalau `create extension postgis` ditolak, aktifkan dulu lewat
> dashboard **Database → Extensions → postgis**.


---

## Update integrasi frontend (backend)

Endpoint baru, semuanya aditif (file Fase 1 tidak diubah selain `src/index.js` untuk mounting + error handler):

| Method | Path | Akses | File |
|---|---|---|---|
| GET/PUT | `/api/me/accessibility-profile` | login | `routes/me.js` |
| GET | `/api/me/contributions` | login | `routes/me.js` |
| POST | `/api/contributions` (multipart: `payload` JSON + `photos` maks 3) | login | `routes/contributions.js` |
| POST | `/api/facilities/:id/reviews` (upsert 1 per user) | login | `routes/feedback.js` |
| POST | `/api/facilities/:id/reports` | login | `routes/feedback.js` |
| GET | `/api/admin/contributions[?status=]`, `/:id` (+ `previous` untuk diff) | admin | `routes/admin.js` |
| PATCH | `/api/admin/contributions/:id` `{status, review_note}` — approve menerapkan data dalam 1 transaksi | admin | `routes/admin.js` |
| GET/PATCH | `/api/admin/reports`, `/:id` | admin | `routes/admin.js` |
| GET/DELETE | `/api/admin/reviews`, `/:id` | admin | `routes/admin.js` |
| GET | `/api/routes/walking?from=lon,lat&to=lon,lat&facility_id=` | publik, 30/menit | `routes/routing.js` |

Pendukung: `src/http.js` (HttpError), `src/rateLimit.js`, `src/storage.js` (foto: Supabase Storage atau folder lokal `uploads/`, validasi magic bytes).
Aturan penting: foto wajib bila atribut utama (`is_core`) diisi non-`unknown` (FR-08); maks 3 foto @5 MB; maks 20 kontribusi per user per hari; data resmi baru berubah setelah admin approve.

Tes: `npm run test:api` (butuh DB yang sudah di-`db:reset`).

### Asisten AI (backend)
- `POST /api/ai/chat` `{ message, history[], origin:{lat,lon}, facility_id? }` -> `{ reply, facilities[], recommended_ids[], actions[], applied, used_profile, usage }`. Wajib login. Gagal -> 503 `{ fallback: true }`; kuota habis -> 429.
- `GET /api/ai/status` -> `{ enabled, daily_limit, used_today }`.
- Perubahan kecil di file lama: `searchFacilities` menerima parameter opsional `ids` (kompatibel mundur); `routing.js` mengekspor `fetchWalkingRoute`.
- Tes: `npm run test:api` memakai Gemini tiruan. Jalankan juga `node test/gemini-stub.js` bila ingin mencoba UI tanpa kunci sungguhan (set `GEMINI_API_KEY=apa-saja`, `GEMINI_API_BASE=http://127.0.0.1:4998`).

## Saran transportasi umum untuk jarak jauh (18 Okt 2026)

**Masalah.** Rute kami hanya jalan kaki. Untuk Bogor->Jakarta itu menghasilkan
"54 km, 10 jam 30 menit" yang ditampilkan seolah sebuah saran.

**Tahap 1 — fasilitas terdekat.** Di atas 3 km, tampilkan fasilitas transportasi
beraksesibilitas terdekat dari titik awal dan tujuan. Berguna, tapi belum menjawab
pertanyaan sebenarnya: "naik apa dari sini ke sana".

**Tahap 2 — lin sungguhan.** Relasi `route` di OpenStreetMap ternyata memuat urutan
pemberhentian: 32 dari 34 lin rel Jabodetabek terbaca lengkap, dengan warna resmi.
GTFS resmi Transjakarta/KAI Commuter tidak terbit sebagai umpan publik yang stabil,
dan kita memang hanya butuh daftar berhenti, bukan jadwal.

- `db/import-transit.js` (`npm run import:transit`) -> 250 lin, 5.443 pemberhentian,
  2.362 stasiun unik. KRL, MRT, LRT, Transjakarta; Jabodetabek + Bandung Raya.
- `src/transit.js` mencari lin yang berhenti dekat kedua titik. Langsung dulu;
  pencarian satu kali ganti (dicocokkan lewat NAMA pemberhentian) baru dijalankan
  kalau tidak ada yang langsung.
- Stasiun naik/turun ditempeli data aksesibilitas kita sendiri. Itu nilai tambah
  AksesKota: aplikasi transit lain tidak bisa bilang stasiun naiknya punya ramp.

**Tiga jebakan yang sempat masuk dan sudah diperbaiki:**
1. Arah terbalik. Relasi OSM satu arah, jadi "Lin Bogor: Jakarta Kota -> Bogor"
   sempat disarankan untuk berangkat DARI Bogor. Syaratnya `d.seq > o.seq`, bukan `<>`.
2. Duplikat stasiun. Impor OSM meninggalkan fasilitas "Bogor" tanpa atribut 20 m dari
   "Stasiun Bogor" yang punya 6 atribut terverifikasi; yang terdekat menang dan datanya
   hilang. Urutan diubah: paling banyak data dulu, baru terdekat.
3. Opsi kembar. OSM memecah satu lin jadi varian "full racket"/"half racket".

**Tetap non-goal (PRD 5):** tidak ada jadwal, tarif, atau waktu tempuh, dan tidak
ada rute transit yang dihitung. Bogor->Bandung menghasilkan nol opsi, bukan karangan.

Terverifikasi: Bogor->Monas = Lin Bogor langsung, naik Bogor (ramp, guiding block,
toilet aksesibel...), turun Juanda, 19 pemberhentian. Depok->Tanah Abang = ganti di
Manggarai. Uji aturannya ada di `test/smoke.js`.

## Rombak halaman profil dan tambah fasilitas (18 Okt 2026)

**Profil aksesibilitas.** Dulu sepuluh kotak centang lalu tombol Simpan — benar
secara fungsi, tapi tidak pernah menunjukkan akibat dari pilihan itu.

- Preset "Mulai cepat" satu ketukan, dipindah ke `constants.js` sebagai `NEEDS_PRESETS`
  supaya halaman profil dan prompt di peta memakai daftar yang sama (dua salinan pasti
  menyimpang begitu salah satunya diubah).
- Kebutuhan jadi kartu yang bisa diketuk, bukan baris centang; checkbox aslinya tetap
  ada di balik `sr-only` untuk pembaca layar.
- **Pratinjau hasil nyata dari database**, menempel di samping pada layar lebar dan
  ikut berubah tiap kali pilihan diubah (ditunda 350 ms supaya empat ketukan tidak jadi
  empat permintaan). Ini yang membuat aturan "belum diketahui tidak pernah dihitung
  tersedia" terlihat, bukan sekadar dijanjikan lewat paragraf.
- Bilah simpan jadi satu tombol + "Urungkan" (dulu tiga tombol sejajar).

**Tambah fasilitas, langkah Atribut** — layar terberat di seluruh aplikasi. Dulu
sepuluh fieldset bertumpuk, masing-masing dengan judul, tiga tombol, dan satu kolom
catatan yang SELALU terbuka. Sekarang satu atribut = satu baris; kolom catatan baru
muncul setelah status diisi dan tombol "Tambah catatan" ditekan. Sepuluh kolom teks
yang selalu terbuka itu kini nol. Warna status mengikuti makna (hijau/merah/netral),
jadi baris yang sudah diisi terlihat tanpa dibaca, dan ada penghitung "x dari 10
atribut Anda isi".

Teks "✓ Tersedia / ✕ Tidak tersedia / ? Belum diketahui" sengaja TIDAK disembunyikan
di layar sempit meski lebih muat; simbol tanpa nama terlalu samar untuk pilihan yang
menentukan data yang dibaca orang lain. Di ponsel kendalinya turun ke baris sendiri
dan melebar penuh.

Terverifikasi di peramban pada lebar 375 px: preset mengisi 4 kebutuhan dan pratinjau
menampilkan Botani Square / RS PMI Bogor / RSUD Kota Bogor (semua 100%); langkah
Atribut 2,8 layar dengan nol kolom teks terbuka, penghitung naik ke "1 dari 10" dan
tombol catatan hanya muncul di baris yang sudah diisi.

**Belum dirombak:** kontribusi saya, dasbor admin.

## Rombak dasbor admin dan kontribusi saya (18 Okt 2026)

**Kontribusi saya.** Tiap kartu dulu hanya punya satu lencana status. "Menunggu
verifikasi" benar, tapi tidak menjawab pertanyaan yang sebenarnya ada di kepala
kontributor: ini masih jalan atau sudah tersangkut? Sekarang tiap kartu punya jejak
tiga langkah Dikirim -> Ditinjau admin -> Keputusan, memakai cerita yang sama dengan
yang dijanjikan di halaman Tentang. Ditambah penanda buka/tutup, yang sebelumnya
tidak ada sama sekali sehingga kartunya tidak terlihat bisa dibuka.

Satu jebakan yang sempat masuk: pada usulan yang masih menunggu, langkah ketiga
berbunyi "Disetujui" dan hanya diredupkan warnanya. Dibaca sekilas, dan oleh pembaca
layar, itu menjanjikan hasil yang belum terjadi. Sekarang berbunyi "Keputusan"
sampai keputusannya benar-benar ada.

**Antrean admin.**
- Tabel selebar 44rem yang harus digeser menyamping diganti daftar tautan. Antrean ini
  bukan tabel data untuk dibandingkan antar-baris — tiap baris adalah satu hal untuk
  dibuka dan diputuskan — jadi daftar lebih tepat, dan muat di lebar berapa pun.
  (Tabel diff di halaman detail verifikasi TETAP tabel: itu memang perbandingan.)
- Yang masih menunggu diurutkan dari yang **paling lama**, bukan terbaru. Antrean
  verifikasi yang menaruh kiriman terbaru di atas membuat usulan lama terdorong ke
  bawah dan tidak pernah ditinjau.
- Lama menunggu ("menunggu 5 hari") ikut baris keterangan, bukan kolom kanan — sebagai
  kolom ia harus disembunyikan di layar sempit, padahal justru itu dasar triasenya.
- Subjudul "Tinjau kontribusi, tangani laporan, dan moderasi ulasan" hanya mengulang
  nama tab. Diganti keadaan nyata: "3 kontribusi menunggu verifikasi, yang terlama
  sudah 5 hari."

**Bug yang ketemu saat mengukur:** seluruh halaman admin bisa digeser menyamping di
375 px. Tombol "Lihat situs" diberi kelas `hidden sm:inline-flex`, tapi `buttonClass`
sudah memasang `inline-flex` — dua utilitas display bertabrakan dan urutan CSS yang
menang, jadi tombol itu tetap tampil di ponsel. Diperbaiki dengan membungkusnya.
Setelahnya `scrollWidth` = lebar viewport, tidak ada geseran.

Verifikasi memakai stub respons `/auth/*` dan `/admin/*` di peramban (database masih
0 kontribusi); tidak ada akun Supabase yang dibuat dan tidak ada baris yang ditulis
ke database.

## Perbaikan: kerangka peta rusak sejak peta dipindah ke "/" (18 Okt 2026)

Dilaporkan "kok tampilannya kelihatan belum banyak berubah". Ternyata memang ada yang
rusak, bukan sekadar perasaan.

**Akar masalah.** Pemeriksa "ini halaman peta?" di `PublicLayout` masih mencocokkan
`/map` dan `/facilities/:id` saja; ia tidak pernah diperbarui setelah peta dipindah ke
`/`. Di beranda, `workspace` jadi false sehingga **footer ikut dirender di bawah peta**,
ditambah `pb-16` untuk bilah nav bawah, sementara peta sendiri dipatok
`h-[calc(100dvh-4rem)]`. Total 1332 px di layar 812 px: halaman menggulir, panel bawah
tergulir keluar layar, dan hasilnya terlihat seperti halaman panjang biasa.

**Diperbaiki di akarnya, bukan dengan calc baru:**
- `workspace` kini mencakup `/`.
- Tinggi dipegang kerangka (`h-dvh overflow-hidden` + `min-h-0` pada `main`), dan
  ExplorePage memakai `h-full`. Tidak ada lagi pengurangan tinggi header/nav manual
  yang meleset begitu salah satu elemen muncul atau hilang.

**Dua bug lanjutan di BottomSheet yang ketahuan setelah itu:**
1. Tingginya `92dvh` — tinggi LAYAR, padahal wadahnya hanya area peta (561 px). Panel
   jadi lebih tinggi daripada tempatnya, menjulur ke atas, menutupi peta sepenuhnya,
   dan ketiga titik hentinya dihitung dari angka yang salah. Sekarang
   `h-[calc(100%-2rem)]`, relatif terhadap wadahnya.
2. Pengukuran pertama kadang terjadi saat elemennya belum punya tinggi. Nilai nol itu
   tetap disimpan, posisi awal jadi 0 (terbuka penuh), dan karena offset sudah terisi
   ia tidak pernah dikoreksi. Sekarang pengukuran kosong diabaikan, dan posisi disetel
   ulang dari titik henti yang sedang dipakai setiap kali ukuran berubah.

**Ambang saran transportasi: 3 km -> 2 km.** Angka 3 km salah untuk aplikasi yang kota
utamanya Bogor — hampir semua perjalanan di dalam kota ada di bawahnya, jadi sarannya
tidak pernah muncul sama sekali. Ambang yang tidak pernah terlampaui sama saja dengan
fitur yang tidak ada. Stasiun Bogor -> Botani Square (2,8 km) sekarang memunculkannya.

Terverifikasi: 375 px -> halaman tidak menggulir, panel berhenti di setengah layar,
peta terlihat, 20 fasilitas termuat. 1280x800 -> peta 880x735 px, tidak menggulir.
Token kedaluwarsa juga diuji: dibersihkan sendiri dan daftar tetap tampil.

## Angkot: saran transum akhirnya bekerja untuk perjalanan dalam kota (19 Okt 2026)

Dilaporkan: rute dalam Kota Bogor selalu dijawab "Tidak ada lin transportasi umum di
data kami yang menghubungkan kedua titik ini."

**Penyebab.** Importer menyaring operator ke Transjakarta/KAI Commuter/MRT/LRT dengan
alasan angkot tidak punya perhentian tetap. Alasannya benar, kesimpulannya salah:
angkot justru tulang punggung angkutan DALAM kota. Survei OSM Kota Bogor menemukan
42 trayek bus/angkot (angkot 01, 02, 04, 05, 09, 10, 12..., BisKita Trans Pakuan K1,
20 trayek Kabupaten Bogor) — dan **41 dari 42 tidak punya satu pun perhentian bernama,
tetapi SEMUANYA punya jalur yang dipetakan.**

**Solusinya menyimpan jalurnya, bukan menyaringnya keluar.**
- `transit_lines.geom` (multilinestring) diisi dari ruas anggota relasi.
- Tingkat ketiga pencarian, `lewatDekat()`: lin yang JALURNYA lewat dalam 600 m dari
  kedua titik. Sengaja tidak memeriksa urutan — relasi angkot disusun dari ruas yang
  arahnya campur aduk, dan yang dijanjikan ke pengguna memang hanya "lin ini lewat
  dekat kedua titik Anda", bukan rencana perjalanan.
- Urutan pencarian: langsung antar-perhentian -> satu kali ganti -> lewat jalur.
- Hasil impor: 837 lin (dari 250), 14.640 perhentian, semuanya punya jalur.

**Tiga bug yang ketemu dalam perjalanan:**
1. `way(r)` di Overpass membaca himpunan hasil TERAKHIR, yang sudah berganti jadi
   kumpulan node — mengembalikan nol ruas tanpa pesan kesalahan. Himpunan relasi
   harus diberi nama (`->.r`, lalu `way(r.r)`).
2. Pencarian satu kali ganti menyarankan "naik kereta ke Sukabumi lalu balik lagi"
   untuk perjalanan 800 m, karena kedua titik dekat stasiun yang sama. Ditambah syarat:
   naik dan turun tidak boleh tempat yang sama, dan turun harus lebih dekat ke tujuan.
3. Warna lin dari OSM dipakai apa adanya sebagai latar lencana dengan teks putih.
   Angkot 10 Bogor berwarna hijau stabilo (#04ff00) — praktis tidak terbaca. Sekarang
   warna teks dipilih dari kecerahan latarnya.

Label moda ikut dibetulkan: "bus" tidak lagi berarti Transjakarta.

Terverifikasi di peramban: Stasiun Bogor -> Botani Square memunculkan Angkot TPK-2
(87 m / 45 m), Angkot 10, dan Angkot 01. Bogor -> Monas tetap KRL Lin Bogor.
Bogor -> Bandung tetap nol opsi. Uji aturannya ditambahkan ke `test/smoke.js`.

## Data demo untuk penjurian + dua temuan (20 Okt 2026)

**`npm run seed:demo`** (`db/seed-demo.js`) mengisi antrean verifikasi: 4 akun demo
(1 admin, 3 kontributor) dan 5 usulan — 3 menunggu dengan umur berbeda (5 hari, 1 hari,
3 jam), 1 disetujui, 1 ditolak beserta catatan admin. Idempoten; `--bersihkan`
menghapus semuanya lewat penanda domain email `@demo.akseskota.test`. Kata sandinya
ada di dalam berkas skripnya.

Catatan autentikasi: ternyata auth backend ini **lokal** (bcrypt + JWT di `src/auth.js`),
bukan Supabase Auth seperti yang sempat dicatat. Akun demo sepenuhnya milik database
sendiri.

**Yang sengaja TIDAK di-seed: foto bukti.** Menempelkan gambar entah dari mana pada
fasilitas yang benar-benar ada sama dengan mengarang bukti, dan justru data yang bisa
dipercaya itu nilai jual AksesKota. Layar verifikasi menulis "Tidak ada foto" — itu
memang keadaan sebenarnya.

Alur setujui/tolak tidak diklik manual karena `test:api` sudah mencakupnya (termasuk
422 untuk tolak tanpa catatan dan 409 untuk putusan ganda), jadi tidak perlu mengubah
data fasilitas sungguhan hanya demi melihatnya jalan.

**Dua bug yang ketemu saat memverifikasi:**
1. Halaman detail verifikasi bisa digeser menyamping di 375 px. Tabel diff
   `min-w-[30rem]` melebarkan kolom grid induknya sampai 482 px — item grid defaultnya
   `min-width: auto`, jadi pembungkus `overflow-x-auto`-nya tidak pernah terpakai
   karena tidak pernah kehabisan ruang. Diperbaiki dengan `min-w-0` pada item gridnya.
2. Asisten AI tidak pernah menyebut transportasi umum meski datanya sampai ke model.
   Instruksinya berbunyi "jarak ini terlalu jauh untuk berjalan kaki" — itu penilaian,
   dan untuk 2,8 km model memilih tidak sependapat lalu diam. Sekarang ambangnya
   dinyatakan sudah diputuskan di server dan model hanya diminta menyampaikan isinya.
   Sesudahnya: "...kamu juga bisa naik angkutan umum seperti nomor 10 lin Mawar Sukasari."

`[gemini] status 500` yang muncul di `test:api` ternyata galat sesaat dari Google;
panggilan langsung dan lewat `/api/ai/chat` keduanya 200.
