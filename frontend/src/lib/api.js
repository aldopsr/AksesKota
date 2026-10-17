// Satu-satunya pintu komunikasi dengan backend Express. React tidak mengakses database langsung.
import { ApiError } from './errors';
export { ApiError };

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

const TOKEN_KEY = 'ak_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode privat */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ } },
};

function withParams(path, params) {
  if (!params) return path;
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

// Backend membalas { error, issues? }. Ambil pesan yang paling berguna untuk pengguna.
function messageFrom(data, status) {
  if (data?.issues?.length) return data.issues[0].message || data.error;
  if (data?.error) return data.error;
  if (status === 404) return 'Data tidak ditemukan.';
  if (status >= 500) return 'Terjadi kesalahan di server. Coba lagi nanti.';
  return 'Permintaan gagal.';
}

export async function api(path, { method = 'GET', body, formData, params, signal } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${withParams(path, params)}`, {
      method, headers, signal,
      body: formData ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // token kedaluwarsa/tidak valid: biarkan AuthContext membersihkan sesi
    if (res.status === 401 && token) window.dispatchEvent(new Event('ak-unauthorized'));
    throw new ApiError(messageFrom(data, res.status), res.status, data);
  }
  return data;
}
