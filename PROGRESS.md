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
- [ ] **Fase 2 — Accessibility Profile + Crowdsourcing + Admin verifikasi** (P0 no. 8–10, P1 no. 1)
- [ ] **Fase 3 — AI pipeline** (P0 no. 11–14): Gemini Flash → structured JSON → validasi → query PostGIS
- [ ] **Fase 4 — Routing** (P0 no. 15, P1 no. 5): proxy Mapbox Directions + route scoring 70/30
- [ ] **Fase 5 — Review, Report, rate limit, deploy** (P1 no. 3–4)

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
6. `npm run dev` → cek `http://localhost:3000/api/health`
7. `npm test` — tanpa `DATABASE_URL` cuma tes logika; dengan `DATABASE_URL` ikut tes query match & sorting.

> PostGIS di Supabase: kalau `create extension postgis` ditolak, aktifkan dulu lewat
> dashboard **Database → Extensions → postgis**.
