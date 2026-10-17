# AksesKota Web (Frontend)

React 18 + Vite + Tailwind CSS v4 + React Router + TanStack Query + React Hook Form/Zod + Mapbox GL JS + Motion.
Desain mengikuti `design_system_aksesKota_v0_2_0` dan struktur `AksesKota_Web_IA_UX_Structure_v1_0`.

```bash
npm install
cp .env.example .env.local   # VITE_API_URL, VITE_MAPBOX_TOKEN
npm run dev                  # http://localhost:5173
npm run build                # hasil di dist/
```
Lihat `../README.md` untuk menjalankan bersama backend.

## Struktur URL (IA 3.2)
| URL | Isi | Akses |
|---|---|---|
| `/` | Beranda | Publik |
| `/map?q=&category=&needs=&radius=` | Jelajahi: pencarian, filter, daftar, peta. Parameter hidup di URL (bisa di-refresh, dibagikan, Back/Forward) | Publik |
| `/facilities/:id[?route=1]` | Detail fasilitas di ruang jelajah yang sama (peta tidak dimuat ulang); `route=1` menampilkan rute | Publik |
| `/login`, `/register` | Masuk/daftar, menampilkan alasan login dan kembali ke tujuan | Publik |
| `/accessibility-profile` | Profil aksesibilitas | Login |
| `/facilities/new`, `/facilities/:id/update` | Form bertahap 5 langkah | Login |
| `/my-contributions` | Kontribusi saya, filter status | Login |
| `/admin`, `/admin/contributions/:id` | Antrean verifikasi (layout admin terpisah) | Admin |

URL lama (`/map/:id`, `/contribute/*`, `/profile/accessibility`, `/me/contributions`) dialihkan otomatis.
`needs` pada URL: tidak ada = pakai profil (bila login); `none` = tanpa kebutuhan; `ramp,lift` = pilihan eksplisit.

## Struktur kode
```
src/
  index.css                 token design system (warna, radius, bayangan, font)
  lib/                      api.js (klien HTTP + JWT), url.js (parameter pencarian), geocode.js, geo.js, format.js
  context/                  AuthContext, AppContexts (lokasi, asisten, toast)
  components/               ui.jsx (Button, Chip, Field, Modal/sheet, Tabs, Stepper, Menu...), status.jsx (MatchBadge,
                            AttributeStatus, ContributionBadge), layout/ (PublicLayout, AdminLayout, shells)
  features/accessibility/   constants.js (atribut, kelompok, kategori), match.js, icons.js
  features/explore/         FacilityCard, FilterSheet, FacilityDetailPanel, RouteSummary, MapSheet, FeedbackModals
  features/map/             MapView (marker, rute), MapChrome (kontrol, legenda)
  features/ai/              AssistantDock (chat, suara dua arah, hands-free), parseQuery (mode dasar)
  features/contribute/      LocationPicker, PlaceSearch, PhotoUpload, summary
  pages/                    Home, Explore, Auth, Profile, ContributionForm, MyContributions, Admin, NotFound
```

## Keputusan desain
- **Tiga konsep status dipisahkan:** kecocokan (MatchBadge: warna + simbol + label), status atribut (ikon + teks), status kontribusi (ikon + teks).
- **Peta:** panel 384-400 px di desktop; di mobile toggle Daftar/Peta dan bottom sheet dengan tombol eksplisit. Navigasi bawah mobile hanya di halaman non-peta.
- **Asisten:** hasil diterapkan lewat parameter URL, jadi filter yang dipakai AI selalu terlihat sebagai chip dan bisa diubah.
- **Animasi (Motion):** `LazyMotion` + `m`, hanya opacity/transform 140-280 ms; tanpa parallax. `reducedMotion="user"`.
- **Aksesibilitas:** skip link, fokus 3 px, `aria-live`, target 44 px, tab dengan navigasi panah, dialog native `<dialog>`; audit axe tanpa pelanggaran pada 13 tampilan utama.
- Hero landing memakai ukuran judul sedikit di atas skala design system (`text-[3.5rem]`) mengikuti moodboard; bagian lain mengikuti skala DS.
