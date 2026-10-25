<p align="center">
  <img src="logo_akseskota.jpeg" alt="Logo AksesKota" width="120">
</p>

<h1 align="center">AksesKota</h1>

<p align="center">
  <strong>Peta aksesibilitas fasilitas publik. Tahu dulu apakah sebuah tempat bisa diakses, sebelum Anda berangkat.</strong>
</p>

<p align="center">
  Responsive web · Berfokus pada Kota Bogor · React + Express + PostgreSQL/PostGIS
</p>

---

## Daftar isi

1. [Tentang AksesKota](#tentang-akseskota)
2. [Fitur](#fitur)
3. [Prinsip data](#prinsip-data)
4. [Teknologi](#teknologi)
5. [Struktur repositori](#struktur-repositori)
6. [Memulai](#memulai)
7. [Variabel lingkungan](#variabel-lingkungan)
8. [Mengisi data](#mengisi-data)
9. [Ringkasan API](#ringkasan-api)
10. [Model data](#model-data)
11. [Asisten AI](#asisten-ai)
12. [Pengujian](#pengujian)
13. [Deploy](#deploy)
14. [Aksesibilitas antarmuka](#aksesibilitas-antarmuka)
15. [Keamanan](#keamanan)
16. [Batasan dan non-goals](#batasan-dan-non-goals)
17. [Dokumen terkait](#dokumen-terkait)
18. [Kredit dan sumber data](#kredit-dan-sumber-data)

---

## Tentang AksesKota

Informasi aksesibilitas ruang publik di Indonesia masih minim dan tersebar. Aplikasi peta umum
bisa memberi tahu **di mana** sebuah tempat berada, tetapi jarang memberi tahu apakah tempat itu
punya ramp, guiding block, toilet aksesibel, lift, atau fasilitas lain yang benar-benar
dibutuhkan penggunanya.

> Jika peta umum membantu pengguna menemukan dan menuju suatu tempat, AksesKota membantu pengguna
> mengetahui **apakah tempat itu dapat diakses sesuai kebutuhan mereka** sebelum berkunjung.

Nilai utama produk:

| Nilai | Artinya |
|---|---|
| **Accessibility-first** | Informasi aksesibilitas adalah isi utama, bukan atribut tambahan. |
| **Personal** | Hasil dan warna penanda peta menyesuaikan kebutuhan masing-masing pengguna. |
| **Berbasis data spasial** | Fasilitas, rute, dan jangkauan dihitung di atas data geografis (PostGIS, jaringan pejalan kaki OSM). |
| **Dibantu AI, bukan dikarang AI** | Bahasa alami diubah menjadi pencarian atas database AksesKota. Model tidak bisa menyebut tempat atau atribut yang tidak ada di database. |
| **Digerakkan komunitas** | Data diperbarui lewat kontribusi dengan foto bukti, lalu diverifikasi admin. |

Target pengguna: pengguna kursi roda, tunanetra dan low vision, penyandang disabilitas daksa,
pendamping, dan masyarakat umum.

---

## Fitur

### Menjelajah

- **Peta interaktif** (Mapbox GL) dengan penanda berupa warna, ikon, dan label sekaligus, sehingga
  warna bukan satu-satunya penanda.
- **Pertanyaan pertama: "Apa yang Anda butuhkan?"** Pilih preset *kursi roda* atau
  *tunanetra / low vision* dalam satu ketukan, atau susun sendiri dari 10 atribut.
- **Accessibility Match**: tingkat kecocokan fasilitas terhadap kebutuhan pengguna, dengan label
  *Sangat Sesuai*, *Sebagian Sesuai*, *Kurang Sesuai*, dan *Data Terbatas*. Ini kecocokan
  terhadap kebutuhan, **bukan** sertifikasi atau jaminan keselamatan.
- **Pencarian dan filter** berdasarkan nama, kategori, kebutuhan, dan radius. Semua parameter
  tinggal di URL, jadi bisa di-refresh, dibagikan, dan mendukung tombol Back/Forward.
- **Detail fasilitas**: 10 atribut dengan status tersedia / tidak tersedia / belum diketahui,
  foto, ulasan, dan waktu verifikasi terakhir.
- **Daftar hasil** diurutkan berdasarkan kecocokan lalu jarak.

### Rute dan jangkauan

- **Rute jalan kaki** menuju fasilitas (Mapbox Directions). Skor rute dihitung **70%
  aksesibilitas jalur dan 30% jarak**.
- **Jangkauan nyata**: seberapa jauh seseorang benar-benar bisa bergerak dari satu titik dalam
  waktu tertentu. Dua jangkauan dihitung di atas jaringan pejalan kaki yang sama. Yang satu tanpa
  larangan, yang satu dengan tangga dan ruas bertanda tidak-dapat-dilalui dibuang. Selisih
  keduanya adalah temuan yang ditunjukkan. Asumsi kecepatan ditulis terbuka di kode:
  4,5 km/jam untuk jalan kaki dan 3,0 km/jam untuk kursi roda manual.
- **Lapisan jalur pejalan kaki**: ruas jalan diwarnai *hambatan* (tangga atau ditandai tidak
  dapat dilalui), *lolos* (terdata dapat dilalui atau ber-guiding block), dan *belum terdata*.
  Keabuan yang mendominasi peta adalah bagian dari pesannya: data aksesibilitas jalan memang
  belum lengkap.
- **Saran transportasi umum untuk jarak jauh**. Di atas 3 km, AksesKota menampilkan lin KRL, MRT,
  LRT, dan Transjakarta yang menghubungkan kedua titik, lengkap dengan data aksesibilitas stasiun
  naik dan turun. Tidak ada jadwal, tarif, atau waktu tempuh.

### Asisten AI

Percakapan teks dan suara untuk mencari tempat, meminta rekomendasi, dan membuat rute.
Rinciannya ada di bagian [Asisten AI](#asisten-ai).

### Kontribusi dan verifikasi

- **Tambah atau perbarui fasilitas** lewat form bertahap 5 langkah (nama, kategori, lokasi,
  atribut, foto bukti dan catatan). Pencarian alamat memakai Mapbox Geocoding.
- **Foto bukti wajib** bila atribut utama diisi selain *belum diketahui*.
- **Alur verifikasi**: kontribusi masuk berstatus `pending`, lalu diperiksa admin, lalu
  `approved` atau `rejected`. Data resmi **tidak langsung ditimpa**. Admin melihat nilai lama
  dibanding usulan (diff), foto, waktu, dan pengirim, lalu persetujuan diterapkan dalam satu
  transaksi.
- **Ulasan** (1 per pengguna per fasilitas) dan **laporan** data keliru, keduanya dimoderasi
  admin.
- **Profil aksesibilitas** tersimpan per akun dan otomatis dipakai peta dan asisten.
- **Kontribusi saya**: pantau status tiap usulan.

### Peran

| Peran | Akses |
|---|---|
| **Tamu** | Melihat peta, mencari, memfilter, membuka detail, membuat rute. Asisten dalam mode dasar. |
| **Pengguna** | Semua akses tamu, ditambah profil kebutuhan, kontribusi, ulasan, laporan, dan asisten AI penuh. |
| **Admin** | Memverifikasi kontribusi, menangani laporan, memoderasi ulasan. |

---

## Prinsip data

Aturan ini dijaga di skema database, di logika backend, dan di antarmuka:

1. **`unknown` tidak pernah dianggap `available`.** Atribut tanpa bukti tetap berstatus *belum
   diketahui*. Itu juga berlaku untuk data impor OpenStreetMap.
2. **Tidak ada skor aksesibilitas universal.** Atribut disimpan terpisah, dan yang dihitung adalah
   kecocokan terhadap kebutuhan masing-masing pengguna:

   `Accessibility Match = kebutuhan yang terpenuhi ÷ jumlah kebutuhan × 100%`

   Ambang label: ≥ 80% *Sangat Sesuai*, ≥ 50% *Sebagian Sesuai*, di bawahnya *Kurang Sesuai*.
   Bila separuh atau lebih kebutuhan pengguna berstatus *belum diketahui*, hasilnya *Data Terbatas*.
3. **Perhitungan ada di backend (SQL).** Frontend hanya menampilkan.
4. **Bukti sebelum data.** Atribut utama (`is_core`) butuh foto. Perubahan butuh persetujuan admin.
5. **Data bisa basi.** Fasilitas yang tidak diverifikasi lebih dari 180 hari ditandai
   `needs_reverification`. Fasilitas hasil impor OSM tanpa bukti lapangan memang ditandai
   demikian sejak awal.
6. **Data kosong dikatakan kosong.** Bila jaringan jalan tidak punya data, skor aksesibilitas rute
   adalah `null`, bukan "aman". Bila rute tidak ada, hasilnya nol opsi, bukan karangan.

Sepuluh atribut yang dipetakan: **Ramp, Guiding Block, Toilet Aksesibel, Lift, Parkir
Disabilitas, Jalur Kursi Roda** (atribut utama), serta **Braille, Akses Audio, Pintu Aksesibel,
Handrail**.

Kategori fasilitas: kesehatan, pendidikan, layanan publik, transportasi, serta komersial dan
rekreasi.

---

## Teknologi

| Lapisan | Pilihan |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS v4, React Router 6, TanStack Query, React Hook Form + Zod, Mapbox GL JS, Motion, Lucide dan Phosphor Icons |
| **Tipografi** | Bricolage Grotesque (judul dan teks utama), Atkinson Hyperlegible (teks keterangan) |
| **Backend** | Node.js, Express 5, `pg` (SQL murni), Zod, JWT (`jsonwebtoken` + `bcryptjs`), Multer |
| **Database** | PostgreSQL 16 + PostGIS (dihosting di Supabase) |
| **Penyimpanan foto** | Supabase Storage (produksi) atau folder lokal `backend/uploads/` (pengembangan) |
| **AI** | Google Gemini dengan function calling (`gemini-2.5-flash` secara bawaan) |
| **Suara** | Web Speech API peramban (suara ke teks dan teks ke suara) |
| **Peta dan rute** | Mapbox (tile, Directions, Geocoding) dan data OpenStreetMap |
| **Pengujian** | Skrip Node (`test/smoke.js`, `test/api.js`), Python + Playwright (e2e), axe (aksesibilitas) |

Keputusan teknis yang sengaja diambil: SQL murni dengan `pg` alih-alih ORM, karena kueri PostGIS
sulit diekspresikan lewat ORM. JWT sendiri alih-alih Supabase Auth, karena frontend cukup
mengirim Bearer token. Zod di setiap batas input.

---

## Struktur repositori

```
akseskota/
├── backend/                  Express + PostgreSQL/PostGIS
│   ├── api/index.js          entry point serverless (Vercel)
│   ├── db/
│   │   ├── schema.sql        skema lengkap
│   │   ├── seed.sql          kategori, atribut, 14 fasilitas Bogor, akun admin
│   │   ├── reset.js          bangun ulang skema + seed
│   │   ├── import-osm.js     impor fasilitas dari OpenStreetMap (Overpass)
│   │   ├── import-ways.js    impor jaringan pejalan kaki OSM
│   │   ├── import-transit.js impor lin dan pemberhentian KRL/MRT/LRT/Transjakarta
│   │   └── seed-demo.js      kontribusi contoh untuk mengisi antrean admin
│   ├── src/
│   │   ├── index.js          aplikasi Express, CORS, rate limit, error handler
│   │   ├── auth.js           register, login, me, middleware peran
│   │   ├── match.js          aturan Accessibility Match dan label
│   │   ├── transit.js        pencarian lin transit
│   │   ├── storage.js        penyimpanan foto + validasi magic bytes
│   │   ├── ai/               assistant.js, gemini.js, tools.js
│   │   └── routes/           facilities, me, contributions, feedback, admin,
│   │                         routing, ways, jangkauan, ai
│   └── test/                 smoke.js, api.js, gemini-stub.js, ai-eval.js
├── frontend/                 React + Vite + Tailwind v4
│   ├── e2e/                  e2e.py (Playwright), clean-test-data.sh
│   └── src/
│       ├── pages/            Explore, Home (landing), Auth, Profile, ContributionForm,
│       │                     MyContributions, Admin
│       ├── features/         accessibility, explore, map, ai, contribute
│       ├── components/       ui.jsx, status.jsx, layout/ (Public, Admin, Auth shell)
│       ├── context/          AuthContext, AppContexts
│       ├── hooks/            lokasi, suara, media query, kartu apung
│       └── lib/              api.js, url.js, geo.js, geocode.js, format.js
├── assets/                   gambar arsip jalanan Bogor + credits.json
├── AksesKota_PRD terbaruu.md Product Requirements Document
├── Arsitektur-Sistem-AksesKota.docx
├── PROGRESS.md               catatan kerja dan keputusan per fase
└── logo_akseskota.jpeg
```

Rincian struktur kode frontend, daftar URL, dan penjelasan komponen ada di
[`frontend/README.md`](frontend/README.md).

---

## Memulai

### Prasyarat

- **Node.js 22.9 atau lebih baru** (skrip memakai flag `--env-file-if-exists`)
- **PostgreSQL 16 dengan ekstensi PostGIS**. Supabase sudah menyediakannya. Bila
  `create extension postgis` ditolak, aktifkan lewat dashboard **Database → Extensions → postgis**.
- **Token publik Mapbox** (diawali `pk.`) agar peta tampil
- *Opsional:* kunci Gemini dari Google AI Studio, untuk asisten AI penuh
- *Opsional:* Python 3 + Playwright, untuk menjalankan pengujian e2e

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # isi DATABASE_URL dan JWT_SECRET (minimal 32 karakter)
npm run db:reset         # skema + seed 14 fasilitas Bogor + akun admin
npm run dev              # http://localhost:3000
```

Cek: `http://localhost:3000/api/health` harus membalas `{ "ok": true, ... }`.

Akun admin awal: **`admin@akseskota.id`** / **`admin12345`**. Ganti sebelum deploy.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # VITE_API_URL dan VITE_MAPBOX_TOKEN
npm run dev                  # http://localhost:5173
```

Tanpa token Mapbox, semua halaman tetap berfungsi. Peta hanya diganti panel petunjuk dan daftar
hasil tetap bisa dipakai.

Build produksi: `npm run build` (hasil di `dist/`), pratinjau dengan `npm run preview`.

### Skrip backend

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server dengan *watch mode* |
| `npm start` | Server tanpa watch |
| `npm run db:reset` | Hapus dan bangun ulang skema, seed, dan akun admin |
| `npm test` | Tes aturan match (ikut tes kueri bila `DATABASE_URL` ada) |
| `npm run test:api` | Tes alur lengkap terhadap server dan database sungguhan |
| `npm run import:osm` | Impor fasilitas dari OpenStreetMap |
| `npm run import:ways` | Impor jaringan pejalan kaki |
| `npm run import:transit` | Impor lin dan pemberhentian transit |
| `npm run seed:demo` | Isi antrean verifikasi dengan kontribusi contoh |
| `npm run eval:ai` | Harness evaluasi AI lama (lihat catatan di [Pengujian](#pengujian)) |

---

## Variabel lingkungan

### `backend/.env`

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | Ya | URI PostgreSQL. Di Supabase: *Project Settings → Database → Connection string*. |
| `JWT_SECRET` | Ya | String acak, minimal 32 karakter. |
| `PORT` | Tidak | Bawaan `3000`. |
| `CORS_ORIGIN` | Disarankan | URL frontend, pisahkan dengan koma. Bila kosong, bawaannya `*`. |
| `MAPBOX_TOKEN` | Untuk rute | Token **server**. Tanpa ini `/api/routes/walking` membalas 503 dan UI menampilkan pesan. |
| `GEMINI_API_KEY` | Untuk AI penuh | Dari Google AI Studio. Tanpa ini asisten memakai mode dasar. |
| `GEMINI_MODEL` | Tidak | Bawaan `gemini-2.5-flash`. |
| `AI_DAILY_LIMIT` | Tidak | Kuota percakapan AI per pengguna per hari, bawaan `30`. |
| `SUPABASE_URL` | Untuk produksi | Penyimpanan foto di Supabase Storage. |
| `SUPABASE_SERVICE_KEY` | Untuk produksi | Kunci layanan Supabase. |
| `SUPABASE_BUCKET` | Tidak | Bawaan `facility-photos`. Bucket harus **publik**. |
| `PUBLIC_URL` | Tidak | URL publik backend, dipakai untuk tautan foto lokal. |

Tanpa `SUPABASE_URL` dan `SUPABASE_SERVICE_KEY`, foto disimpan di `backend/uploads/` dan dilayani
lewat `/uploads`. Cukup untuk pengembangan, tidak untuk serverless.

### `frontend/.env.local`

| Variabel | Wajib | Keterangan |
|---|---|---|
| `VITE_API_URL` | Ya | URL backend **termasuk `/api`**, mis. `http://localhost:3000/api`. |
| `VITE_MAPBOX_TOKEN` | Ya, agar peta tampil | Token publik Mapbox (`pk....`). |

---

## Mengisi data

`npm run db:reset` sudah cukup untuk mencoba aplikasi (14 fasilitas Bogor). Untuk data yang lebih
luas, jalankan impor berikut. Semuanya aman diulang (idempoten) dan punya mode `--dry` untuk
melihat hasil tanpa menulis ke database.

```bash
cd backend
node --env-file-if-exists=.env db/import-osm.js --dry   # lihat dulu
npm run import:osm                                      # fasilitas dari OpenStreetMap
npm run import:ways                                     # jaringan pejalan kaki
npm run import:transit                                  # lin dan pemberhentian transit
npm run seed:demo                                       # kontribusi contoh untuk antrean admin
```

- **Cakupan impor**: Kota Bogor, DKI Jakarta, dan Kota Bandung (bounding box di
  `import-osm.js` dan `import-ways.js`).
- **Aturan impor OSM**: tag aksesibilitas yang tidak ada tetap `unknown`. Data OSM tidak ditandai
  terverifikasi karena belum ada bukti lapangan, sehingga tampil sebagai `needs_reverification`.
- **`seed:demo`** menambah akun dan kontribusi contoh (domain `demo.akseskota.test`, kata sandi ada di
  `db/seed-demo.js`) supaya dasbor admin tidak kosong saat demonstrasi. Skrip ini **tidak**
  melampirkan foto bukti, karena menempelkan gambar sembarang pada fasilitas nyata sama dengan
  mengarang bukti. Hapus kembali dengan `node --env-file-if-exists=.env db/seed-demo.js --bersihkan`.

---

## Ringkasan API

Semua endpoint berada di bawah `/api`. Validasi input memakai Zod. Galat dikembalikan sebagai
JSON `{ "error": "..." }`.

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/health` | Publik | Cek server |
| POST | `/auth/register`, `/auth/login` | Publik (40 per 15 menit) | Daftar dan masuk, mengembalikan JWT |
| GET | `/auth/me` | Login | Profil dan peran |
| GET | `/facilities` | Publik | Cari dan filter: `q`, `category`, `needs`, `lat`, `lon`, `radius`, `limit`. Diurutkan match lalu jarak |
| GET | `/facilities/:id` | Publik | Detail: 10 atribut, foto, ulasan, match |
| GET | `/categories`, `/attributes` | Publik | Referensi kategori dan atribut |
| GET, PUT | `/me/accessibility-profile` | Login | Profil kebutuhan |
| GET | `/me/contributions` | Login | Kontribusi milik sendiri |
| POST | `/contributions` | Login | Tambah atau ubah fasilitas (`multipart`: `payload` JSON + maks. 3 foto) |
| POST | `/facilities/:id/reviews` | Login | Ulasan (upsert 1 per pengguna) |
| POST | `/facilities/:id/reports` | Login | Laporan data keliru |
| GET | `/routes/walking?from=lon,lat&to=lon,lat&facility_id=` | Publik (30 per menit) | Rute jalan kaki + skor 70/30 + saran transit |
| GET | `/ways?bbox=` , `/ways/ringkasan` | Publik (60 dan 30 per menit) | Lapisan jalur pejalan kaki sebagai GeoJSON dan ringkasannya |
| GET | `/jangkauan?lon=&lat=&menit=` | Publik (20 per menit) | Jangkauan jalan kaki dan kursi roda dari satu titik |
| GET | `/ai/status` | Publik | Status asisten dan sisa kuota |
| POST | `/ai/chat` | Login (12 per menit) | Percakapan asisten |
| GET | `/admin/contributions`, `/admin/contributions/:id` | Admin | Antrean dan detail (disertai nilai lama untuk diff) |
| PATCH | `/admin/contributions/:id` | Admin | Setujui atau tolak (`status`, `review_note`) |
| GET, PATCH | `/admin/reports`, `/admin/reports/:id` | Admin | Tangani laporan |
| GET, DELETE | `/admin/reviews`, `/admin/reviews/:id` | Admin | Moderasi ulasan |

---

## Model data

PostgreSQL + PostGIS. Skema lengkap ada di `backend/db/schema.sql`.

| Tabel | Isi |
|---|---|
| `users` | Akun. Peran `user` atau `admin`. |
| `categories` | Kategori fasilitas. |
| `accessibility_attributes` | 10 atribut, penanda atribut utama (`is_core`), dan urutan. |
| `facilities` | Fasilitas dengan titik geografis, kategori, dan waktu verifikasi. |
| `accessibility_facilities` | Status tiap atribut per fasilitas: `available`, `not_available`, atau `unknown`. |
| `accessibility_profiles` | Kebutuhan tersimpan per pengguna. |
| `facility_photos` | Foto bukti. |
| `contributions` | Usulan tambah atau ubah (`create` / `update`), status `pending`, `approved`, atau `rejected`, catatan admin. |
| `reviews` | Rating 1 sampai 5 dan komentar. |
| `reports` | Laporan data keliru, status `open`, `resolved`, atau `dismissed`. |
| `ai_usage` | Pemakaian harian asisten per pengguna, dasar kuota. |
| `pedestrian_ways` | Ruas jaringan pejalan kaki OSM (tangga, kursi roda, tactile paving). |
| `transit_lines`, `transit_stops` | Lin dan pemberhentian KRL, MRT, LRT, Transjakarta. |

---

## Asisten AI

Tombol **Tanya asisten** di bilah atas membuka panel percakapan. Contoh pertanyaan: *"rekomendasikan
rumah sakit yang cocok untuk kursi roda"* atau *"buatkan rute ke Stasiun Bogor"*.

**Cara kerja**

- Backend memanggil **Gemini dengan function calling**. Model hanya boleh memakai empat alat yang
  membaca database: `search_facilities`, `get_facility_details`, `plan_route`, dan
  `recommend_facilities`.
- Aksi di antarmuka (menampilkan hasil, menggambar rute) ditentukan oleh **server** berdasarkan
  alat yang benar-benar dijalankan, bukan dari teks model. ID rekomendasi yang tidak pernah muncul
  dari database dibuang.
- Setiap jawaban menampilkan ringkasan **filter yang dipakai**, sehingga pengguna tahu bagaimana
  pertanyaannya ditafsirkan.
- Wajib login. Kuota harian `AI_DAILY_LIMIT` (bawaan 30) dicatat di `ai_usage`, dan jatah
  dikembalikan bila Gemini gagal.

**Suara**

- Bicara ke asisten (suara ke teks) dan dengarkan jawabannya (teks ke suara), keduanya memakai
  Web Speech API peramban.
- **Mode hands-free**: sekali ketuk, lalu asisten mendengar, menjawab dengan suara, dan mendengar
  lagi. Ucapkan *"berhenti"* untuk mengakhiri. Pengaturannya ada di panel **Opsi suara dan
  privasi** pada header asisten.

**Mode dasar (fallback)**

Tanpa `GEMINI_API_KEY`, bagi tamu yang belum login, atau saat Gemini error, asisten otomatis memakai
parser aturan di peramban (`frontend/src/features/ai/parseQuery.js`), lalu `GET /api/facilities`.
Fitur pencarian tetap hidup.

**Batasan yang jujur**

- Tidak ada *wake word* ("Hei AksesKota"). Peramban tidak bisa mendengar terus-menerus di latar
  belakang, jadi hands-free dimulai dengan satu ketukan.
- iOS Safari dapat memblokir suara yang diputar tanpa interaksi pengguna. Hands-free paling andal
  di Chrome atau Edge (Android dan desktop).
- Chrome mengirim audio ke layanan pengenalan suara Google. AksesKota sendiri tidak menyimpan
  rekaman.
- Suara bahasa Indonesia harus terpasang di perangkat agar pelafalan tepat.

---

## Pengujian

**Backend**

```bash
cd backend
npm test            # aturan match (dan kueri, bila DATABASE_URL tersedia)
npm run test:api    # alur lengkap: auth, profil, kontribusi, admin, ulasan, laporan, rute
```

`test:api` berjalan terhadap server dan database sungguhan (jalankan `db:reset` dulu). Mapbox
diganti server tiruan dan Gemini diganti `test/gemini-stub.js` yang meniru protokol
`generateContent` beserta function calling.

Untuk mencoba UI tanpa kunci Gemini sungguhan: jalankan `node test/gemini-stub.js`, lalu set
`GEMINI_API_KEY=apa-saja` dan `GEMINI_API_BASE=http://127.0.0.1:4998`.

**Frontend (end-to-end)**

```bash
cd frontend
python e2e/e2e.py               # Playwright, terhadap backend sungguhan
bash e2e/clean-test-data.sh     # jalankan sebelum mengulang
```

Mencakup 22 alur lewat peramban: beranda, filter lewat URL, detail, rute, penjaga login, profil,
asisten AI dan hands-free, form bertahap, verifikasi admin, ulasan, laporan, URL lama, dan tampilan
mobile. Audit aksesibilitas otomatis (axe) dijalankan pada 13 tampilan utama. Web Speech API ditiru
di e2e.

**Belum teruji**: Gemini sungguhan (nama model di `GEMINI_MODEL`, sesuaikan bila Google mengubah
daftar modelnya) dan kualitas jawabannya, peta Mapbox sungguhan, Mapbox Directions dan Geocoding
asli, Supabase Storage, serta mikrofon dan suara pada perangkat nyata.

**Catatan `eval:ai`**: berkas `test/ai-eval-results.json` adalah **arsip** pengukuran 7 Oktober
2026 terhadap parser niat lama (endpoint `/api/ai/query`, yang sudah tidak ada). Harness ini tidak
bisa mengukur asisten function-calling yang sekarang tanpa ditulis ulang, dan ada penjaga yang
menghentikan eksekusi bila endpoint lama tidak ditemukan.

---

## Deploy

Frontend dan backend dirancang untuk dideploy sebagai dua proyek terpisah (mis. di Vercel), dengan
database di Supabase.

- **Frontend** (`frontend/vercel.json`): semua rute diarahkan ke `index.html` (SPA). Atur
  `VITE_API_URL` dan `VITE_MAPBOX_TOKEN` di pengaturan proyek.
- **Backend** (`backend/vercel.json` + `backend/api/index.js`): semua rute diarahkan ke fungsi
  serverless Express.

Catatan penting untuk serverless:

1. **`DATABASE_URL` harus memakai *Transaction pooler* Supabase di port `6543`**, bukan `5432`.
   Serverless membuka banyak koneksi pendek dan port 5432 akan kehabisan kuota.
2. **`SUPABASE_URL` dan `SUPABASE_SERVICE_KEY` wajib diisi.** Tanpa itu foto disimpan di `./uploads`
   yang bersifat sementara di serverless, dan akan hilang.
3. **Isi `CORS_ORIGIN`** dengan domain frontend. Jangan dibiarkan kosong (bawaannya `*`).
4. Gunakan `JWT_SECRET` yang kuat, pakai HTTPS, dan **ganti kata sandi admin awal**.
5. Rate limit saat ini disimpan di memori per instance. Bila lebih dari satu instance berjalan,
   pindahkan ke penyimpanan bersama.
6. Buat bucket **publik** bernama `facility-photos` di Supabase Storage.

---

## Aksesibilitas antarmuka

Karena produk ini tentang aksesibilitas, antarmukanya sendiri dirancang untuk memenuhinya:

- **Warna bukan satu-satunya penanda.** Penanda peta dan status atribut memakai kombinasi warna,
  ikon, simbol (✓ ✕ ?), dan label teks.
- **Semantik dan navigasi keyboard**: struktur heading, label pada setiap kolom isian, elemen
  interaktif yang tepat (`button`, `a`, `role="switch"`), status fokus yang jelas, dan penutupan
  lapisan dengan `Escape`. Navigasi bawah dan navigasi atas menandai halaman aktif dengan
  `aria-current`.
- **Target sentuh** minimal 44 px untuk kontrol utama.
- **Pembaca layar**: area percakapan asisten memakai `role="log"`, status asisten diumumkan lewat
  `role="status"`, dan angka animasi hanya menyampaikan nilai akhirnya.
- **Mengurangi gerakan**: semua animasi menghormati `prefers-reduced-motion`. Animasi CSS dan
  transisi Motion dimatikan atau dipersingkat, dan animasi yang dikendalikan JavaScript membaca
  pengaturan yang sama.
- **Tipografi terbaca**: Atkinson Hyperlegible, huruf yang dirancang untuk keterbacaan bagi pembaca dengan low vision, dipakai untuk teks keterangan.
- **Responsif**: desktop, tablet, dan ponsel. Di ponsel, navigasi utama pindah ke bilah bawah.
- **Tanpa elemen yang hanya terlihat berfungsi**: pratinjau dekoratif tidak berbentuk tombol dan
  disembunyikan dari pembaca layar.

---

## Keamanan

- **Validasi foto di server**: tipe, ukuran (maks. 5 MB), jumlah (maks. 3), dan isi berkas
  (*magic bytes*), bukan sekadar ekstensi.
- **Peran dicek di Express** pada setiap endpoint admin.
- **Rate limit**: autentikasi 40 per 15 menit, rute 30 per menit, jangkauan 20 per menit, jalur 60
  per menit, AI 12 per menit, ditambah maksimal 20 kontribusi per pengguna per hari.
- **Kata sandi di-hash** dengan bcrypt. Sesi memakai JWT.
- **Tidak menyimpan jejak lokasi**: lokasi pengguna dipakai untuk menghitung jarak dan rute dan
  tidak disimpan permanen.
- Kunci server (`MAPBOX_TOKEN`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_KEY`) hanya ada di backend.
  Frontend hanya memakai token publik Mapbox.

---

## Batasan dan non-goals

AksesKota **tidak**:

- menjamin sebuah fasilitas 100% aman atau aksesibel bagi semua penyandang disabilitas. Match
  adalah kecocokan terhadap kebutuhan, bukan sertifikasi;
- menyediakan jadwal, tarif, atau waktu tempuh transportasi umum, dan tidak menghitung rute
  transit. Yang ditampilkan hanya lin yang menghubungkan dua titik beserta aksesibilitas
  stasiunnya;
- menjadi pengganti aplikasi navigasi umum;
- menyediakan dasbor khusus pengelola fasilitas atau pemerintah;
- membangun model AI sendiri atau menjawab dari pengetahuan di luar database AksesKota;
- menyimpan data GPS pengguna secara permanen.

Batasan teknis saat ini:

- Skor jarak rute memakai asumsi 100 dikurangi 10 poin per km. Asumsi ini tidak ada di PRD dan
  perlu ditinjau.
- Skor aksesibilitas rute dihitung dari atribut fasilitas tujuan yang diketahui dan data jaringan
  jalan. Bila datanya tidak ada, skornya `null`.
- Belum ada peta mini di halaman detail, dan belum ada instruksi rute langkah demi langkah
  (backend belum mengembalikan langkah dari Directions).
- Cakupan data masih terbatas dan terpusat di Kota Bogor. Impor tambahan mencakup Jakarta dan
  Bandung.

---

## Dokumen terkait

| Dokumen | Isi |
|---|---|
| [`AksesKota_PRD terbaruu.md`](AksesKota_PRD%20terbaruu.md) | Kebutuhan produk: tujuan, pengguna, konsep data, alur verifikasi |
| [`PROGRESS.md`](PROGRESS.md) | Catatan kerja backend dan keputusan per fase, termasuk temuan dan perbaikan |
| [`Arsitektur-Sistem-AksesKota.docx`](Arsitektur-Sistem-AksesKota.docx) | Arsitektur sistem |
| [`frontend/README.md`](frontend/README.md) | Struktur URL, struktur kode, dan komponen frontend |

---

## Kredit dan sumber data

- **OpenStreetMap** dan para kontributornya: data fasilitas, jaringan pejalan kaki, dan lin
  transit (lisensi ODbL). Peta dasar dan tile oleh **Mapbox**.
- **Google Gemini** untuk asisten AI.
- **Supabase** untuk PostgreSQL/PostGIS dan penyimpanan foto.
- **Gambar arsip jalanan Bogor** (Buitenzorg) di `assets/`, melalui Wikimedia Commons. Satu gambar
  dari Rijksmuseum berlisensi CC0. Tiga gambar lain dari koleksi KITLV berlisensi **CC BY 4.0**,
  yang mewajibkan atribusi. Judul, pembuat, lisensi, dan tautan sumber tiap gambar ada di
  [`assets/credits.json`](assets/credits.json), dan atribusi itu perlu ditampilkan bila gambarnya
  dipakai di antarmuka.
- **Bricolage Grotesque** dan **Atkinson Hyperlegible** lewat Fontsource.
- Data kontribusi pengguna tunduk pada proses verifikasi yang dijelaskan di atas.
