# AksesKota — Product Requirements Document (PRD)

**Versi:** 1.2  
**Status:** Draft MVP — Product & core technical decisions locked  
**Wilayah Fokus:** Kota Bogor, Jawa Barat  
**Target Demo/Submission:** 25 Oktober 2026  
**Platform:** Responsive Web  

---

## 1. Ringkasan Produk

**AksesKota** adalah platform berbasis web yang menyediakan pemetaan pintar untuk mendukung mobilitas dan inklusivitas penyandang disabilitas di ruang publik. Informasi mengenai aksesibilitas fasilitas publik, seperti ketersediaan ramp, guiding block, toilet disabilitas, lift, parkir disabilitas, jalur kursi roda, braille, dan akses audio, masih minim dan tersebar.

AksesKota memusatkan informasi tersebut melalui pemetaan spasial dan crowdsourcing. Produk juga memanfaatkan AI untuk memahami kebutuhan pengguna melalui input suara, mengubah bahasa alami menjadi parameter pencarian GIS, lalu menampilkan fasilitas dan/atau rute yang paling sesuai berdasarkan kebutuhan aksesibilitas pengguna.

### Positioning

> **Jika Google Maps membantu pengguna menemukan dan menuju suatu tempat, AksesKota membantu pengguna mengetahui apakah tempat tersebut dapat diakses sesuai kebutuhan mereka sebelum berkunjung.**

### Nilai Utama

1. **Accessibility-first:** informasi aksesibilitas menjadi informasi utama, bukan atribut tambahan.
2. **Personalized:** hasil disesuaikan dengan kebutuhan aksesibilitas pengguna.
3. **GIS-powered:** fasilitas dan rute diproses menggunakan data spasial.
4. **AI-assisted:** bahasa manusia dapat diterjemahkan menjadi pencarian GIS.
5. **Community-driven:** data dapat diperbarui melalui crowdsourcing dan diverifikasi admin.

---

## 2. Latar Belakang & Masalah

Pengguna dengan kebutuhan aksesibilitas sering menghadapi dua masalah utama:

- sulit menemukan fasilitas publik yang memiliki fasilitas aksesibel;
- sulit mengetahui kondisi aksesibilitas suatu tempat sebelum berkunjung.

Informasi yang tersedia pada layanan peta umum belum dirancang sebagai sumber informasi aksesibilitas yang terstruktur dan dipersonalisasi. Pengguna dapat mengetahui lokasi sebuah tempat, tetapi belum tentu dapat mengetahui apakah tempat tersebut memiliki ramp, guiding block, toilet aksesibel, lift, atau fasilitas lain yang relevan dengan kebutuhan mereka.

### Urgensi

BPS mencatat prevalensi disabilitas penduduk Indonesia berusia 5 tahun ke atas pada 2025 sebesar **2,17%**, sedangkan Jawa Barat sebesar **2,19%**. Untuk jenis kesulitan berjalan atau menaiki tangga, prevalensi nasional tercatat **0,95%** dan Jawa Barat **1,02%** pada 2025. Kondisi fasilitas publik juga belum sepenuhnya memenuhi kebutuhan aksesibilitas. Penelitian terhadap delapan fasilitas publik di Jakarta melaporkan tingkat kesesuaian aksesibilitas sekitar **50,52%–83%**, dengan persoalan antara lain pada tanda arah, pencahayaan, dan fasilitas pendukung navigasi.

Kondisi tersebut menunjukkan kebutuhan terhadap sistem yang dapat mengumpulkan, memetakan, memperbarui, dan menyajikan informasi aksesibilitas secara terstruktur.

---

## 3. Product Vision

> **Membantu setiap orang mengetahui aksesibilitas suatu ruang publik dan merencanakan perjalanan berdasarkan kebutuhan aksesibilitasnya.**

Untuk MVP, AksesKota berfokus pada **Kota Bogor** dan tidak mengklaim cakupan nasional.

---

## 4. Product Goals

### Primary Goals

1. Memudahkan pengguna menemukan fasilitas publik yang sesuai dengan kebutuhan aksesibilitas.
2. Menyediakan informasi kondisi aksesibilitas fasilitas sebelum pengguna berkunjung.
3. Memungkinkan pencarian menggunakan bahasa alami melalui suara.
4. Menghasilkan rekomendasi fasilitas berdasarkan kecocokan kebutuhan dan jarak.
5. Menyediakan rute menuju fasilitas dengan mempertimbangkan informasi aksesibilitas yang tersedia.
6. Membentuk basis data aksesibilitas yang dapat diperbarui melalui kontribusi masyarakat.

### Secondary Goals

1. Meningkatkan kualitas informasi aksesibilitas ruang publik di Kota Bogor.
2. Mendorong partisipasi masyarakat dalam pemutakhiran data.
3. Menyiapkan fondasi data yang pada tahap berikutnya dapat dimanfaatkan untuk analisis aksesibilitas perkotaan.

---

## 5. Non-Goals / Batasan Produk

AksesKota MVP **tidak**:

- menyediakan integrasi transportasi umum;
- menjadi pengganti Google Maps atau aplikasi navigasi umum;
- menjamin suatu fasilitas 100% aman atau aksesibel bagi seluruh penyandang disabilitas;
- menyediakan dashboard khusus pengelola fasilitas atau pemerintah;
- menghasilkan penilaian universal bahwa suatu tempat “bagus/buruk” untuk semua pengguna;
- membangun model AI sendiri dari nol;
- menghasilkan jawaban AI yang bersumber dari pengetahuan bebas di luar basis data AksesKota;
- menyimpan data GPS pengguna secara permanen.

---

## 6. Target Pengguna

### 6.1 Pengguna Kursi Roda

Kebutuhan utama: ramp, lift, jalur kursi roda, toilet aksesibel, parkir aksesibel, dan jalur tanpa hambatan.

### 6.2 Tunanetra / Low Vision

Kebutuhan utama: guiding block/tactile paving, informasi braille, akses audio, dan informasi orientasi yang relevan.

### 6.3 Penyandang Disabilitas Daksa

Kebutuhan utama: jalur aksesibel, ramp, lift, pintu yang dapat dilewati, toilet, dan hambatan fisik yang minimal.

### 6.4 Pendamping

Membantu memastikan tempat tujuan dan kondisi aksesibilitas sesuai dengan kebutuhan pengguna yang didampingi.

### 6.5 Masyarakat Umum

Mencari fasilitas publik yang lebih mudah diakses, membantu anggota keluarga, atau berkontribusi terhadap pembaruan data.

---

## 7. Role & Permission

| Role | Akses |
|---|---|
| **Guest** | Melihat peta, mencari fasilitas, menggunakan filter, menggunakan AI, melihat detail, membuat rute |
| **User/Contributor** | Semua akses Guest + menambah/memperbarui data, upload foto, review/rating, report data |
| **Admin** | Mengelola fasilitas, memverifikasi kontribusi, menangani laporan, mengelola kategori dan data |

### Authentication

Login **tidak wajib** untuk eksplorasi dasar. Login diperlukan untuk fitur yang mengubah data atau menyimpan aktivitas pengguna, seperti kontribusi, review, report, dan profil kebutuhan aksesibilitas.

---

## 8. Konsep Data Aksesibilitas

AksesKota tidak menggunakan satu skor aksesibilitas universal sebagai penilaian mutlak. Sistem menyimpan atribut fasilitas secara terpisah dan menghitung **Accessibility Match** berdasarkan kebutuhan pengguna.

### 8.1 Atribut Accessibility MVP

- Ramp
- Guiding block / tactile paving
- Toilet aksesibel
- Lift
- Parkir disabilitas
- Jalur kursi roda
- Braille
- Akses/informasi audio
- Pintu/entrance aksesibel
- Handrail

### 8.2 Nilai Atribut

Setiap atribut menggunakan tiga keadaan utama:

- `available` — tersedia berdasarkan data terverifikasi;
- `not_available` — tidak tersedia berdasarkan data terverifikasi;
- `unknown` — belum diketahui / belum cukup bukti.

**Unknown tidak boleh dianggap sebagai available.**

### 8.3 Accessibility Match

Accessibility Match adalah tingkat kecocokan suatu fasilitas dengan kebutuhan aksesibilitas pengguna.

Rumus MVP:

`Accessibility Match = jumlah kebutuhan pengguna yang terpenuhi / jumlah kebutuhan pengguna × 100%`

Contoh:

Pengguna membutuhkan ramp, lift, toilet aksesibel, dan parkir aksesibel. 3 dari 4 tersedia → **Accessibility Match = 75%**.

Nilai ini adalah **kecocokan terhadap kebutuhan pengguna**, bukan jaminan keselamatan atau sertifikasi aksesibilitas.

---

## 9. User Accessibility Profile

Pengguna yang login dapat menyimpan preferensi kebutuhan aksesibilitas.

Contoh:

- Akses kursi roda
- Membutuhkan toilet aksesibel
- Membutuhkan lift
- Membutuhkan guiding block
- Membutuhkan informasi audio
- Membutuhkan braille

Profil ini dapat digunakan AI dan sistem pencarian untuk mempersonalisasi hasil.

Pengguna tetap dapat mengubah atau menonaktifkan profil sebelum pencarian tertentu.

---

## 10. Fasilitas yang Dipetakan

Kategori fasilitas MVP:

1. Kesehatan — rumah sakit, puskesmas, klinik.
2. Pendidikan — sekolah, perguruan tinggi.
3. Layanan publik — kantor pemerintahan dan layanan publik.
4. Transportasi — stasiun, halte, terminal.
5. Komersial & rekreasi — mall, taman, tempat wisata.

Kategori dapat diperluas setelah MVP.

---

## 11. Sumber Data

AksesKota menggunakan kombinasi tiga sumber utama.

### 11.1 OpenStreetMap

Untuk base map, data jalan/pedestrian dan POI yang tersedia, serta atribut aksesibilitas yang dipetakan dalam OSM.

### 11.2 Open Data Kota Bogor

Untuk data fasilitas publik dan data sektoral yang tersedia pada portal data terbuka pemerintah Kota Bogor.

### 11.3 Crowdsourcing AksesKota

Untuk atribut aksesibilitas lapangan, foto, koreksi, dan pembaruan yang tidak tersedia atau belum lengkap pada sumber awal.

### 11.4 Target Dataset MVP

MVP menargetkan sekitar **100 fasilitas publik di Kota Bogor** sebagai dataset awal. Komposisi awal dapat disebar pada kategori kesehatan, pendidikan, layanan publik, transportasi, serta komersial/rekreasi.

Setiap fasilitas ditargetkan memiliki minimal **5 atribut aksesibilitas utama** terisi atau berstatus `unknown`. Target kualitas awal adalah minimal **70% fasilitas memiliki data aksesibilitas terisi**.

### Prinsip Data

- Data pihak ketiga menjadi data dasar, bukan satu-satunya sumber accessibility data.
- Informasi aksesibilitas yang diberikan pengguna membutuhkan bukti foto untuk perubahan/penambahan atribut utama.
- Kontribusi masuk status `pending` sebelum menjadi data resmi.
- Data kosong atau belum diketahui harus disimpan sebagai `unknown`, bukan diasumsikan aksesibel.

---

## 12. Crowdsourcing & Data Verification

### 12.1 Tambah Fasilitas

User/Contributor dapat:

- mengisi nama fasilitas;
- memilih kategori;
- menentukan titik lokasi;
- mengisi atribut aksesibilitas;
- mengunggah foto;
- menambahkan catatan kondisi.

### 12.2 Update Fasilitas

Contributor dapat mengusulkan perubahan atribut yang sudah ada.

### 12.3 Verification Flow

`Submitted → Pending → Admin Review → Approved / Rejected`

### 12.4 Konflik Data

Data lama tidak langsung ditimpa ketika ada laporan baru. Perubahan harus melalui proses verifikasi admin.

Admin dapat melihat:

- nilai sebelumnya;
- nilai usulan;
- foto/bukti;
- waktu pengajuan;
- akun pengirim;
- riwayat perubahan.

### 12.5 Data Staleness

Setiap fasilitas menyimpan timestamp pembaruan/verifikasi terakhir. Data yang sudah lama tidak diverifikasi dapat diberi status seperti:

- `verified_recently`
- `needs_reverification`

MVP tidak wajib menghapus data lama secara otomatis.

---

## 13. Fitur Peta

Peta adalah antarmuka utama AksesKota.

### User dapat:

- melihat fasilitas publik;
- mencari tempat berdasarkan nama/kategori;
- memfilter fasilitas berdasarkan kebutuhan aksesibilitas;
- melihat Accessibility Match;
- membuka detail fasilitas;
- melihat foto dan review;
- menentukan titik asal;
- membuat rute menuju fasilitas.

### Marker

Marker menggunakan kombinasi **warna, ikon, dan label**. Warna tidak menjadi satu-satunya indikator agar informasi tetap dapat dipahami oleh pengguna dengan keterbatasan penglihatan.

Status marker MVP:

- **Hijau** — match tinggi / sangat sesuai
- **Kuning/oranye** — match sebagian
- **Merah** — match rendah
- **Abu-abu** — data terbatas

Label yang digunakan: **Sangat Sesuai**, **Sebagian Sesuai**, **Kurang Sesuai**, dan **Data Terbatas**.

---

## 14. Facility Detail

Ketika pengguna memilih fasilitas, sistem menampilkan:

```text
Nama fasilitas
Kategori
Accessibility Match terhadap profil pengguna

Ramp                 ✓ / ✗ / ?
Guiding Block        ✓ / ✗ / ?
Toilet Aksesibel     ✓ / ✗ / ?
Lift                 ✓ / ✗ / ?
Parkir Disabilitas   ✓ / ✗ / ?
Jalur Kursi Roda     ✓ / ✗ / ?
Braille              ✓ / ✗ / ?
Akses Audio          ✓ / ✗ / ?

Foto
Rating / review
Terakhir diperbarui
```

`✓` = available, `✗` = not available, `?` = unknown.

---

## 15. Search & Filtering

### Search biasa

User dapat mencari berdasarkan:

- nama fasilitas;
- kategori;
- lokasi.

### Accessibility Filter

User dapat memilih satu atau beberapa kebutuhan, misalnya:

- Ramp
- Jalur kursi roda
- Toilet aksesibel
- Lift
- Guiding block
- Parkir disabilitas
- Braille
- Akses audio

Sistem mengurutkan hasil berdasarkan:

1. Accessibility Match;
2. jarak.

Prioritas utama adalah kecocokan aksesibilitas, kemudian jarak. Hasil diurutkan menggunakan Accessibility Match secara menurun, lalu jarak secara menaik.

---

## 16. AI Assistant

### Tujuan

AI membantu pengguna mencari fasilitas dan rute menggunakan bahasa sehari-hari. AI bukan knowledge chatbot umum.

### Input utama

**Voice input**.

Text input dapat tetap tersedia sebagai fallback.

### Bentuk UI

AI tersedia sebagai **floating button** pada halaman peta.

### Contoh perintah

- “Cari rumah sakit yang punya ramp dan toilet disabilitas di dekat saya.”
- “Saya menggunakan kursi roda. Cari mall terdekat yang punya lift, ramp, dan parkir disabilitas.”
- “Cari fasilitas kesehatan yang aksesibel dalam radius dua kilometer dari Stasiun Bogor.”
- “Cari taman yang memiliki jalur kursi roda.”
- “Tunjukkan rute dari lokasi saya ke tempat yang punya toilet disabilitas.”
- “Cari fasilitas publik yang punya guiding block dan akses audio.”

---

## 17. AI Processing Flow

Arsitektur utama:

`Voice → Speech-to-Text → LLM → Structured JSON → Backend Validation → Database/PostGIS Query → GIS Result → UI`

### 17.1 Speech-to-Text

Audio pengguna diubah menjadi teks menggunakan layanan speech-to-text eksternal.

Rekomendasi awal: **Google Cloud Speech-to-Text** dengan Bahasa Indonesia `id-ID`.

### 17.2 LLM / Natural Language Understanding

LLM menerima teks dan menghasilkan structured JSON yang sesuai schema yang ditentukan aplikasi.

Contoh:

```json
{
  "intent": "search_facility",
  "facility_type": "mall",
  "origin": "user_location",
  "radius_m": 2000,
  "accessibility_requirements": [
    "ramp",
    "accessible_toilet"
  ]
}
```

### 17.3 AI Function / Intent Types MVP

Minimal mendukung:

- `search_facility`
- `search_nearest_facility`
- `get_facility_details`
- `generate_route`

### 17.4 Source of Truth

LLM **tidak boleh menjadi sumber informasi fasilitas**.

LLM hanya menerjemahkan maksud user menjadi parameter terstruktur. Seluruh informasi fasilitas, accessibility status, foto, dan hasil data harus berasal dari database AksesKota.

### 17.5 Clarification

Jika parameter penting tidak dapat ditentukan, AI boleh bertanya maksimal 1–2 pertanyaan klarifikasi.

Contoh:

`User: “Cari tempat yang aksesibel.”`

`AI: “Tempat apa yang ingin Anda cari?”`

Setelah intent cukup jelas, AI menjalankan query tanpa percakapan panjang.

---

## 18. Personalized AI

AI dapat menggunakan accessibility profile pengguna.

Contoh:

Profil:

`wheelchair + accessible_toilet + lift`

Perintah:

`“Cari mall dekat sini.”`

AI dapat menghasilkan kebutuhan pencarian:

```json
{
  "intent": "search_nearest_facility",
  "facility_type": "mall",
  "origin": "user_location",
  "accessibility_requirements": [
    "wheelchair_path",
    "accessible_toilet",
    "lift"
  ]
}
```

---

## 19. Routing

### 19.1 Titik Asal

User dapat menentukan asal melalui:

- lokasi pengguna saat ini;
- klik titik pada peta;
- hasil pencarian.

Lokasi dapat digunakan saat sesi aktif tetapi tidak wajib disimpan sebagai data permanen.

### 19.2 Tujuan

Tujuan dapat berasal dari:

- hasil pencarian;
- marker fasilitas;
- hasil AI.

### 19.3 Moda Transportasi

MVP hanya berfokus pada **walking route**.

Transportasi umum dan multi-modal routing berada di luar scope MVP.

### 19.4 Definisi Rute Aksesibel

> Rute aksesibel adalah rute yang diprioritaskan menggunakan informasi aksesibilitas jaringan/jalur yang diketahui oleh sistem. Rute tidak dianggap sebagai jaminan bahwa seluruh perjalanan bebas hambatan.

### 19.5 Data Hambatan yang Diusahakan untuk Digunakan

Jika tersedia pada dataset jalan/pedestrian:

- keberadaan sidewalk/trotoar;
- wheelchair access;
- tactile paving;
- kerb;
- incline;
- surface;
- smoothness;
- width;
- crossing;
- barrier.

Data yang tidak tersedia harus diberi status `unknown`, bukan diasumsikan aksesibel.

### 19.6 Routing Engine

Rekomendasi MVP: **Mapbox Directions** untuk baseline walking route. Implementasi routing engine khusus seperti Valhalla dapat menjadi opsi lanjutan apabila dibutuhkan.

### 19.7 Route Scoring

Untuk MVP, kandidat rute diberi skor dengan bobot tetap:

`Route Score = Accessibility Score × 70% + Distance Score × 30%`

Accessibility menjadi komponen utama. Data aksesibilitas yang berstatus `unknown` tidak boleh dianggap `not_available`; sistem hanya menggunakan informasi yang memang diketahui.

---

## 20. Review & Rating

User/Contributor dapat memberikan:

- rating pengalaman;
- review singkat;
- foto tambahan.

Rating **tidak digunakan sebagai Accessibility Match**. Keduanya ditampilkan sebagai informasi berbeda:

- **Accessibility Match:** kecocokan terhadap kebutuhan pengguna;
- **Rating:** pengalaman pengguna terhadap fasilitas.

---

## 21. Reporting

User/Contributor dapat melaporkan:

- data tidak sesuai kondisi lapangan;
- fasilitas sudah tidak tersedia;
- atribut aksesibilitas tidak sesuai;
- foto tidak relevan;
- konten review bermasalah.

Semua laporan masuk ke Admin untuk diproses.

---

## 22. Halaman / Screen MVP

1. Landing / Home
2. Map
3. Facility Detail
4. AI Assistant overlay
5. Login
6. Register
7. Accessibility Profile
8. Add Facility
9. Update Facility
10. Review / Report
11. Admin Dashboard
12. Admin Verification Detail

---

## 23. User Flow Utama

### 23.1 Find Facility

`Home → Map → Search/Filter → Result → Facility Detail → Route`

### 23.2 AI Voice Search

`Map → Floating AI Button → Record Voice → Speech-to-Text → AI/NLU → Structured JSON → GIS Query → Result → Facility Detail / Route`

### 23.3 Accessibility Route

`Facility Detail → “Ke Sini” → Set Origin → Generate Route → Accessibility + Distance Scoring → Display Route`

### 23.4 Crowdsourcing

`Login → Add/Update Facility → Fill Accessibility Data → Upload Photo → Submit → Pending → Admin Review → Approved/Rejected`

### 23.5 Data Report

`Facility Detail → Report → Select Issue → Evidence/Description → Submit → Admin Review`

---

## 24. Functional Requirements

### FR-01 Authentication

System harus dapat membedakan Guest, User/Contributor, dan Admin.

### FR-02 Map Display

System harus menampilkan peta Kota Bogor dan fasilitas publik yang tersedia dalam database.

### FR-03 Facility Search

System harus menyediakan pencarian berdasarkan nama, kategori, dan lokasi.

### FR-04 Accessibility Filtering

System harus menyediakan filter berdasarkan atribut aksesibilitas.

### FR-05 Accessibility Profile

User login dapat menyimpan dan mengubah kebutuhan aksesibilitas.

### FR-06 Accessibility Match

System harus menghitung kecocokan fasilitas terhadap kebutuhan pengguna.

### FR-07 Facility Detail

System harus menampilkan informasi fasilitas dan seluruh atribut aksesibilitas yang tersedia.

### FR-08 Photo Evidence

Kontributor wajib mengunggah minimal satu foto untuk penambahan/perubahan data aksesibilitas utama.

### FR-09 Crowdsourcing

User/Contributor dapat menambah dan mengusulkan perubahan data fasilitas.

### FR-10 Verification

Admin harus dapat menerima atau menolak kontribusi.

### FR-11 Review

User/Contributor dapat memberikan rating dan review.

### FR-12 Report

User/Contributor dapat melaporkan data yang tidak sesuai.

### FR-13 Voice Input

User dapat memasukkan perintah pencarian melalui suara.

### FR-14 Speech-to-Text

System harus mengubah input suara Bahasa Indonesia menjadi teks.

### FR-15 AI Intent Parsing

System harus mengubah teks natural-language menjadi structured JSON sesuai schema yang ditentukan.

### FR-16 GIS Query

Backend harus memvalidasi structured JSON sebelum menjalankan query database/GIS.

### FR-17 AI Clarification

AI dapat meminta klarifikasi apabila parameter penting tidak lengkap atau ambigu.

### FR-18 Route Generation

System harus dapat menghasilkan walking route berdasarkan titik asal dan tujuan.

### FR-19 Route Accessibility

System harus dapat memprioritaskan kandidat rute berdasarkan data aksesibilitas yang tersedia.

### FR-20 Data Freshness

System harus mencatat waktu pembaruan/verifikasi terakhir sebuah fasilitas.

---

## 25. Non-Functional Requirements

### NFR-01 Responsiveness

Website harus dapat digunakan pada desktop, tablet, dan smartphone.

### NFR-02 Accessibility

Antarmuka harus menerapkan prinsip aksesibilitas dasar, termasuk:

- kontras yang memadai;
- navigasi keyboard;
- label elemen form yang jelas;
- ukuran target interaksi yang memadai;
- tidak bergantung hanya pada warna;
- alternatif teks untuk konten penting.

### NFR-03 Performance

Pencarian fasilitas dan pembukaan detail harus terasa responsif pada koneksi internet umum.

### NFR-04 Reliability

Kegagalan layanan AI eksternal tidak boleh membuat fitur peta dasar berhenti bekerja.

### NFR-05 Security

- autentikasi harus aman;
- hak akses admin harus dibatasi;
- input user harus divalidasi;
- API key layanan eksternal tidak boleh dikirim ke browser secara langsung jika tidak diperlukan;
- upload foto harus divalidasi tipe dan ukuran file.

### NFR-06 Data Integrity

Perubahan data crowdsourcing harus memiliki status dan riwayat verifikasi.

---

## 26. Data Model Awal

### facilities

- `id`
- `name`
- `category_id`
- `address`
- `location` (Point)
- `description`
- `accessibility_match_cache` (opsional, dapat dihitung on-demand)
- `last_verified_at`
- `created_at`
- `updated_at`

### accessibility_facilities

- `id`
- `facility_id`
- `attribute_code`
- `status` (`available`, `not_available`, `unknown`)
- `notes`
- `verified_by`
- `verified_at`

### accessibility_profiles

- `id`
- `user_id`
- `attribute_code`
- `is_required`

### facility_photos

- `id`
- `facility_id`
- `uploaded_by`
- `url/path`
- `caption`
- `created_at`

### contributions

- `id`
- `facility_id`
- `submitted_by`
- `change_type`
- `payload`
- `status`
- `reviewed_by`
- `reviewed_at`
- `created_at`

### reviews

- `id`
- `facility_id`
- `user_id`
- `rating`
- `content`
- `created_at`

### reports

- `id`
- `facility_id`
- `reported_by`
- `report_type`
- `description`
- `status`
- `resolved_by`
- `resolved_at`

---

## 27. Technical Architecture

Arsitektur berikut menjadi baseline implementasi MVP. Tiga keputusan teknis utama sudah ditetapkan: **React** untuk frontend, **Express.js** untuk backend/API, dan **Google Gemini Flash** sebagai provider LLM. Provider storage foto masih dapat dipilih berdasarkan kebutuhan biaya, kemudahan integrasi, dan batasan deployment.

| Layer | Recommendation |
|---|---|
| Frontend | **React** (Vite dapat digunakan sebagai build tool) |
| Map | Mapbox GL JS |
| Backend | **Node.js + Express.js REST API** |
| Database | PostgreSQL + PostGIS |
| Base geographic data | OpenStreetMap |
| Local public data | Open Data Kota Bogor |
| Speech-to-Text | Google Cloud Speech-to-Text |
| LLM | **Google Gemini Flash** dengan structured output / function calling |
| Routing | Mapbox Directions |
| File Storage | Object storage / managed storage — **provider masih terbuka** |

### API Usage Policy MVP

- AI/LLM hanya dipanggil untuk voice atau natural-language search, bukan pencarian biasa.
- Speech input dibatasi secara internal untuk menjaga penggunaan API tetap terkendali. Target awal: **maksimal 30 detik per voice query** dan **maksimal 10 voice query/user/hari**.
- Baseline Mapbox menggunakan free tier/provider quota yang tersedia; AksesKota tetap memasang rate limit internal.
- Target guardrail awal: **≤ 5.000 Directions requests/bulan**.
- Pricing provider tidak ditanamkan sebagai angka permanen dalam PRD karena dapat berubah; keputusan provider dan quota produksi final ditetapkan saat konfigurasi deployment.

---

## 28. MVP Scope Prioritization

### P0 — Must Have

1. Peta Kota Bogor.
2. Database fasilitas publik.
3. Accessibility attributes.
4. Facility detail.
5. Search.
6. Accessibility filter.
7. Accessibility Match.
8. Crowdsourcing add/update.
9. Photo evidence.
10. Admin verification.
11. Voice input.
12. Speech-to-Text.
13. AI → structured JSON.
14. GIS query dari hasil AI.
15. Walking route dasar.

### P1 — Should Have

1. Accessibility profile.
2. Personalized AI berdasarkan profile.
3. Review/rating.
4. Report.
5. Route accessibility scoring.
6. AI clarification.
7. Text-to-Speech.

### P2 — Could Have / Future

1. Dashboard pemerintah.
2. Integrasi transportasi umum.
3. Multi-modal routing.
4. Gamification.
5. Computer vision untuk validasi foto.
6. Predictive accessibility.
7. Analitik tingkat kota.

---

## 29. Success Metrics

### Product Metrics

- jumlah fasilitas yang berhasil dipetakan;
- persentase fasilitas dengan data aksesibilitas lengkap;
- jumlah kontribusi pengguna;
- persentase kontribusi yang disetujui;
- jumlah pencarian fasilitas;
- jumlah penggunaan AI;
- jumlah rute yang dibuat.

### AI Metrics

MVP harus diuji dengan dataset query buatan tim sebanyak minimal 50–100 contoh perintah Bahasa Indonesia.

Target awal:

- ≥ 90% intent berhasil dikenali;
- ≥ 90% parameter penting berhasil diekstrak;
- ≥ 90% query menghasilkan structured JSON valid;
- query AI tidak menghasilkan informasi fasilitas yang tidak ada di database.

### Impact Metrics

- **≥ 100 fasilitas** tercakup dalam dataset awal MVP;
- **≥ 70% fasilitas** memiliki data aksesibilitas terisi;
- jumlah pengguna yang berhasil menemukan fasilitas sesuai kebutuhannya;
- jumlah kontribusi masyarakat yang berhasil diverifikasi;
- pertumbuhan cakupan fasilitas dengan data aksesibilitas terstruktur di Kota Bogor.

---

## 30. AI Safety & Trust Rules

1. AI hanya boleh mengembalikan informasi fasilitas yang berasal dari database AksesKota.
2. AI tidak boleh mengarang keberadaan ramp, lift, toilet, atau atribut lain.
3. Nilai `unknown` tidak boleh diterjemahkan sebagai “tersedia”.
4. AI harus meminta klarifikasi untuk parameter yang benar-benar dibutuhkan.
5. Jika tidak ditemukan fasilitas sesuai kriteria, AI harus menyatakan bahwa data yang cocok tidak ditemukan.
6. Sistem harus menampilkan disclaimer bahwa kondisi lapangan dapat berubah.
7. Kegagalan AI tidak boleh menghilangkan akses terhadap pencarian/peta biasa.

---

## 31. Disclaimer Produk

> **Informasi aksesibilitas AksesKota berasal dari data yang dipetakan, sumber data publik, dan kontribusi pengguna yang telah melalui proses verifikasi. Kondisi fasilitas di lapangan dapat berubah dan tingkat aksesibilitas setiap fasilitas dapat berbeda sesuai kebutuhan pengguna. AksesKota tidak menjamin bahwa suatu fasilitas atau rute sepenuhnya bebas hambatan bagi semua pengguna.**

---

## 32. Acceptance Criteria Utama

### AC-01 — Search Facility

- User memasukkan nama/kategori fasilitas.
- System menampilkan hasil dalam area Kota Bogor.
- Hasil dapat dibuka ke halaman detail.

### AC-02 — Accessibility Filter

- User memilih satu atau lebih atribut.
- System menampilkan fasilitas yang paling sesuai.
- User dapat melihat alasan match melalui atribut fasilitas.

### AC-03 — Accessibility Match

- User memiliki kebutuhan aksesibilitas.
- System menghitung persentase atribut kebutuhan yang terpenuhi.
- `unknown` tidak dihitung sebagai terpenuhi.

### AC-04 — Voice AI Search

- User menekan floating AI button.
- User mengucapkan perintah Bahasa Indonesia.
- Speech-to-text menghasilkan teks.
- AI menghasilkan structured JSON valid.
- Backend memvalidasi JSON.
- GIS/database menghasilkan hasil yang sesuai.
- Peta menampilkan hasil.

### AC-05 — AI Source of Truth

- AI tidak boleh memberikan atribut fasilitas yang tidak ada di database.
- Jika data tidak tersedia, sistem menampilkan `unknown` / informasi tidak tersedia.

### AC-06 — Crowdsourcing

- Contributor dapat mengajukan data/perubahan.
- Foto bukti wajib untuk atribut utama.
- Data berstatus `pending` sampai diverifikasi.

### AC-07 — Admin Verification

- Admin dapat melihat perubahan yang diajukan.
- Admin dapat approve/reject.
- Approved changes memperbarui data resmi.
- Rejected changes tidak mengubah data resmi.

### AC-08 — Routing

- User dapat memilih titik asal.
- User memilih fasilitas tujuan.
- System menghasilkan walking route.
- Bila data aksesibilitas tersedia, system menampilkan prioritas/skor aksesibilitas.
- System tidak menyatakan rute 100% bebas hambatan.

---

## 33. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data accessibility tidak lengkap | Tinggi | Crowdsourcing + status unknown + timestamp |
| Data user tidak akurat | Tinggi | Wajib foto + admin verification |
| AI salah memahami perintah | Tinggi | Structured JSON + schema validation + test set |
| AI hallucination | Tinggi | Database sebagai satu-satunya source of truth |
| Data pedestrian OSM tidak lengkap | Tinggi | Hanya gunakan atribut yang tersedia; tandai unknown |
| API eksternal bermasalah | Sedang | Fallback ke search/peta biasa |
| Scope terlalu besar | Tinggi | Batasi P0 dan fokus Kota Bogor |
| Routing accessibility terlalu kompleks | Tinggi | Mulai dari walking baseline + known accessibility data |
| Kondisi lapangan berubah | Sedang | last_verified_at + re-verification flow |

---

## 34. Roadmap Pasca-MVP

### Phase 2

- Dashboard analitik area dengan aksesibilitas rendah.
- Pengayaan data crowdsourcing.
- Computer vision sebagai alat bantu verifikasi foto.
- Text-to-Speech.
- Rekomendasi yang lebih personal.

### Phase 3

- Dashboard pemerintah/pengelola kota.
- Prioritas intervensi infrastruktur berdasarkan data agregat.
- Integrasi transportasi umum.
- Multi-modal accessible routing.
- Ekspansi dari Kota Bogor ke kota lain.

---

## 35. Future City Accessibility Analytics

Setelah jumlah data mencukupi, data AksesKota dapat digunakan untuk menghasilkan indikator seperti:

- fasilitas dengan accessibility coverage rendah;
- wilayah dengan kekurangan fasilitas tertentu;
- kebutuhan aksesibilitas yang paling sering dicari;
- lokasi dengan kontribusi/keluhan aksesibilitas tinggi.

Fitur ini **bukan scope MVP**, tetapi menjadi salah satu alasan pengumpulan data secara terstruktur penting untuk jangka panjang.

---

## 36. Reference / Evidence

1. Badan Pusat Statistik (BPS), **Prevalensi Disabilitas Penduduk Berumur 5 Tahun ke Atas Menurut Provinsi dan Jenis Kesulitan**, data 2025, diperbarui 10 Juli 2026.  
   https://www.bps.go.id/id/statistics-table/1/MjMwMyMx/prevalensi-disabilitas-penduduk-berumur-5-tahun-ke-atas-menurut-provinsi-dan-jenis-kesulitan.html

2. Open Data Kota Bogor, portal data terbuka Pemerintah Kota Bogor.  
   https://data.kotabogor.go.id/  

3. OpenStreetMap Wiki, **How to map for the needs of people with disabilities**.  
   https://wiki.openstreetmap.org/wiki/How_to_map_for_the_needs_of_people_with_disabilities

4. OpenStreetMap Wiki, **Key:sidewalk**.  
   https://wiki.openstreetmap.org/wiki/Key:sidewalk

5. Mapbox Documentation, **Directions API**.  
   https://docs.mapbox.com/api/navigation/directions/

6. Google Cloud Documentation, **Speech-to-Text supported languages**.  
   https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages

7. Google AI for Developers, **Structured output**.  
   https://ai.google.dev/gemini-api/docs/structured-output

8. World Health Organization (WHO), **Disability and Health**.  
   https://www.who.int/health-topics/disability

9. Republik Indonesia, **Undang-Undang Nomor 8 Tahun 2016 tentang Penyandang Disabilitas**.  
   https://peraturan.bpk.go.id/Details/37251/uu-no-8-tahun-2016

10. Kementerian PUPR, **Permen PUPR Nomor 14/PRT/M/2017 tentang Persyaratan Kemudahan Bangunan Gedung**.  
    https://peraturan.bpk.go.id/Details/135120/permen-pupr-no-14prtm2017-tahun-2017

---

## 37. Locked Decisions & Remaining Decision

Fitur dan aturan produk berikut **sudah dikunci untuk MVP**:

1. **Skema marker:** warna + ikon + label; tidak mengandalkan warna saja.
2. **Accessibility Match:** bobot kebutuhan sama; `jumlah terpenuhi / jumlah kebutuhan × 100%`.
3. **Route Score:** 70% accessibility + 30% distance.
4. **Dataset awal:** sekitar 100 fasilitas Kota Bogor.
5. **Minimum data MVP:** minimal 5 atribut aksesibilitas utama per fasilitas; target ≥70% fasilitas memiliki data accessibility terisi.
6. **API policy:** AI hanya dipanggil untuk voice/natural-language search; rate limit internal diterapkan untuk STT/routing/LLM.

### Keputusan teknis yang sudah ditetapkan

1. **Frontend:** React.
2. **Backend/API:** Node.js + Express.js.
3. **LLM:** Google Gemini Flash.
4. **Speech-to-Text:** Google Cloud Speech-to-Text.

### Keputusan yang masih perlu ditetapkan tim

1. **Provider storage foto:** kandidat Cloudflare R2, Amazon S3, atau object storage S3-compatible lain yang sesuai dengan biaya dan deployment.

Map provider dan routing menggunakan **Mapbox sebagai rekomendasi baseline MVP**, tetapi dapat dievaluasi kembali apabila terdapat kendala quota, biaya, atau kebutuhan teknis.

Keputusan produk nomor 5–10 pada versi PRD sebelumnya tidak lagi dianggap open decision untuk MVP.

## 38. Definition of Done — MVP

AksesKota MVP dinyatakan siap apabila:

- peta Kota Bogor dapat digunakan pada desktop dan mobile;
- fasilitas publik dapat dicari dan difilter berdasarkan aksesibilitas;
- detail fasilitas menampilkan atribut aksesibilitas, foto, dan timestamp pembaruan;
- user dapat mengajukan kontribusi dengan foto;
- admin dapat memverifikasi kontribusi;
- AI voice dapat memahami query yang sudah didefinisikan dalam test set;
- AI menghasilkan structured JSON yang valid;
- backend dapat menerjemahkan hasil AI menjadi query GIS;
- hasil AI selalu berasal dari database AksesKota;
- user dapat membuat walking route menuju fasilitas;
- sistem membedakan data `available`, `not_available`, dan `unknown`;
- disclaimer ditampilkan pada konteks hasil aksesibilitas/rute;
- fitur dasar peta dan pencarian tetap dapat digunakan ketika layanan AI eksternal tidak tersedia.

---

# End of PRD
