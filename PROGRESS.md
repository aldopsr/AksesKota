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
