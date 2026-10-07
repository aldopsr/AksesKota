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
| Struktur repo | **satu repo** (`backend/` + `frontend/`) | Vercel bisa deploy 2 project dari 1 repo, jadi monorepo tidak menambah kerja deploy; kontrak API tetap kelihatan di satu PR |
| Deploy | **Vercel** (2 project, root dir beda) | lihat catatan serverless di bawah — ada 2 jebakan yang sudah ditangani |
| Dataset lokasi | **import OSM via Overpass API** | `npm run import:osm` |

### Catatan Vercel (jangan dihapus)

1. **`DATABASE_URL` di Vercel wajib pakai Transaction pooler Supabase, port `6543`** — bukan 5432.
   Serverless membuka banyak koneksi pendek; port 5432 akan kehabisan kuota koneksi.
2. `src/index.js` mengekspor `app` dan hanya `listen()` kalau `process.env.VERCEL` tidak ada.
   Entry serverless-nya `backend/api/index.js`, routing-nya di `backend/vercel.json`.
3. `pool.max = 1` saat di Vercel (lihat `src/db.js`), 10 saat lokal.
4. Saat setup project Vercel: **Root Directory = `backend`**. Project kedua untuk frontend, Root Directory = `frontend`.
5. Isi `CORS_ORIGIN` di env Vercel dengan domain frontend-nya, jangan dibiarkan `*`.

## Status fase

- [x] **Fase 1 — Fondasi + Facilities (P0 no. 1–7)** · selesai 7 Okt 2026
- [x] **Fase 1b — Import dataset OSM + siap deploy Vercel** · selesai 7 Okt 2026
- [x] **Fase 2 — Accessibility Profile + Crowdsourcing + Admin verifikasi** (P0 no. 8–10, P1 no. 1) · selesai 7 Okt 2026
- [x] **Fase 3 — AI pipeline** (P0 no. 11–14) · selesai 7 Okt 2026
- [x] **Fase 4 — Routing** (P0 no. 15, P1 no. 5) · selesai 7 Okt 2026
- [x] **Fase 5 — Review, Report, proteksi login** (P1 no. 3–4) · selesai 7 Okt 2026
- [ ] **Fase 6 — Deploy ke Vercel + survei data manual**

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
  db/import-osm.js          import ~105 fasilitas dari Overpass API (+ koreksi koordinat seed)
  api/index.js              entry serverless Vercel
  vercel.json               rewrite semua path ke /api
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
| **Hanya ~26% fasilitas punya data aksesibilitas** (target PRD ≥70%) | **blocker demo — butuh survei manual, lihat bagian di bawah** |
| Open Data Kota Bogor belum dipakai (baru OSM) | kalau portalnya punya dataset fasilitas yang bisa diunduh |
| Belum ada rate limit HTTP global | fase 5, bareng rate limit AI |
| Belum ada pagination (hanya `limit`) | kalau dataset lewat ~500 fasilitas |
| Refresh token | tidak perlu untuk MVP; token berlaku 30 hari |

---

## Fase 2 — selesai

File baru: `src/routes/profile.js`, `src/routes/contributions.js` (submit + admin dalam satu file,
karena logika apply-approve harus duduk di sebelah validasi submit-nya), `src/storage.js`.
`src/db.js` dapat helper `tx()`.

### Endpoint baru

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/profile/accessibility` | Bearer | kebutuhan aksesibilitas tersimpan |
| PUT | `/api/profile/accessibility` | Bearer | body `{needs:[kode]}` — ganti seluruh isi |
| DELETE | `/api/profile/accessibility` | Bearer | kosongkan profil |
| POST | `/api/uploads/photo-url` | Bearer | body `{ext}` → `{upload_url, public_url}` |
| POST | `/api/contributions` | Bearer | ajukan fasilitas baru / perubahan |
| GET | `/api/contributions/mine` | Bearer | riwayat kontribusi sendiri |
| GET | `/api/admin/contributions?status=` | Admin | `pending` (default) / `approved` / `rejected` / `all` |
| GET | `/api/admin/contributions/:id` | Admin | nilai sebelum vs usulan, foto, pengirim, riwayat |
| POST | `/api/admin/contributions/:id/review` | Admin | body `{action:'approve'\|'reject', note?}` |

### Cara upload foto (untuk frontend)

Backend **tidak** memproksi byte foto. Alurnya tiga langkah:

1. `POST /api/uploads/photo-url` dengan `{ext:'jpg'}` → dapat `{upload_url, public_url}`.
2. `PUT` file-nya langsung ke `upload_url` (body = file mentah). Tidak lewat backend.
3. Kirim `public_url` di array `photos` saat `POST /api/contributions`.

Alasannya: Vercel membatasi body request ~4,5 MB dan foto HP sering lebih besar. Bonus, tidak perlu multer.

### Setup bucket (WAJIB, sekali saja)

Supabase → Storage → New bucket:

- Name: **`facility-photos`**, Public bucket: **on** (foto fasilitas memang untuk dilihat publik)
- **Allowed MIME types:** `image/jpeg, image/png, image/webp, image/heic`
- **File size limit:** `5 MB`

Dua setting terakhir bukan hiasan — itu penegakan validasi tipe & ukuran (NFR-05) yang
tidak bisa dilewati klien, karena klien-lah yang mengunggah langsung ke Supabase.
Backend hanya memeriksa ekstensi sebelum menandatangani URL.

### Aturan yang ditegakkan kode (dan diuji di `npm test`)

1. **Pending tidak pernah mengubah data resmi** (AC-06). Diuji: atribut tetap `unknown` selama pending.
2. **Atribut utama wajib foto bukti** (FR-08). Atribut non-utama (`braille`, `audio_access`,
   `accessible_entrance`, `handrail`) boleh tanpa foto.
3. **URL foto harus berasal dari bucket kita.** Tanpa cek ini kontributor bisa menitipkan
   URL gambar sembarang atau pelacak ke dalam data resmi.
4. **Approve hanya bisa sekali.** `select ... for update` di dalam transaksi; dua admin yang
   menekan approve bersamaan tidak akan sama-sama lolos. Diuji: approve kedua → 409.
5. **Reject tidak mengubah apa pun** (AC-07). Diuji.
6. **Approve itu satu transaksi** (`tx()` di `src/db.js`): facilities + accessibility_facilities +
   facility_photos + contributions ditulis sekaligus atau tidak sama sekali.
7. **Titik di luar bbox Kota Bogor ditolak** saat submit. Konstanta `BOGOR` di `contributions.js`
   sengaja menduplikasi bbox di `import-osm.js` — importer itu script dengan top-level await,
   tidak boleh di-import dari route.
8. **Approve mengisi `verified_by` + `verified_at` + `last_verified_at`** (FR-20), jadi fasilitas
   hasil verifikasi langsung berstatus `verified_recently`.

Catatan: foto kontribusi `create` disimpan di dalam `payload.photos` sampai disetujui, karena
`facility_photos` butuh `facility_id` yang belum ada. Saat approve baru dipindah ke tabelnya.

---

## Fase 3 — selesai

File baru: `src/routes/ai.js`. Tabel `ai_usage` diubah (kolom `user_id` → `key`) lewat migrasi
idempotent di `schema.sql`, supaya Guest ikut terhitung kuota — Guest boleh pakai AI (PRD §7).

### Endpoint

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/ai/query` | opsional | body `{text, lat?, lon?}` |

Speech-to-text dikerjakan di browser (Web Speech API `id-ID`), jadi endpoint ini **menerima teks**.

### Alur

`teks → Gemini (structured output) → validateIntent() → searchFacilities() → hasil`

Bentuk respons:
- `{intent:'clarify', question}` — AI butuh satu klarifikasi (FR-17), atau lokasi belum diizinkan.
- `{intent, parsed, needs, message, count, results, quota, disclaimer}` — hasil pencarian.
- `503 {error, fallback:'search', query}` — AI mati, frontend langsung jalankan pencarian teks biasa.
- `429 {error, fallback:'search', query}` — kuota harian habis.

### Bagaimana halusinasi dicegah secara struktural

Ini bagian yang paling mungkin ditanya juri, jadi ditulis lengkap:

1. **LLM tidak pernah menjadi sumber data.** Gemini hanya mengeluarkan *parameter*
   (intent, kategori, radius, daftar kebutuhan). Seluruh fakta fasilitas datang dari
   `searchFacilities()` — fungsi yang sama yang dipakai pencarian biasa.
2. **Kalimat jawaban dibentuk di backend, bukan oleh LLM.** `message` disusun di JS dari
   jumlah hasil, jadi tidak ada kalimat yang bisa menyebut fasilitas atau atribut yang tidak ada
   di database (PRD §30.1–30.2). Nol hasil → "Tidak ditemukan fasilitas yang cocok…" (§30.5).
3. **`validateIntent()` adalah batas kepercayaan** (FR-16). Output model dilewatkan zod,
   lalu: intent di luar daftar → error; kategori karangan → `null`; kode atribut karangan → dibuang;
   `radius_m` dijepit maksimal 20 km; semua teks dipotong panjangnya.
   Diuji di `npm test` dengan output yang sengaja nakal (`category:'hotel_bintang_lima'`,
   `radius_m: 999999999`, atribut `'teleportasi'`).
4. **`responseSchema` Gemini dibangun dari isi database**, bukan daftar hardcode — enum kategori
   dan kode atribut diambil dari tabel, jadi schema dan DB tidak bisa melenceng.
5. **`unknown` tetap `unknown`.** AI tidak punya jalur untuk mengubah status atribut; ia hanya membaca.

### Yang dijaga selain itu

- **Kuota 10 query/hari** (PRD §27), atomik lewat `insert … on conflict do update returning count`.
  Kunci: `u:<id>` untuk user login, `ip:<alamat>` untuk Guest. Pakai tabel, bukan memori,
  karena tiap instance serverless Vercel punya memori sendiri.
- **`trust proxy` diaktifkan** di `index.js` supaya `req.ip` membaca `X-Forwarded-For` di Vercel —
  tanpa itu semua Guest akan terbaca sebagai satu IP dan saling menghabiskan kuota.
- **Timeout 15 detik** ke Gemini (`AbortSignal.timeout`), supaya function Vercel tidak menggantung.
- **Kegagalan AI tidak merembet** (NFR-04): diuji dengan menghapus `GEMINI_API_KEY` lalu memastikan
  `/api/ai/query` balas 503 + `fallback`, dan `/api/facilities` tetap 200.
- **Personalisasi** (PRD §18): kalau pengguna tidak menyebut kebutuhan spesifik, profil
  aksesibilitasnya otomatis dipakai.

### Hutang & ceiling yang diketahui

| Apa | Catatan |
|---|---|
| **Endpoint `/api/ai/voice` (Google Cloud STT) belum dibuat** | sengaja dilewati: Web Speech API sudah menangani STT di browser, dan membangun jalur audio tanpa kredensial GCP berarti menulis kode yang belum pernah dijalankan. Bilang kalau tetap mau dibuat sebagai jalur kedua. |
| `facility_type` bebas ("mall") dipetakan ke kategori, bukan ke nama | "cari mall" → `category=komersial`, jadi taman ikut terbawa. Menyempitkan ini butuh kolom subkategori. |
| `origin_name` ("dari Stasiun Bogor") diparse tapi belum dipakai | butuh geocoding titik asal — masuk Fase 4 bareng routing. |
| Nama model Gemini di env | `GEMINI_MODEL`, default `gemini-2.5-flash`. Kalau Google balas 404, ganti di sini. |
| Test set 50–100 query (PRD §29) belum ada | butuh `GEMINI_API_KEY` aktif; ini pekerjaan evaluasi, bukan kode. |

---

## Fase 4 — selesai

File baru: `src/routes/route.js`, `src/quota.js` (helper kuota dipakai bareng AI & routing),
`db/import-ways.js`, tabel `pedestrian_ways`.

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/route` | opsional | body `{from:{lat,lon}, to_facility_id}` atau `{from, to:{lat,lon}}` |

### Kenapa ada tabel `pedestrian_ways`

PRD §19.7 menjanjikan `Route Score = 70% aksesibilitas + 30% jarak`. Mapbox Directions tidak
mengembalikan tag aksesibilitas jalur sama sekali — tanpa data sendiri, angka 70% itu tidak punya
sumber dan skor apa pun yang ditampilkan cuma karangan.

Jadi `db/import-ways.js` menarik jaringan pejalan kaki Bogor dari OSM (footway, path, pedestrian,
steps, dan jalan bertag `sidewalk`) beserta tag `wheelchair`, `tactile_paving`, `surface`,
`smoothness`, `incline`, `kerb`, `width`. Hasil dry-run: **2094 ruas, 9% bertag aksesibilitas,
76 ruas tangga**.

### Cara skor aksesibilitas rute dihitung

Untuk tiap alternatif rute dari Mapbox, cari ruas pejalan kaki dalam radius 15 m dari garis rute,
klasifikasikan sekali per ruas, lalu:

```
accessibility = panjang_baik / (panjang_baik + panjang_buruk)
coverage      = (panjang_baik + panjang_buruk) / panjang_rute
```

- **baik**: `wheelchair` ∈ (yes, designated), atau `tactile_paving=yes`, atau `smoothness` ∈ (excellent, good)
- **buruk**: `highway=steps`, atau `wheelchair=no`, atau `smoothness` ∈ (bad … impassable)
- **unknown**: sisanya — **tidak masuk pembilang maupun penyebut**. Inilah penerapan PRD §19.7:
  `unknown` tidak boleh dianggap `not_available`.

`coverage` dilaporkan terpisah dan itu disengaja: skor 100% dengan coverage 5% berarti
"yang sedikit diketahui itu bagus", bukan "rutenya bebas hambatan". UI sebaiknya menampilkan keduanya.

**Ambang cakupan (`MIN_COVERAGE = 0.2`), ditambahkan setelah uji nyata.** Uji pertama dengan data
asli memberi `accessibility = 0.00` pada SEMUA rute dengan coverage 3–6%. Penyebabnya bias pemetaan
OSM: tangga dipetakan rajin (76 ruas) sementara `wheelchair=yes` hampir tidak pernah ditulis
(**6 ruas** di seluruh Bogor). Jadi himpunan "diketahui" nyaris hanya berisi bukti negatif, dan
rasio `baik/(baik+buruk)` selalu jatuh ke nol — angka yang terlihat pasti padahal hanya
mencerminkan kebiasaan pemetaan.

Di bawah ambang, skor dikembalikan `null` ("belum cukup untuk dinilai") dan sebagai gantinya
dilaporkan **hambatan yang benar-benar terdeteksi**: `hambatan.ruas_tangga` dan `hambatan.ruas_buruk`.
Contoh keluaran nyata: *"Terdeteksi 5 ruas tangga di sepanjang jalur."* Itu informasi yang bisa
dipakai pengguna kursi roda, dan bersandar pada bukti positif yang memang ada di OSM.

Kalau tidak ada satu pun ruas diketahui → `accessibility_score: null`, peringkat memakai jarak saja,
dan `message` menyatakan itu terang-terangan. Tidak ada penalti karangan untuk data yang tidak ada.

### Yang dijaga

- **Token Mapbox tidak pernah sampai ke browser** (NFR-05) — semua panggilan lewat backend.
- **Kuota 50 rute/hari** per akun/IP, memakai tabel yang sama dengan kuota AI lewat `src/quota.js`.
  Guardrail PRD §27 adalah ≤5.000 Directions request/bulan; 50/hari jauh di bawah itu.
- **Timeout 15 detik** ke Mapbox, dan gagal routing → `503 {fallback:'map'}`, peta tetap hidup (NFR-04).
- **Tujuan diambil dari database** lewat `to_facility_id`, bukan dari koordinat bebas, supaya detail
  fasilitas yang tampil bersama rute tetap berasal dari data AksesKota.
- **Bobot 70/30 diuji** di `npm test` tanpa perlu Mapbox: ada assert yang memastikan rute lebih
  aksesibel walau 40% lebih jauh tetap menang atas rute terpendek yang buruk. Kalau bobotnya
  tertukar, assert itu jatuh.

### Ceiling yang diketahui

| Apa | Catatan |
|---|---|
| Panjang ruas dihitung **penuh**, bukan hanya bagian yang berimpit rute | ruas panjang yang menyerempet jadi over-counted. Ada komentar `ponytail:` di `route.js`; naik kelas ke `ST_Intersection` pada EPSG:32748 kalau presisinya kurang. |
| Coverage rendah (9% ruas bertag) | ini kondisi data OSM Bogor apa adanya, bukan bug. Dilaporkan jujur lewat `coverage`. |
| `origin_name` dari AI ("dari Stasiun Bogor") belum jadi titik asal | butuh geocoding; saat ini titik asal harus dikirim sebagai koordinat. |

---

## Fase 5 — selesai

File baru: `src/routes/community.js`. Tabel `login_attempts` + kolom `reports.resolution_note`.

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/facilities/:id/reviews` | Bearer | `{rating:1-5, content?}` — kirim ulang = edit review sendiri |
| DELETE | `/api/facilities/:id/reviews/mine` | Bearer | hapus review sendiri |
| POST | `/api/reports` | Bearer | `{facility_id, report_type, description?, review_id?}` |
| GET | `/api/reports/mine` | Bearer | riwayat laporan sendiri |
| GET | `/api/admin/reports?status=` | Admin | `open` (default) / `resolved` / `dismissed` / `all` |
| POST | `/api/admin/reports/:id/resolve` | Admin | `{action:'resolve'\|'dismiss', note?, hapus_review?}` |

Yang dijaga:

- **Rating tidak pernah menyentuh Accessibility Match** (PRD §20). Ada assert yang membandingkan
  `match_pct` sebelum dan sesudah review dibuat — kalau suatu hari rating diikutkan ke perhitungan
  match, assert itu jatuh. Secara struktural `searchFacilities()` memang tidak menyentuh tabel `reviews`.
- **Satu review per orang per fasilitas**, dijaga unique constraint; kirim ulang meng-update.
- **Laporan tidak pernah mengubah data fasilitas.** Admin hanya menutup laporan; perubahan data resmi
  tetap harus lewat alur kontribusi terverifikasi (PRD §12.4). Satu-satunya aksi destruktif adalah
  `hapus_review` untuk laporan konten review bermasalah.
- **Laporan tidak bisa ditutup dua kali** → 409.

### Proteksi brute-force login (NFR-05)

Maksimal **10 kegagalan per IP dalam 15 menit**, lalu 429. Dikunci per IP, **bukan per email** —
kalau per email, siapa pun bisa mengunci akun orang lain hanya dengan menebak password korban.
Login berhasil me-reset hitungan. Baris lama dibersihkan sambil jalan, tidak perlu cron.
Diuji di `npm test`: 12 login salah berturut-turut harus kena 429.

### Kuota Guest dinaikkan (keputusan 7 Okt)

| | User login | Guest (per IP) |
|---|---|---|
| AI | 10/hari | **200/hari** |
| Rute | 50/hari | **500/hari** |

Alasannya risiko NAT yang dicatat di bawah: satu IP venue bisa mewakili seluruh ruangan.
Batas per orang tetap 10 sesuai PRD §27.

### Rate limit HTTP global: sengaja TIDAK dibuat

Endpoint mahal (AI, routing) sudah punya kuota berbasis database, dan login sudah punya proteksi
sendiri. Rate limiter global berbasis memori praktis tidak berguna di Vercel — tiap instance
serverless punya memori sendiri, jadi batasnya terkalikan sebanyak instance yang hidup.
Kalau nanti benar-benar perlu, tempatnya di edge (Vercel Firewall), bukan di Express.

---

## Hasil verifikasi nyata di database (7 Okt 2026)

Dijalankan terhadap Supabase sungguhan, bukan simulasi.

| Ukuran | Hasil | Target PRD | |
|---|---|---|---|
| Fasilitas terpetakan | **113** | ~100 | tercapai |
| Fasilitas punya data aksesibilitas | **40 (35%)** | ≥70% | **belum** |
| Ruas pejalan kaki | 2094 (211 km) | — | — |
| Ruas bertag `wheelchair` | **6** | — | sangat tipis |
| Ruas tangga teridentifikasi | 76 | — | — |

Sebaran data aksesibilitas per kategori: Pendidikan 16/22, Kesehatan 8/26, Layanan Publik 8/22,
Komersial 6/27, Transportasi 2/16. **Transportasi dan Komersial paling kosong** — padahal itu dua
kategori yang paling sering dicari pengguna kursi roda. Kalau survei manual harus diprioritaskan,
mulai dari dua kategori ini.

`npm test` lolos penuh terhadap database ini: match, sorting, radius, crowdsourcing,
verifikasi admin, dan batas kepercayaan AI.

### Pipeline AI: terverifikasi dengan Gemini sungguhan

4 query Bahasa Indonesia diuji end-to-end dan benar semua:

| Perintah | Hasil |
|---|---|
| "Cari rumah sakit yang punya ramp dan toilet disabilitas di dekat saya" | `search_nearest_facility`, `category=kesehatan`, needs `[ramp, accessible_toilet]` → RS PMI Bogor 100% |
| "Saya pakai kursi roda, cari mall terdekat yang ada lift dan parkir disabilitas" | `search_nearest_facility`, `category=komersial`, needs `[wheelchair_path, lift, accessible_parking]` → Botani Square 100% |
| "Cari taman yang punya jalur kursi roda" | `search_facility`, `query=taman`, needs `[wheelchair_path]` → Taman Sempur 100% |
| "Cari tempat yang aksesibel" | **salah**: mengembalikan pencarian kosong, seharusnya `clarify` (PRD §17.5) |

Model `gemini-2.5-flash` valid. Instruksi sudah diperbaiki untuk kasus terakhir
(aturan + contoh eksplisit), **tapi perbaikan itu belum terverifikasi** karena kuota harian
Gemini free tier habis saat pengujian.

### Model Gemini: `gemini-3.5-flash-lite` (diubah 7 Okt 2026)

- `gemini-2.5-flash-lite` **sudah tidak tersedia untuk pengguna baru** — Google membalas 404
  dan menunjuk `gemini-3.5-flash-lite`. Inilah gunanya nama model ada di env.
- `gemini-3.5-flash-lite` dan `gemini-3.5-flash` keduanya aktif. Dipakai yang **lite**:
  kelima contoh perintah di PRD §16 dijawab benar, latensi 1,4–3,0 detik.
  Tugas kita cuma ekstraksi parameter dengan schema ketat di temperature 0 — model besar mubazir.

### Bug yang ditemukan saat uji model kecil, lalu ditutup secara struktural

Model kecil menaruh **jenis** tempat ("mall", "taman") ke dalam `query`, padahal `query`
memfilter **nama** fasilitas. Akibatnya "cari mall terdekat" membuang Botani Square — sebuah mall
yang namanya tidak mengandung kata "mall" — dan hanya menyisakan yang namanya kebetulan cocok.
Hasil benar tersaring diam-diam, dan sekilas terlihat seperti bug sorting (ternyata bukan:
`searchFacilities` benar, Botani Square 100% di peringkat satu kalau dipanggil langsung).

Prompt sudah melarangnya dan `gemini-2.5-flash` patuh, tapi model kecil tidak. Menambal lewat prompt
itu rapuh, jadi ditutup di kode: **kalau `category` sudah terisi, `query` diabaikan** — `category`
tervalidasi terhadap tabel kita, `query` cuma teks bebas. `query` tetap dipakai saat intent-nya
`get_facility_details` atau saat tidak ada kategori. Setelah perbaikan:

| Perintah | Hasil |
|---|---|
| "cari mall terdekat yang ada lift dan parkir disabilitas" | Botani Square **100%** di peringkat 1 |
| "Cari taman yang punya jalur kursi roda" | Taman Sempur 100% (query tetap dipakai, kategori null) |
| "Tunjukkan detail Stasiun Bogor" | Stasiun Bogor (query tetap dipakai) |

### Peringatan kuota Gemini (penting untuk hari demo)

Free tier Gemini habis setelah **~8 panggilan** dalam satu sesi pengujian. Kuota internal kita
10 query/user/hari jauh lebih longgar daripada kuota Google sendiri, jadi beberapa penonton yang
mencoba berbarengan bisa menghabiskannya di tengah penilaian.

Yang terbukti baik: 429 dari Google ditangani persis seperti rancangan — `503 + fallback:'search'`,
dan `/api/facilities` tetap 200. NFR-04 teruji di kondisi gagal yang nyata, bukan disimulasikan.

**Koreksi (7 Okt, setelah ditelusuri):** sebagian besar 429 yang terlihat ternyata berasal dari
**limiter kita sendiri**, bukan Google — baris `ai:ip:::1` di tabel `ai_usage` sudah mencapai 13.

### RISIKO HARI DEMO: kuota Guest dikunci per IP

`src/quota.js` memakai `ip:<alamat>` sebagai kunci untuk Guest. Di satu venue lomba, **semua juri
dan penonton berbagi satu IP publik lewat NAT**, jadi mereka berbagi jatah 10 query — habis dalam
satu-dua menit penilaian, dan AI akan terlihat rusak padahal berfungsi.

PRD §27 menulis "10 voice query/user/hari". Pengunci per IP adalah artefak implementasi yang
justru melanggar maksud itu saat banyak orang di satu jaringan. Sebelum demo, pilih:

1. **Naikkan batas Guest** (mis. 200/hari/IP) dan biarkan user login tetap 10. Satu konstanta.
2. Wajibkan login untuk AI — paling ketat, tapi menyalahi PRD §7 yang membolehkan Guest.
3. Biarkan, tapi minta juri mencoba lewat akun masing-masing.

Rekomendasi: opsi 1.

### Jawaban soal "beberapa API key Gemini"

Kuota Gemini dihitung **per project Google Cloud**, bukan per key. Beberapa key dari project yang
sama berbagi jatah yang sama — tidak menambah apa pun. Rotasi key baru berguna kalau key-nya
berasal dari project berbeda, dan itu menambah ~15 baris kode rotasi + retry.

Karena 429 kemarin ternyata dari limiter sendiri, dan `gemini-3.5-flash-lite` sudah jauh lebih
longgar, rotasi key **belum perlu**. Tinjau ulang kalau 429 asli dari Google benar-benar muncul lagi.

---

## Temuan penting dari import OSM (7 Okt 2026)

Hasil `npm run import:osm -- --dry`:

- OSM punya **1750 fasilitas** unik di bbox Kota Bogor — tapi **1327 di antaranya sekolah**,
  dan hanya **1%** punya tag aksesibilitas sama sekali. Import apa adanya = 1750 marker kosong.
- Karena itu importer memakai **kuota per kategori** (kesehatan 25, pendidikan 20, layanan publik 20,
  transportasi 15, komersial 25 = **105 fasilitas**) dan **skor prioritas** yang mengutamakan
  fasilitas yang sudah punya tag aksesibilitas. Hasilnya **26%** terisi — jauh lebih baik dari 1%,
  tapi masih di bawah target PRD.
- Tag OSM yang bisa dipetakan: `wheelchair`, `toilets:wheelchair`, `tactile_paving`, `ramp`,
  `elevator`, `capacity:disabled`, `braille`, `handrail`, `entrance:wheelchair`.
  `audio_access` tidak punya tag OSM yang andal → selalu `unknown`.
- `wheelchair=limited` dipetakan ke **`unknown`**, bukan `available`. Akses terbatas bukan akses tersedia.

**Konsekuensi untuk jadwal:** selisih 26% → 70% hanya bisa ditutup dengan pengisian data manual.
Itu sekitar **45–50 fasilitas × ~6 atribut ≈ 300 titik data**. Ini pekerjaan tim, bukan pekerjaan kode.
Sarannya: begitu endpoint crowdsourcing (Fase 2) jadi, pakai form itu sendiri untuk memasukkan data survei —
sekalian jadi bukti fitur crowdsourcing-nya bekerja saat demo.

Kabar baiknya: OSM juga **mengoreksi koordinat** 14 fasilitas seed yang saya isi dengan perkiraan
(beberapa meleset >1 km, misal RS PMI Bogor). Importer menimpa `location` untuk fasilitas yang namanya
sama dan belum punya `osm_id`; setelah itu baris tersebut tidak diutak-utik lagi, jadi koreksi manual
admin tidak akan tertimpa kalau import diulang.

---

## Cara jalanin (sekali setup)

1. Buat project di [supabase.com](https://supabase.com) → **Project Settings → Database → Connection string (URI)**.
2. `cd backend` lalu salin `.env.example` jadi `.env`, isi `DATABASE_URL` dan `JWT_SECRET`.
3. `npm install`
4. `npm run db:reset` — bikin tabel + seed + akun admin (`admin@akseskota.id` / `admin12345`)
5. `npm run import:osm` — tambah ~105 fasilitas dari OSM + koreksi koordinat seed.
   Pakai `npm run import:osm -- --dry` untuk lihat hasilnya tanpa menyentuh DB,
   atau `-- --all` untuk ambil semua 1750 (tidak disarankan).
6. `npm run import:ways` — ~2094 ruas pejalan kaki, dipakai skor aksesibilitas rute.
7. `npm run dev` → cek `http://localhost:3000/api/health`
8. `npm test` — tanpa `DATABASE_URL` cuma tes logika; dengan `DATABASE_URL` ikut tes
   query match, sorting, crowdsourcing, verifikasi admin, dan batas kepercayaan AI.

> Terminal proyek ini **Windows PowerShell 5.1**: `&&` tidak ada. Rangkai dengan
> `perintah1; if ($?) { perintah2 }`.

> PostGIS di Supabase: kalau `create extension postgis` ditolak, aktifkan dulu lewat
> dashboard **Database → Extensions → postgis**.
