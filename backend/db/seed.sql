-- Seed data awal. Idempotent (on conflict do nothing / update).
-- PERINGATAN: koordinat fasilitas di bawah masih PERKIRAAN hasil penelusuran manual.
-- Sebelum demo, verifikasi ulang tiap titik lewat OSM/Google Maps dan perbaiki di sini.
-- ponytail: 14 fasilitas starter, bukan 100. Target dataset PRD dicapai lewat
-- import Overpass/Open Data Bogor (script terpisah), bukan tulis tangan di SQL.

insert into categories (code, name) values
  ('kesehatan',      'Kesehatan'),
  ('pendidikan',     'Pendidikan'),
  ('layanan_publik', 'Layanan Publik'),
  ('transportasi',   'Transportasi'),
  ('komersial',      'Komersial & Rekreasi')
on conflict (code) do nothing;

insert into accessibility_attributes (code, name, icon, is_core, sort) values
  ('ramp',               'Ramp',               'ramp',       true,  1),
  ('guiding_block',      'Guiding Block',      'tactile',    true,  2),
  ('accessible_toilet',  'Toilet Aksesibel',   'toilet',     true,  3),
  ('lift',               'Lift',               'lift',       true,  4),
  ('accessible_parking', 'Parkir Disabilitas', 'parking',    true,  5),
  ('wheelchair_path',    'Jalur Kursi Roda',   'wheelchair', true,  6),
  ('braille',            'Braille',            'braille',    false, 7),
  ('audio_access',       'Akses Audio',        'audio',      false, 8),
  ('accessible_entrance','Pintu Aksesibel',    'door',       false, 9),
  ('handrail',           'Handrail',           'handrail',   false, 10)
on conflict (code) do update set name = excluded.name, icon = excluded.icon, sort = excluded.sort;

-- facilities.name dipakai sebagai kunci idempotensi seed
create unique index if not exists facilities_seed_name_idx on facilities (name);

insert into facilities (name, category_id, address, location, description) values
  ('Stasiun Bogor',              (select id from categories where code='transportasi'),   'Jl. Nyi Raja Permas, Cibogor',            st_setsrid(st_makepoint(106.7901,-6.5951),4326), 'Stasiun KRL Commuter Line tujuan akhir lintas Bogor.'),
  ('Terminal Baranangsiang',     (select id from categories where code='transportasi'),   'Jl. Raya Pajajaran, Baranangsiang',       st_setsrid(st_makepoint(106.8085,-6.6020),4326), 'Terminal bus antarkota tipe A.'),
  ('Botani Square',              (select id from categories where code='komersial'),      'Jl. Raya Pajajaran No.69, Baranangsiang', st_setsrid(st_makepoint(106.8060,-6.5984),4326), 'Pusat perbelanjaan bersebelahan dengan IPB Baranangsiang.'),
  ('Lippo Plaza Ekalokasari',    (select id from categories where code='komersial'),      'Jl. Siliwangi No.123, Sukasari',          st_setsrid(st_makepoint(106.8080,-6.6150),4326), 'Pusat perbelanjaan di Bogor Timur.'),
  ('Kebun Raya Bogor',           (select id from categories where code='komersial'),      'Jl. Ir. H. Djuanda No.13, Paledang',      st_setsrid(st_makepoint(106.7988,-6.5975),4326), 'Kebun botani seluas 87 hektare di pusat kota.'),
  ('Taman Sempur',               (select id from categories where code='komersial'),      'Jl. Sempur, Sempur',                      st_setsrid(st_makepoint(106.7930,-6.5905),4326), 'Taman kota dan area olahraga publik.'),
  ('RS PMI Bogor',               (select id from categories where code='kesehatan'),      'Jl. Raya Pajajaran No.80, Tegallega',     st_setsrid(st_makepoint(106.7937,-6.5848),4326), 'Rumah sakit umum swasta.'),
  ('RSUD Kota Bogor',            (select id from categories where code='kesehatan'),      'Jl. Dr. Sumeru No.120, Menteng',          st_setsrid(st_makepoint(106.7820,-6.5880),4326), 'Rumah sakit umum daerah Kota Bogor.'),
  ('RS Hermina Bogor',           (select id from categories where code='kesehatan'),      'Jl. Ring Road No.75, Curugmekar',         st_setsrid(st_makepoint(106.7760,-6.5700),4326), 'Rumah sakit umum swasta.'),
  ('Puskesmas Bogor Tengah',     (select id from categories where code='kesehatan'),      'Jl. Dr. Sumeru, Menteng',                 st_setsrid(st_makepoint(106.7860,-6.5920),4326), 'Pusat kesehatan masyarakat kecamatan.'),
  ('Balai Kota Bogor',           (select id from categories where code='layanan_publik'), 'Jl. Ir. H. Djuanda No.10, Paledang',      st_setsrid(st_makepoint(106.7963,-6.5968),4326), 'Kantor Pemerintah Kota Bogor.'),
  ('Mal Pelayanan Publik Bogor', (select id from categories where code='layanan_publik'), 'Jl. Kapten Muslihat, Pabaton',            st_setsrid(st_makepoint(106.7915,-6.5938),4326), 'Layanan perizinan dan administrasi terpadu.'),
  ('IPB University Dramaga',     (select id from categories where code='pendidikan'),     'Jl. Raya Dramaga, Babakan',               st_setsrid(st_makepoint(106.7260,-6.5582),4326), 'Kampus utama IPB University.'),
  ('Universitas Pakuan',         (select id from categories where code='pendidikan'),     'Jl. Pakuan No.3, Tegallega',              st_setsrid(st_makepoint(106.8000,-6.6020),4326), 'Kampus swasta di Kota Bogor.')
on conflict (name) do nothing;

-- Semua fasilitas x semua atribut = unknown dulu.
-- PRD 8.2: data yang belum diketahui WAJIB tersimpan sebagai unknown, bukan diasumsikan ada.
insert into accessibility_facilities (facility_id, attribute_code)
select f.id, a.code from facilities f cross join accessibility_attributes a
on conflict do nothing;

-- Lalu isi yang sudah "diverifikasi". Data contoh untuk demo, ganti dengan hasil survei nyata.
update accessibility_facilities af set status = v.status, verified_at = now()
from (values
  ('Stasiun Bogor','ramp','available'),              ('Stasiun Bogor','guiding_block','available'),
  ('Stasiun Bogor','accessible_toilet','available'), ('Stasiun Bogor','lift','not_available'),
  ('Stasiun Bogor','wheelchair_path','available'),   ('Stasiun Bogor','handrail','available'),
  ('Stasiun Bogor','audio_access','available'),      ('Stasiun Bogor','accessible_parking','not_available'),

  ('Botani Square','ramp','available'),              ('Botani Square','lift','available'),
  ('Botani Square','accessible_toilet','available'), ('Botani Square','accessible_parking','available'),
  ('Botani Square','wheelchair_path','available'),   ('Botani Square','guiding_block','not_available'),
  ('Botani Square','accessible_entrance','available'),

  ('Lippo Plaza Ekalokasari','ramp','available'),    ('Lippo Plaza Ekalokasari','lift','available'),
  ('Lippo Plaza Ekalokasari','accessible_toilet','not_available'),
  ('Lippo Plaza Ekalokasari','accessible_parking','available'),

  ('RS PMI Bogor','ramp','available'),               ('RS PMI Bogor','lift','available'),
  ('RS PMI Bogor','accessible_toilet','available'),  ('RS PMI Bogor','accessible_parking','available'),
  ('RS PMI Bogor','wheelchair_path','available'),    ('RS PMI Bogor','handrail','available'),
  ('RS PMI Bogor','guiding_block','not_available'),

  ('RSUD Kota Bogor','ramp','available'),            ('RSUD Kota Bogor','lift','available'),
  ('RSUD Kota Bogor','accessible_toilet','available'),('RSUD Kota Bogor','accessible_parking','available'),
  ('RSUD Kota Bogor','wheelchair_path','available'),

  ('RS Hermina Bogor','ramp','available'),           ('RS Hermina Bogor','lift','available'),
  ('RS Hermina Bogor','accessible_toilet','available'),('RS Hermina Bogor','accessible_parking','available'),

  ('Puskesmas Bogor Tengah','ramp','available'),     ('Puskesmas Bogor Tengah','lift','not_available'),
  ('Puskesmas Bogor Tengah','accessible_toilet','not_available'),

  ('Kebun Raya Bogor','wheelchair_path','available'),('Kebun Raya Bogor','accessible_toilet','available'),
  ('Kebun Raya Bogor','accessible_parking','available'),('Kebun Raya Bogor','ramp','available'),
  ('Kebun Raya Bogor','lift','not_available'),       ('Kebun Raya Bogor','guiding_block','not_available'),

  ('Taman Sempur','wheelchair_path','available'),    ('Taman Sempur','ramp','available'),
  ('Taman Sempur','accessible_toilet','not_available'),('Taman Sempur','lift','not_available'),

  ('Balai Kota Bogor','ramp','available'),           ('Balai Kota Bogor','guiding_block','available'),
  ('Balai Kota Bogor','accessible_toilet','available'),('Balai Kota Bogor','lift','available'),
  ('Balai Kota Bogor','accessible_parking','available'),

  ('Mal Pelayanan Publik Bogor','ramp','available'), ('Mal Pelayanan Publik Bogor','guiding_block','available'),
  ('Mal Pelayanan Publik Bogor','accessible_toilet','available'),
  ('Mal Pelayanan Publik Bogor','braille','available'),('Mal Pelayanan Publik Bogor','audio_access','available'),
  ('Mal Pelayanan Publik Bogor','lift','available'),

  ('IPB University Dramaga','ramp','available'),     ('IPB University Dramaga','lift','available'),
  ('IPB University Dramaga','accessible_parking','available'),
  ('IPB University Dramaga','accessible_toilet','not_available'),

  ('Universitas Pakuan','ramp','available'),         ('Universitas Pakuan','lift','not_available'),
  ('Universitas Pakuan','accessible_toilet','not_available'),

  ('Terminal Baranangsiang','ramp','not_available'), ('Terminal Baranangsiang','guiding_block','not_available'),
  ('Terminal Baranangsiang','accessible_toilet','not_available'),
  ('Terminal Baranangsiang','wheelchair_path','not_available')
) as v(fname, acode, status)
join facilities f on f.name = v.fname
where af.facility_id = f.id and af.attribute_code = v.acode;

-- last_verified_at = waktu verifikasi atribut terbaru (FR-20)
update facilities f set last_verified_at = s.t
from (select facility_id, max(verified_at) t from accessibility_facilities group by 1) s
where s.facility_id = f.id and s.t is not null;
