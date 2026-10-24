# AksesKota

Pemetaan aksesibilitas fasilitas publik di Indonesia (PRD v2.0). Monorepo:

```
backend/    Express + PostgreSQL/PostGIS (JWT sendiri, tanpa Supabase Auth)
frontend/   React + Vite + Tailwind v4 + Motion
```

## Menjalankan (development)

**1. Backend**
```bash
cd backend
npm install
cp .env.example .env        # isi DATABASE_URL, JWT_SECRET (min. 32 karakter)
npm run db:reset            # skema + seed 14 fasilitas Bogor + akun admin
npm run dev                 # http://localhost:3000
```
Akun admin awal: `admin@akseskota.id` / `admin12345`. **Kata sandi ini ada di
repositori, jadi ia hanya untuk pengembangan lokal.** Sebelum (dan sesudah) deploy,
gantilah — kata sandinya diketik saat dijalankan dan tidak tersimpan di berkas mana pun:

```bash
cd backend && npm run admin:sandi
```

Database: PostgreSQL 17 dengan ekstensi PostGIS (Supabase sudah menyediakannya).

**2. Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local  # VITE_API_URL=http://localhost:3000/api, VITE_MAPBOX_TOKEN=pk....
npm run dev                 # http://localhost:5173
```
Tanpa token Mapbox semua halaman tetap berfungsi, hanya petanya diganti panel petunjuk (daftar hasil tetap bisa dipakai).

**Opsional di `backend/.env`:**
- `GEMINI_API_KEY` (dari Google AI Studio) untuk mengaktifkan asisten AI penuh; `GEMINI_MODEL`, `AI_DAILY_LIMIT` opsional.
  **`GEMINI_API_KEY` dan `GEMINI_MODEL` sama-sama boleh berisi daftar dipisah koma.** Tiap pasangan
  kunci-model dicoba bergiliran sampai ada yang menjawab; yang kehabisan kuota (429), ditolak (403/400),
  atau tidak tersedia untuk akun itu (404) dilewati, dan pasangan yang sehat diingat. Ini bukan kemewahan:
  free tier hanya **20 permintaan/hari dan 5/menit per model per akun**, sedangkan satu pertanyaan
  pengguna memakai 2–3 permintaan karena function calling. Kuota dihitung per model, jadi model cadangan
  menambah jatah pada kunci yang sama — terukur: saat `gemini-2.5-flash` sebuah akun sudah 429,
  `gemini-flash-lite-latest` pada kunci yang sama masih menjawab dalam 1,5 detik.
  Diuji di `npm run test:kunci` (9 kasus). **`npm run cek:gemini`** memeriksa tiap kunci di `.env`
  terhadap daftar model dan mencetak mana yang BISA — isi kuncinya tidak pernah dicetak.
  Terukur: akun lama bisa `gemini-2.5-flash` tapi 404 untuk `gemini-3.5-flash`, akun baru persis
  kebalikannya; karena itu daftar bawaannya memuat keduanya.
- `MAPBOX_TOKEN` agar rute jalan kaki berfungsi (tanpa ini `/api/routes/walking` membalas 503 dan UI menampilkan pesan).
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` untuk menyimpan foto di Supabase Storage (buat bucket **publik** `facility-photos`). Tanpa ini foto disimpan di `backend/uploads/` dan dilayani lewat `/uploads` (cukup untuk development).
- `CORS_ORIGIN` berisi URL frontend (pisahkan dengan koma).

## Fitur yang tersambung ke backend asli
| Fitur | Endpoint |
|---|---|
| Register, login, sesi (JWT di localStorage), role dari `/auth/me` | `/api/auth/*` |
| Peta, search, kategori, filter kebutuhan, urutan match lalu jarak | `GET /api/facilities` |
| Detail fasilitas: 10 atribut, foto, ulasan, match | `GET /api/facilities/:id` |
| Profil kebutuhan (otomatis dipakai di peta) | `GET/PUT /api/me/accessibility-profile` |
| Tambah/ubah fasilitas + foto bukti, status kontribusi | `POST /api/contributions`, `GET /api/me/contributions` |
| Admin: verifikasi (diff lama vs usulan), laporan, moderasi ulasan | `/api/admin/*` |
| Ulasan dan laporan | `POST /api/facilities/:id/reviews`, `.../reports` |
| Rute jalan kaki + skor 70/30 | `GET /api/routes/walking` |
| **Asisten AI** (percakapan, rekomendasi, rute, suara dua arah, hands-free) | `POST /api/ai/chat`, `GET /api/ai/status` (Gemini + function calling) |
| Mode dasar (tanpa login/AI): suara/teks | Web Speech API + parser aturan di browser, lalu `GET /api/facilities` |

## Keputusan dan catatan penting
- **Backend Fase 2, 4, dan 5 ditambahkan saat integrasi**, karena `PROGRESS.md` menandai fitur-fitur itu belum ada. Semuanya aditif; rincian di `PROGRESS.md`. Mohon direview tim backend sebelum merge.
- **Asisten AI memakai Gemini dengan function calling.** Model hanya bisa memanggil 4 alat yang membaca database (`search_facilities`, `get_facility_details`, `plan_route`, `recommend_facilities`), sehingga tidak bisa mengarang tempat atau atribut. Aksi di UI (tampilkan hasil, buat rute) ditentukan **server** dari alat yang benar-benar dijalankan, bukan dari teks model; ID rekomendasi yang tidak pernah muncul dari database dibuang. Wajib login, kuota harian `AI_DAILY_LIMIT` (default 30, tabel `ai_usage`), dan jatah dikembalikan bila Gemini gagal.
- **Cara pakai asisten:** tombol "Tanya asisten" di peta. Ketik atau bicara ("rekomendasikan rumah sakit yang cocok untuk kursi roda", "buatkan rute ke Stasiun Bogor"). Rute langsung dibuat dan digambar di peta. Jawaban bisa dibacakan (suara ke teks dan teks ke suara memakai Web Speech API peramban, gratis). **Mode hands-free**: sekali ketuk, lalu asisten mendengar, menjawab dengan suara, dan mendengar lagi; ucapkan "berhenti" untuk mengakhiri.
- **Tanpa `GEMINI_API_KEY`, belum login, atau Gemini error**, asisten otomatis memakai mode dasar (parser aturan di `frontend/src/features/ai/parseQuery.js`), jadi fitur pencarian tetap hidup.
- **Batasan jujur:** tidak ada *wake word* ("Hei AksesKota") karena browser tidak bisa mendengar terus-menerus di latar belakang; hands-free dimulai dengan satu ketukan. iOS Safari dapat memblokir suara yang diputar tanpa interaksi pengguna, jadi hands-free paling andal di Chrome/Edge (Android dan desktop). Chrome mengirim audio ke layanan pengenalan suara Google; AksesKota sendiri tidak menyimpan rekaman. Suara bahasa Indonesia harus terpasang di perangkat agar pelafalan pas.
- Skor kecocokan, label, dan urutan dihitung **backend** (SQL); frontend hanya menampilkan.
- Ambang rute: skor jarak = 100 - 10 poin per km (asumsi, tidak ada di PRD). Skor aksesibilitas rute dihitung dari atribut fasilitas tujuan yang diketahui.
- Keamanan: validasi tipe/ukuran/isi foto di server (magic bytes), role dicek di Express, rate limit auth 40/15 menit dan rute 30/menit, maks 20 kontribusi/hari. Untuk produksi: JWT_SECRET kuat, HTTPS, rate limit berbasis store bersama bila lebih dari satu instance.

## Pengujian
- Backend: `cd backend && npm test` (aturan match) dan `npm run test:api` (alur lengkap: auth, profil, kontribusi, admin, ulasan, laporan, rute, terhadap server dan DB sungguhan; Mapbox diganti server tiruan).
- Frontend: `frontend/e2e/e2e.py` (Python + Playwright) menjalankan 22 alur lewat browser terhadap backend sungguhan (beranda, filter via URL, detail, rute, guard login, profil, asisten AI + hands-free, form bertahap, verifikasi admin, ulasan, laporan, URL lama, mobile). Jalankan `e2e/clean-test-data.sh` sebelum mengulang. Audit aksesibilitas otomatis (axe) pada 13 tampilan utama tanpa pelanggaran.
- Pengujian AI memakai **Gemini tiruan** (`backend/test/gemini-stub.js`) yang meniru protokol generateContent + function calling; di e2e, Web Speech API juga ditiru.
- **Belum diuji:** Gemini sungguhan (nama model di `GEMINI_MODEL`, default `gemini-2.5-flash`; sesuaikan bila Google mengubah daftar modelnya), kualitas jawaban model, peta Mapbox sungguhan (butuh token), Mapbox Directions asli, Supabase Storage, dan mikrofon/suara pada perangkat nyata.

## Perombakan UI/UX
UI dirombak mengikuti `design_system_aksesKota_v0_2_0` dan `AksesKota_Web_IA_UX_Structure_v1_0` (lihat `frontend/README.md`). Yang berubah dari IA/DS perlu diketahui:
- **Pencarian AI memakai parameter URL**, bukan tombol "Terapkan" terpisah, supaya mode hands-free tetap mengalir; ringkasan "Filter yang dipakai" ditampilkan pada setiap jawaban.
- **Tamu** memakai mode dasar (parser aturan); asisten AI penuh wajib login karena kuota dan biaya dihitung per pengguna.
- **Belum dibuat:** peta mini di halaman detail dan instruksi rute berupa teks langkah demi langkah (backend belum mengembalikan langkah dari Directions). Pencarian alamat di form lokasi memakai Mapbox Geocoding dan **belum teruji** (butuh token).
- Backend: payload kontribusi menerima `note` (catatan kontributor) yang ditampilkan ke admin.
