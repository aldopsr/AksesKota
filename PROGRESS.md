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

## Rombak UI peta: kolom samping dibuang, kartu mengambang (20 Okt 2026)

Peta jadi lapisan utama yang mengisi seluruh ruang; semua yang lain menumpang di
atasnya. Di 1280 px lebar peta naik dari 880 px menjadi 1280 px.

- `FloatingCard` — kartu mengambang untuk hasil dan detail, posisinya diingat di
  localStorage per kartu.
- `CommandBar` — satu titik masuk melayang: ketik, mikrofon, filter, Tanya asisten,
  plus baris kategori. Menggantikan blok padat setinggi 122 px yang dulu mendorong peta.
- `MapControls` — satu klaster melayang di kanan; legenda masuk ke dalamnya, tidak lagi
  tombol tersendiri yang berebut pojok kiri dengan pencarian.
- Pencarian suara mendiktekan ke kolom pencarian lewat `useSpeechRecognition` yang
  sudah ada. Sengaja TIDAK memanggil AI: jalur ini tetap bekerja saat kuota asisten
  habis atau Gemini bermasalah. Tombol mikrofon hanya dirender bila peramban mendukung.

**Keberatan yang disampaikan dan cara menanganinya.** Kartu yang digeser-geser adalah
pola yang justru menyulitkan pengguna kursi roda (butuh kontrol motorik halus), pembaca
layar (tidak punya urutan baca), dan lansia — ironis untuk aplikasi disabilitas. Dibangun
sesuai permintaan, dengan syarat memindahkan kartu SELALU opsional:
posisi bawaannya sudah benar, gagangnya tombol sungguhan (panah 16 px, Shift+panah
64 px, terverifikasi), muncul tombol kembalikan posisi setelah dipindah, dan kartunya
tetap elemen biasa dalam urutan DOM. Suara dan AI diletakkan berdampingan dengan
ketikan, bukan menggantikannya: pengguna tuli/bisu harus tetap bisa memakai aplikasi
sepenuhnya, dan asisten punya batas pemakaian harian.

Di HP kartu mengambang tidak dipakai — panel bawah yang bisa ditarik tetap dipertahankan.
Kartu yang digeser-geser tidak masuk akal di layar selebar telapak tangan.

**Empat cacat tata letak yang ketemu lewat pengukuran, bukan lewat melihat:**
1. Kartu (y=132) menimpa baris kategori (bawah 172). Posisi awal jadi 184.
2. `max-h-[calc(100dvh-6.5rem)]` dihitung dari tinggi layar, padahal kartunya mulai di
   y=132, jadi bagian bawahnya 28 px keluar layar. Sekarang dihitung dari posisi kartu.
3. Penanda peta tersembunyi di balik kartu saat peta menyesuaikan tampilan. `MapView`
   diberi `fitPaddingLeft`.
4. Di HP klaster kontrol menindih tombol "Tanya asisten" pada koordinat yang persis sama.
   Diturunkan ke bawah baris kategori — dan salah sekali lagi karena diukur dari layar,
   padahal wadah peta sendiri sudah mulai 65 px di bawah header.

Terverifikasi 375 px dan 1280x800: tidak ada tumpang tindih, tidak ada geseran halaman,
tidak ada yang keluar layar.

## Panel asisten jadi kartu mengambang (20 Okt 2026)

Perilaku seret/pindah diangkat jadi `hooks/useKartuApung.js`, dipakai bersama kartu
hasil/detail dan panel asisten — dua salinan logika gestur pasti menyimpang begitu
salah satunya diperbaiki. `FloatingCard` menyusut jadi pembungkus tipis.

Di layar >= 640 px panel asisten kini mengambang di pojok kanan bawah, bisa digeser,
bisa dipindah dengan panah (terverifikasi 64 px untuk Shift+panah), posisinya diingat,
dan punya tombol kembalikan posisi. Di HP ia tetap panel bawah selebar layar tanpa
gagang seret. Judulnya tetap ada sebagai heading sr-only untuk navigasi pembaca layar.

**Catatan metode: tiga kali hari ini saya salah membaca pengukuran DOM.**
`getComputedStyle` dan `getBoundingClientRect` yang dibaca lewat eval peramban
melaporkan keadaan AWAL animasi, bukan keadaan akhirnya — bahkan beberapa detik setelah
animasinya pasti selesai. Berdasarkan pembacaan itu saya sempat menyimpulkan panel
asisten tidak pernah terlihat di ponsel, lalu mengganti animasinya dari motion ke CSS.
Tangkapan layar membuktikan kesimpulan itu salah: versi aslinya tampil normal. Animasi
motion sudah dikembalikan dan keyframes CSS yang terlanjur dibuat sudah dihapus.

Pelajarannya: untuk apa pun yang menyangkut animasi, **tangkapan layar dulu**, angka
belakangan. Angka dari DOM hanya bisa dipercaya untuk tata letak yang diam.

## Bahasa visual editorial dari acuan Dribbble (20 Okt 2026)

Acuan: landing page klub tenis — dasar off-white, sudut sangat membulat, judul display
besar, kartu blok warna, chip pil, tombol panah bundar, grid dengan ukuran kartu campur.

**Di tingkat token, jadi merambat ke seluruh halaman sekaligus:**
- `--color-canvas` #f8f9fc -> #f4f4f6. Off-white netral, bukan putih dan bukan biru muda,
  supaya kartu putih benar-benar terbaca sebagai lapisan yang mengambang di atas kertas.
- Radius: control 10->12 px, card 14->20 px, panel 16->28 px. Kontrol kecil sengaja tidak
  ikut sebulat kartu — tombol 44 px dengan sudut 20 px berubah jadi kapsul.

**Halaman /tentang** dirombak jadi editorial: judul display sampai 7xl, label mikro
huruf besar, tombol pil + tombol panah bundar, baris chip preset kebutuhan (yang
benar-benar membuka peta dengan kebutuhan terpasang, bukan hiasan), dan grid "Cara kerja"
dengan satu kartu indigo besar dua baris plus dua kartu putih.

**Satu penyimpangan yang disengaja dari acuan:** di sana hijau dan oranye dipakai sebagai
warna hias. Di sini hijau/kuning/merah SUDAH punya arti — tingkat kecocokan aksesibilitas.
Memakainya untuk hiasan membuat satu-satunya sistem warna yang harus dibaca dengan benar
berhenti berarti. Blok warna memakai warna merek: indigo pekat dan cyan.

**Bug nyata yang ketemu:** posisi kartu mengambang tersimpan sebagai {x:792, y:67.2} —
angka pecahan itu hasil penjepitan saat jendela sesaat berukuran aneh ketika diubah
ukurannya, lalu ikut tersimpan dan menaruh kartu di atas bilah perintah secara permanen.
Diperbaiki dua lapis: batas atas penjepitan kini posisi bawaan kartu (bukan tepi layar,
karena di atas situ ada bilah perintah), dan hasil penjepitan ikut disimpan sehingga
posisi yang terlanjur cacat memperbaiki dirinya sendiri saat halaman dibuka.

**Keempat kalinya hari ini saya salah membaca pengukuran DOM animasi.** Panel bawah
terbaca di 97 px (seolah menutupi peta) padahal sebenarnya 390 px — pembacaan diambil
saat animasinya belum selesai. Aturan yang sudah saya tulis sendiri kemarin terbukti
lagi: untuk apa pun yang bergerak, tangkapan layar dulu, angka belakangan.

**Belum dirombak bespoke** (hanya mewarisi token): profil, form tambah fasilitas,
kontribusi saya, dasbor admin, halaman masuk/daftar.

## Peta dan beranda jadi satu halaman yang digulir (20 Okt 2026)

Acuan: landing page dengan hero penuh, logo di tengah navbar, menu muncul saat diklik.

- `/` kini: **peta setinggi satu layar sebagai hero**, lalu Pitch -> Cara kerja ->
  Komunitas -> cakupan data, dalam satu halaman. `/map` dan `/facilities/:id` tetap
  kerangka aplikasi murni tanpa bagian landing, untuk yang datang langsung ke peta.
  Komponennya tetap SATU `ExplorePage` untuk ketiganya supaya peta tidak dimuat ulang
  saat berpindah. `/tentang` jadi pengalihan ke `/#cara-kerja`.
- **Navbar**: logo di tengah, navigasi pil di kiri, akun di kanan. Di layar sempit
  semuanya runtuh jadi satu tombol popup.
- Tautan "Cara kerja" menggulir halus (dilewati bila pengguna meminta gerakan dikurangi).

**Pertukaran yang diambil sadar: `scrollZoom` peta dimatikan.** Peta interaktif sebagai
hero halaman yang digulir itu jebakan klasik — roda mouse di atas peta melakukan zoom,
bukan menggulir, jadi pengguna tersangkut di layar pertama dan tidak pernah menemukan
isi di bawahnya. Zoom pindah sepenuhnya ke tombol +/- yang memang sudah ada, dan itu
juga lebih bisa dipakai lewat papan ketik.

**Penyimpangan dari acuan:** di sana judul besar menumpang di atas foto hero. Di sini
hero-nya peta sungguhan yang dipakai bekerja; menutupinya dengan judul sebesar itu
berarti menutupi isi yang justru dicari. Judulnya turun satu layar.

**Tiga masalah yang ketemu lewat pengujian, bukan lewat melihat:**
1. Kartu mengambang (position: fixed) tetap melayang di atas bagian "Cara kerja" saat
   digulir. Diperbaiki dengan IntersectionObserver ber-`rootMargin`, bukan threshold
   persen: kartu memanjang sampai dekat dasar layar, jadi yang menentukan bukan "berapa
   persen hero terlihat" melainkan "apakah hero masih menutupi sampai dasar layar".
   Ambang 0.15 sempat dipakai dan kartunya tetap menimpa isi di bawah.
2. Di HP tidak ada cara menggulir turun sama sekali — sentuhan di peta menggeser peta,
   sentuhan di panel menggulir panel. Isyarat "Cara kerja" karena itu TIDAK disembunyikan
   di layar sempit; ia pindah ke sisi kiri yang kosong dan jadi satu-satunya jalan turun.
3. Tombol "Daftar" tetap tampil di ponsel meski diberi kelas `hidden` — **bug tabrakan
   utilitas display yang sama persis** dengan yang ditemukan di header admin: `buttonClass`
   sudah memasang `inline-flex` dan urutan CSS yang menang. Pola ini sudah muncul dua
   kali; kalau ketemu ketiga kalinya, `buttonClass` yang harus diperbaiki.

Terverifikasi 375 px dan 1280x800: tidak ada geseran menyamping, logo tidak bertabrakan,
kartu hilang saat digulir dan kembali saat ke atas, /map tetap tidak menggulir.

## Peta menahan gulir, navigasi lewat navbar (20 Okt 2026)

Arah dibalik dari keputusan sebelumnya, atas permintaan: **`scrollZoom` peta dinyalakan
lagi.** Roda mouse di atas peta melakukan zoom dan halaman TIDAK ikut bergulir, jadi
pengguna tetap berada di peta selama kursornya di peta. Jalan turun ke bagian penjelasan
hanya lewat navigasi.

Konsekuensinya satu, dan harus diingat kalau navbar diutak-atik lagi: **tautan "Cara
kerja" tidak boleh pernah hilang di ukuran layar mana pun** — ia satu-satunya jalan ke
bawah. Di layar lebar ia pil di kiri navbar; di layar sempit ia ada di dalam popup menu.
Keduanya sudah diuji: desktop scrollY 0 -> 1382, mobile 0 -> 1926, dan "Jelajahi"
mengembalikan ke 0 dengan kartu mengambang muncul lagi.

**Area peta disederhanakan.** Tombol "Tanya asisten" naik ke navbar sebagai CTA gelap
berpanah bundar, meniru tombol utama pada acuan. Yang menumpang di atas peta tinggal
tiga hal: mencari, menyaring, memilih kategori. Isyarat gulir "Cara kerja" dihapus —
tidak ada lagi yang digulir, dan navbar sudah mengurus itu.

Di layar sempit CTA asisten jadi ikon saja supaya muat berdampingan dengan tombol menu,
logo, dan Masuk. Terverifikasi tidak bertabrakan pada 375 px.

**Catatan metode, kebalikan dari catatan kemarin:** kali ini tangkapan layar yang
menyesatkan — tombol Masuk/Daftar tampak terpotong di tepi kanan, padahal pengukuran DOM
menunjukkan keduanya ada di 914-1249 dari viewport 1265. Untuk tata letak yang DIAM,
angka DOM yang benar; untuk apa pun yang BERGERAK, tangkapan layar yang benar.

## Navbar penuh, peta bersih, kartu dipangkas (20 Okt 2026)

**Bug yang dilaporkan, diperbaiki.** Setelah mengklik "Cara kerja" lalu menggulir naik
ke peta, mengklik "Cara kerja" lagi tidak melakukan apa-apa. Sebabnya alamatnya sudah
"/#cara-kerja": React Router tidak melihat perubahan lokasi, jadi efek yang menggulir
tidak pernah berjalan lagi. Sekarang tautannya memanggil `gulirKeBagian()` langsung dan
baru menyerah ke Link kalau bagian itu memang tidak ada di halaman ini.
Terverifikasi: klik 1 -> 1382, gulir naik ke 0, klik 2 -> 1382 lagi.

**Navbar mengikuti acuan.** Kiri: Jelajahi, Cara kerja, Kontribusi. Tengah: logo.
Kanan: pil pencarian, CTA asisten, akun. Pencarian baru membuka isinya saat diklik —
kolom teks, mikrofon, kategori, dan pintasan ke panel kebutuhan. Hasilnya lewat URL,
jadi tidak ada state yang perlu dibagi dengan halaman peta (pola yang sama dipakai
`?assistant=1`; ditambah `?filter=1` untuk panel kebutuhan).

**CommandBar dihapus seluruhnya.** Dua baris yang dulu menutupi peta permanen kini nol.
Yang menumpang di atas peta tinggal klaster kontrol dan kartu hasil.

**Masuk/Daftar jadi satu, dan tidak lagi di navbar halaman peta.** Sebagai gantinya
`AjakanMasuk` muncul di atas peta SETELAH ada bukti ketertarikan — satu fasilitas dibuka
atau kebutuhan dipilih — dengan tiga manfaat berikon, lalu satu tombol "Masuk atau
daftar". Ditutup sekali, tidak kembali 30 hari.

**FacilityCard dari 6 baris jadi 3**, tinggi 130 px -> 76 px. Kategori dihapus (ikonnya
sudah mengatakan itu; tetap dibacakan pembaca layar lewat teks tersembunyi), alamat
dipotong satu baris, tanggal verifikasi dan rating pindah ke halaman detail, tombol
"Rute" jadi tombol bundar berikon sehingga hemat satu baris penuh.

**Uji data terburuk** menemukan satu hal: nama sepanjang "Rumah Sakit Umum Daerah Dokter
Soekardjo Kecamatan Bogor Tengah Provinsi Jawa Barat" memanjat jadi empat baris dan
kartunya hampir dua kali tinggi kartu lain. Dibatasi dua baris; sesudahnya kartu ekstrem
dan kartu normal sama-sama 98 px.

**Hasil ponytail-review, ketiganya sudah diterapkan:**
1. `previewFacility` dihitung tiap render, tidak pernah dipakai. Dihapus.
2. Tombol "Ubah pencarian" di keadaan kosong memfokuskan `#explore-search` — elemen itu
   ikut terhapus bersama CommandBar, jadi tombolnya DIAM SAJA saat diklik. Diganti
   "Lihat semua kategori" yang memang bisa dikerjakan dari sana.
3. Lima salinan pil `rounded-full ... active:scale-[0.97]` dengan transisi ditulis ulang
   tiap kali. Jadi satu utilitas `.ak-pil` di index.css, lengkap dengan penghormatan
   prefers-reduced-motion yang sebelumnya tidak ada di satu pun salinannya.

**Belum dikerjakan:** kartu di dalam percakapan asisten (MiniCard) belum ikut
disederhanakan seperti FacilityCard.

## Kartu di percakapan asisten: dihapus, bukan dirapikan (20 Okt 2026)

MiniCard di `AssistantDock` adalah duplikat `FacilityCard`: isi yang sama ditulis dua
kali. Begitu kartu daftar diringkas kemarin, kartu di percakapan tertinggal — nama,
alamat, jarak, kecocokan, bintang, dan dua tombol berteks dalam lima baris.

Asisten ternyata sudah memakai `normalizeFacility` yang sama persis dengan halaman peta,
jadi bentuk datanya cocok tanpa perubahan apa pun. MiniCard dihapus (19 baris) dan
diganti `FacilityCard`. Yang ditambahkan ke FacilityCard hanya satu kait opsional
`onOpen` — bukan pengganti navigasi, hanya efek samping, karena panel asisten harus
menutup dirinya sendiri di layar sempit.

Empat impor ikut mati dan dihapus: MatchBadge, Stars, formatDistance, Navigation.

**Yang didapat bukan sekadar lebih ringkas.** MiniCard hanya menampilkan lencana
kecocokan dan rating bintang. FacilityCard menampilkan ATRIBUT MANA yang terpenuhi dan
mana yang belum diketahui — dan itulah inti produknya. Jadi kartu di percakapan kini
lebih informatif meski lebih sedikit tulisannya.

Terverifikasi lewat percakapan sungguhan ("Mall dengan jalur kursi roda di Bogor"):
tiga kartu tampil, chip kebutuhan terbaca, penanda "Direkomendasikan asisten" ada di
atas kartu yang direkomendasikan.

## Arah seni dari taste-skill: "The printed annual" (20 Okt 2026)

Kali ini skill-nya dipakai sebagaimana mestinya — bukan dibaca, tapi **skripnya
dijalankan**. `draw.mjs` membagi tiga arah dari riset 247 situs galeri; dipilih
`editorial-report` (seed 1089227174) karena posturnya memang milik produk ini: AksesKota
adalah TEMUAN yang dinyatakan apa adanya, bukan etalase.

**Idenya**, ditulis sebelum satu baris kode pun: pada halaman ini, tanda **?** yang kami
tolak dibulatkan jadi "tersedia" menjadi motif berulang — di angka, di bilah tahapan,
dan sebagai KOLOM TERSENDIRI di tabel cakupan. Uji pesaing lolos: siapa pun bisa bilang
"data aksesibilitas"; hanya kami yang mencetak apa yang belum diketahui.

**Dua slot lembar arah tidak diadopsi mentah, dicatat sesuai aturan skill:**
1. Hero "two-by-two board" tidak dipakai — layar pertama "/" adalah peta sungguhan,
   keputusan produk yang sudah tetap. Hanya BARIS UBIN atasnya yang diambil, jadi navbar.
2. "proof — recognition as a table" mengandaikan penghargaan dan liputan pers. Kami tidak
   punya dan mengarangnya terlarang. Geometri tabelnya diisi bukti yang memang ada:
   angka cakupan per wilayah, diambil dari database (Bogor 51/33, Jakarta 43/32,
   Bandung 43/34), dengan "Belum diketahui" sebagai kolomnya sendiri.

**Navbar jadi baris ubin**: ubin tinta untuk logo, ubin kertas untuk tautan, ubin merek
untuk aksi. `LogoMark` diberi varian `light` karena kepala logonya gelap dan hilang di
atas tinta.

**Halaman masuk/daftar**: blok tinta penuh di kiri dengan judul display dan tiga alasan
mendaftar, formulir pada kertas di kanan. Di ponsel formulir naik ke atas — orang yang
sudah mengetuk "Masuk" tidak perlu dibujuk dulu.

**`inspect.mjs` dijalankan di peramban sungguhan.** Dari 15 FAIL awal, yang memang salah
dan sudah diperbaiki: judul pecah 4 baris (lebar ukurnya yang dilebarkan, bukan ukurannya
yang diturunkan), kontras putih di atas brand-500 hanya 3,60:1 → brand-700 8,03:1, dan
badan teks 14px → 16px.

**FAIL yang diterima sadar**, karena pengukurnya menilai "/" sebagai halaman pemasaran
padahal layar pertamanya aplikasi peta hidup: atribusi Mapbox terbaca sebagai eyebrow,
edge-text dan margin tidak simetris; kontrol peta sebagai glass dan outlined-box;
NeedsPrompt sebagai icon-cards; h1 kami sengaja sr-only karena layar pertama adalah peta.
"few-pictures" nyata dan belum terjawab — halaman ini memang belum punya satu gambar pun.

## Gambar: arsip jalanan Bogor, dicari lewat assets.mjs (20 Okt 2026)

`few-pictures` adalah satu-satunya FAIL nyata yang tersisa dari lembar arah, dan jalan
keluarnya sah — bukan Google Maps. `assets.mjs` mencari koleksi terbuka; kata kunci
yang membuka pintunya adalah **"Buitenzorg"**, nama kolonial Bogor. Arsip KITLV dan
Rijksmuseum memuat foto jalanan kota ini sendiri.

Empat foto diunduh, semuanya CC0 atau CC BY 4.0 — **tanpa share-alike**, dipilih begitu
supaya perlakuan hitam-putih tidak menimbulkan kewajiban lisensi tambahan:
- "Straat inbij Buitenzorg (huidige Bogor), West-Java" — Rijksmuseum, CC0
- "Eetstalletjes aan de Roode Brug te Buitenzorg, KITLV 18920" — CC BY 4.0
- "Straat te Buitenzorg met het paleis van de gouverneur-generaal, KITLV A1219" — CC BY 4.0
- "Minaret in de Arabische straat te Buitenzorg, KITLV 7546" — CC BY 4.0

Disusun sebagai mosaik tanpa celah (enam sel: empat foto + satu ubin warna selebar dua
kolom), satu perlakuan hitam-putih, dipotong 10% karena pindaian museum membawa bingkai
mount putih yang membuat ketiganya terbaca sebagai gambar terpisah.

**Fotonya tidak pernah disajikan sebagai milik kami atau sebagai foto fasilitas mana
pun.** Ubin warna di sebelahnya yang menjelaskan maksudnya: jalan yang sama, seratus
tahun kemudian, sekarang diukur siapa yang bisa melewatinya. Kredit lengkap dengan
tautan ke halaman sumber dan teks lisensinya ada di footer — itu kewajiban CC BY.

**inspect.mjs: 15 FAIL -> 11.** Yang diperbaiki: kontras 3,60:1 -> 8,03:1, judul pecah
empat baris (ukur dilebarkan dulu, ukuran diturunkan belakangan), badan teks 14 -> 16px
di bagian landing, dan gambar 0 -> 4.

**11 FAIL sisanya, dan pembagiannya jujur:**
- Delapan berasal dari CANGKANG APLIKASI PETA, bukan dari halaman landing: atribusi
  Mapbox (wajib lisensi, tidak bisa dipindahkan) terbaca sebagai edge-text dan margin
  tak simetris; kontrol peta sebagai glass, shadow, hairline dan outlined-box;
  NeedsPrompt sebagai icon-cards; h1 kami sengaja sr-only karena layar pertama adalah
  peta; covered-text berasal dari header sticky yang memang melewati teks saat digulir.
- Tiga NYATA dan belum dikerjakan: `body-size` 14px, `small-text` 6 blok di bawah 13px,
  dan `size-count` 12 ukuran huruf. Yang pertama dua itu penting untuk produk
  aksesibilitas — chip atribut kami 12px, dan itu patut dinaikkan. Perubahannya menyentuh
  tinggi kartu di seluruh aplikasi, jadi sengaja tidak dikerjakan terburu-buru.

## Audit konsistensi, bukan arah kelima (20 Okt 2026)

Dilaporkan: "UI/UX tidak punya konsep, semuanya standard dan tidak konsisten", mobile
paling tidak disukai. Keluhannya benar, dan penyebabnya bukan tiap perubahan itu buruk
— melainkan dalam satu minggu kita menumpuk empat acuan berbeda (landing klub tenis,
dasbor AML, editorial report, bahasa kartu mengambang). Masing-masing koheren sendiri;
bersama-sama tidak. Menambah arah kelima akan memperburuk.

**Diukur dulu, bukan dikira-kira:**
- 6 bentuk sudut dipakai bersamaan (`full` 25, `card` 42, `control` 48, `panel` 12,
  `md` 4, satu literal)
- 18 bayangan pada elemen yang diam
- `text-sm` (14 px) dipakai 118 kali SEBAGAI TEKS BADAN; `text-xs` (12 px) 25 kali

**Diperbaiki di tingkat token, bukan dengan menyunting 143 kelas:**
- `--text-xs` 12 -> 13 px, `--text-sm` 14 -> 15 px. Satu perubahan, 143 tempat ikut.
  Sengaja 15 px, bukan 16: pada 16 px `text-sm` jadi sama dengan `text-base` dan
  skalanya runtuh jadi satu langkah.
- `rounded-md` dihapus seluruhnya — bentuk keenam yang tidak pernah diputuskan.
- Bayangan pada elemen diam 18 -> 2; yang tersisa memang benar-benar mengambang.

**Mobile: dua sistem navigasi pada satu layar.** Baris ubin di atas DAN bilah di bawah
sama-sama menavigasi, dan ubin menunya hanya blok putih kosong selebar separuh layar.
Menu atas dihapus di ponsel; "Cara kerja" pindah ke bilah bawah (jadi empat item) karena
sejak peta menahan gulir ia satu-satunya jalan turun dan tidak boleh bersembunyi di
balik ketukan kedua. Ubin pencarian kini mengisi sisa baris: logo 50 + cari 253 +
asisten 40 = tepat 375 px.

**Tombol tutup popup masuk/daftar: 35x35 px.** Di bawah ambang target sentuh 44 px —
itu sebabnya di ponsel ia terasa tidak bisa ditutup sama sekali. Jadi 44x44.

**inspect.mjs: 11 FAIL -> 9.** `body-size` 14 -> 15 px, `small-text` 6 -> 2 blok,
bayangan hampir habis. Yang tersisa sebagian besar tetap berasal dari cangkang aplikasi
peta (atribusi Mapbox, kontrol peta, h1 sr-only).

**Belum selesai, dan jujur: refaktor menyeluruh yang diminta lebih besar daripada sisa
waktu.** Yang paling berdampak berikutnya: `size-count` 12 ukuran huruf harus turun ke
lima langkah, dan `rounded-full` 25 tempat perlu diputuskan sekali — mana yang benar
kapsul, mana yang ikut radius kartu.

### Lanjutan refaktor: skala huruf ditutup (20 Okt 2026)

`rounded-full` ternyata BUKAN sumber ketidakkonsistenan — dari 29 pemakaian, hampir
semuanya memang kapsul sungguhan (lencana, chip, avatar, titik jejak, tombol bundar,
bilah langkah). Dibiarkan.

Yang nyata adalah skala huruf: enam clamp berbeda ditulis langsung di markup, plus
`text-[0.95rem]` di lima tempat yang **praktis sama dengan `text-sm`**. Halaman merender
12 ukuran — itu bukan skala, itu kebetulan.

Tiga langkah display diberi nama di token (`--text-display`, `--text-title`,
`--text-lead`) dan semua clamp sembarang diganti dengannya. Hasilnya tangga yang bisa
dihafal: **102 / 64 / 26 / 18 / 16 / 15 / 13**, turun dari 12 nilai acak. Di halaman
masuk versi ponsel cuma terpakai empat: 36 / 18 / 16 / 15.

`size-count` hilang dari daftar FAIL. Build dan `npm test` lolos.

**Status jujur refaktor konsistensi:**
- Selesai: skala huruf (12 -> 7 langkah bernama), bentuk sudut (6 -> 5, `rounded-md`
  dihapus), bayangan pada elemen diam (18 -> 2), ukuran teks kecil (12 -> 13 px,
  14 -> 15 px di 143 tempat sekaligus lewat token), navigasi ganda di ponsel dihapus,
  target sentuh tombol tutup 35 -> 44 px.
- Belum: `body-size` masih 15px (inspector mau >=16); menaikkannya berarti `text-sm`
  bertabrakan dengan `text-base` dan skalanya runtuh — perlu keputusan tersendiri soal
  apakah `text-sm` memang masih dibutuhkan sebagai langkah.
