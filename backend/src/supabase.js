// Satu tempat untuk alamat & kunci Supabase.
//
// Orang gampang menyalin "Project URL" dari dashboard bersama sufiks /rest/v1 — dan kalau itu
// terjadi, SELURUH endpoint /auth/v1 membalas error PostgREST yang menyesatkan. Jadi sufiks
// apa pun dipangkas di sini, sekali, untuk semua pemakai.
export const sbUrl = () =>
  process.env.SUPABASE_URL?.replace(/\/+$/, '').replace(/\/(rest|auth|storage)\/v1$/, '');

/** Kunci service_role. RAHASIA — hanya untuk backend, tidak pernah dikirim ke browser. */
export const sbServiceKey = () => process.env.SUPABASE_SERVICE_KEY;

/** Kunci anon; jatuh ke service_role kalau belum diisi, supaya setup minimal tetap jalan. */
export const sbAnonKey = () => process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

export const sbSiap = () => Boolean(sbUrl() && sbServiceKey());
