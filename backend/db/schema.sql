-- AksesKota — schema MVP. Idempotent: aman dijalankan ulang.
-- PRD §26. Catatan deviasi ada di bawah tiap tabel.

create extension if not exists postgis;

-- Identitas dikelola Supabase Auth (PRD 2.0 FR-01 / 27.2). Tabel ini hanya menyimpan
-- data aplikasi milik akun tersebut; email dan password TIDAK disimpan di sini.
-- Barisnya dibuat otomatis oleh backend saat token valid pertama kali dipakai.
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'contributor' check (role in ('contributor','admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists categories (
  id   serial primary key,
  code text unique not null,
  name text not null
);

-- Daftar atribut aksesibilitas (PRD §8.1). Jadi tabel, bukan enum,
-- supaya frontend bisa ambil label+ikon untuk UI filter lewat /api/attributes.
create table if not exists accessibility_attributes (
  code     text primary key,
  name     text not null,
  icon     text,
  is_core  boolean not null default true,  -- atribut utama: wajib foto bukti saat diubah (FR-08)
  sort     int not null default 0
);

create table if not exists facilities (
  id               serial primary key,
  name             text not null,
  category_id      int references categories(id),
  address          text,
  location         geography(point,4326) not null,
  description      text,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists facilities_location_idx on facilities using gist (location);
create index if not exists facilities_name_idx on facilities (lower(name));

-- DEVIASI dari PRD: primary key komposit, bukan kolom id sendiri.
-- Satu fasilitas tidak boleh punya dua baris untuk atribut yang sama —
-- constraint DB lebih murah daripada cek duplikat di app code.
create table if not exists accessibility_facilities (
  facility_id    int not null references facilities(id) on delete cascade,
  attribute_code text not null references accessibility_attributes(code),
  status         text not null default 'unknown' check (status in ('available','not_available','unknown')),
  notes          text,
  verified_by    uuid references profiles(id),
  verified_at    timestamptz,
  primary key (facility_id, attribute_code)
);

create table if not exists accessibility_profiles (
  user_id        uuid not null references profiles(id) on delete cascade,
  attribute_code text not null references accessibility_attributes(code),
  is_required    boolean not null default true,
  primary key (user_id, attribute_code)
);

create table if not exists facility_photos (
  id          serial primary key,
  facility_id int not null references facilities(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  url         text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

-- facility_id null = usulan fasilitas baru (change_type='create_facility').
-- payload menyimpan usulan mentah; data resmi tidak ditimpa sampai admin approve (PRD §12.4).
create table if not exists contributions (
  id           serial primary key,
  facility_id  int references facilities(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  change_type  text not null check (change_type in
                 ('create_facility','update_facility','update_accessibility','add_photo')),
  payload      jsonb not null,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_notes text,
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists contributions_status_idx on contributions (status, created_at desc);

create table if not exists reviews (
  id          serial primary key,
  facility_id int not null references facilities(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  content     text,
  created_at  timestamptz not null default now(),
  unique (facility_id, user_id)   -- satu review per user per fasilitas
);

create table if not exists reports (
  id          serial primary key,
  facility_id int not null references facilities(id) on delete cascade,
  review_id   int references reviews(id) on delete cascade,
  reported_by uuid not null references profiles(id),
  report_type text not null check (report_type in
                ('data_salah','fasilitas_tutup','atribut_tidak_sesuai','foto_tidak_relevan','review_bermasalah')),
  description text,
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz
);
create index if not exists reports_status_idx on reports (status, id desc);

-- Guardrail kuota AI per hari (PRD §27 API Usage Policy).
-- Tabel, bukan counter di memori: restart server (dan tiap instance serverless Vercel
-- yang punya memori sendiri) tidak boleh me-reset kuota.
-- `key` bukan user_id karena Guest juga boleh memakai AI (PRD §7):
--   user login -> 'u:<id>',  guest -> 'ip:<alamat>'.
create table if not exists ai_usage (
  key   text not null,
  day   date not null default current_date,
  count int not null default 0,
  primary key (key, day)
);

-- Migrasi inkremental. Dijalankan setiap db:reset; aman berulang.
-- Proyek ini belum pakai migration tool — kalau jumlah alter di bawah lewat ~10 baris, pindah ke node-pg-migrate.
alter table facilities add column if not exists osm_id text;
alter table facilities add column if not exists source text not null default 'manual';
create index if not exists facilities_osm_idx on facilities (osm_id);

-- ai_usage sempat memakai kolom user_id (hanya user login). Diganti ke `key` agar
-- Guest ikut terhitung. Drop aman: tabel ini belum pernah dipakai fitur apa pun.
do $$ begin
  if exists (select 1 from information_schema.columns
              where table_name = 'ai_usage' and column_name = 'user_id') then
    drop table ai_usage;
    create table ai_usage (
      key   text not null,
      day   date not null default current_date,
      count int not null default 0,
      primary key (key, day)
    );
  end if;
end $$;

-- Jaringan pejalan kaki dari OSM, untuk penilaian aksesibilitas rute (PRD 19.5).
-- Diisi oleh db/import-ways.js. Kolom yang sering dipakai diekstrak jadi kolom sendiri
-- supaya bisa diindeks/difilter; sisanya tetap disimpan di `tags` untuk jaga-jaga.
create table if not exists pedestrian_ways (
  osm_id         bigint primary key,
  highway        text,
  wheelchair     text,   -- yes | designated | limited | no
  tactile_paving text,
  surface        text,
  smoothness     text,
  incline        text,
  kerb           text,
  width          numeric,
  tags           jsonb not null default '{}',
  geom           geography(linestring,4326) not null
);
create index if not exists pedestrian_ways_geom_idx on pedestrian_ways using gist (geom);

alter table reports add column if not exists resolution_note text;

-- Proteksi brute-force login DIHAPUS pada v2: login tidak lagi lewat backend kita,
-- Supabase Auth yang menangani rate limit dan kebijakan password.
drop table if exists login_attempts;

-- PRD 2.0 §11.4: cakupan data tidak merata antarwilayah, dan sistem WAJIB menampilkan
-- keterbatasan itu agar "tidak ada data" tidak dibaca sebagai "tidak ada fasilitas aksesibel".
-- Diisi importer per kota; GET /api/coverage melaporkannya.
alter table facilities add column if not exists region text;
create index if not exists facilities_region_idx on facilities (region);
