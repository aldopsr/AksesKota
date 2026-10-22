import { ATTRIBUTE_LABEL, CATEGORY_LABEL, STATUS } from '../accessibility/constants';

// Ringkas payload kontribusi menjadi baris yang mudah dibaca (kontributor dan admin)
export function summarizePayload(payload = {}) {
  const rows = [];
  const f = payload.facility ?? {};
  if (f.name) rows.push(['Nama', f.name]);
  if (f.category) rows.push(['Kategori', CATEGORY_LABEL[f.category] ?? f.category]);
  // Beda antara "tidak diisi" dan "sengaja dikosongkan".
  //
  // Sejak alamat jadi opsional, keduanya sama-sama string kosong — padahal artinya
  // berlawanan. Pada usulan pembaruan, `facility` hanya memuat kolom yang BERUBAH,
  // jadi hadirnya kunci `address` berarti pengusul memang menyentuhnya. Tanpa baris
  // ini, menghapus alamat sebuah fasilitas lolos ke admin tanpa terlihat sama sekali.
  if (f.address !== undefined) rows.push(['Alamat', f.address || '— dikosongkan —']);
  if (f.description) rows.push(['Deskripsi', f.description]);
  if (f.lat !== undefined) rows.push(['Koordinat', `${f.lat}, ${f.lon}`]);
  (payload.attributes ?? []).forEach((a) => rows.push([ATTRIBUTE_LABEL[a.code] ?? a.code, `${STATUS[a.status].label}${a.notes ? ` (${a.notes})` : ''}`]));
  return rows;
}
