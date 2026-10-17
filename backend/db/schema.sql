-- AksesKota — schema MVP. Idempotent: aman dijalankan ulang.
-- PRD §26. Catatan deviasi ada di bawah tiap tabel.

create extension if not exists postgis;

create table if not exists users (
  id            serial primary key,
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  role          text not null default 'user' check (role in ('user','admin')),
  created_at    timestamptz not null default now()
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
  verified_by    int references users(id),
  verified_at    timestamptz,
  primary key (facility_id, attribute_code)
);

create table if not exists accessibility_profiles (
  user_id        int not null references users(id) on delete cascade,
  attribute_code text not null references accessibility_attributes(code),
  is_required    boolean not null default true,
  primary key (user_id, attribute_code)
);

create table if not exists facility_photos (
  id          serial primary key,
  facility_id int not null references facilities(id) on delete cascade,
  uploaded_by int references users(id),
  url         text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

-- facility_id null = usulan fasilitas baru (change_type='create').
-- payload menyimpan usulan mentah; data resmi tidak ditimpa sampai admin approve (PRD §12.4).
create table if not exists contributions (
  id           serial primary key,
  facility_id  int references facilities(id) on delete cascade,
  submitted_by int not null references users(id),
  change_type  text not null check (change_type in ('create','update')),
  payload      jsonb not null,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note  text,
  reviewed_by  int references users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists contributions_status_idx on contributions (status, created_at desc);

create table if not exists reviews (
  id          serial primary key,
  facility_id int not null references facilities(id) on delete cascade,
  user_id     int not null references users(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  content     text,
  created_at  timestamptz not null default now(),
  unique (facility_id, user_id)   -- satu review per user per fasilitas
);

create table if not exists reports (
  id          serial primary key,
  facility_id int not null references facilities(id) on delete cascade,
  review_id   int references reviews(id) on delete cascade,
  reported_by int not null references users(id),
  report_type text not null check (report_type in
                ('data_salah','fasilitas_tutup','atribut_tidak_sesuai','foto_tidak_relevan','review_bermasalah')),
  description text,
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by int references users(id),
  resolved_at timestamptz
);
create index if not exists reports_status_idx on reports (status, id desc);

-- Guardrail kuota AI per user per hari (PRD §27 API Usage Policy).
-- Tabel, bukan in-memory counter: server restart tidak boleh me-reset kuota.
create table if not exists ai_usage (
  user_id int not null references users(id) on delete cascade,
  day     date not null default current_date,
  count   int not null default 0,
  primary key (user_id, day)
);

-- Dipakai db/import-osm.js: asal data dan wilayah tiap fasilitas.
-- `region` juga menjadi dasar pelaporan cakupan data per wilayah — PRD v2.0 §11.4 mewajibkan
-- sistem menampilkan keterbatasan cakupan agar "tidak ada data" tidak dibaca sebagai
-- "tidak ada fasilitas aksesibel".
alter table facilities add column if not exists osm_id text;
alter table facilities add column if not exists source text not null default 'manual';
alter table facilities add column if not exists region text;
create index if not exists facilities_osm_idx on facilities (osm_id);
create index if not exists facilities_region_idx on facilities (region);
