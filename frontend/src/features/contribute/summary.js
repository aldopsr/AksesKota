import { ATTRIBUTE_LABEL, CATEGORY_LABEL, STATUS } from '../accessibility/constants';

// Ringkas payload kontribusi menjadi baris yang mudah dibaca (kontributor dan admin)
export function summarizePayload(payload = {}) {
  const rows = [];
  const f = payload.facility ?? {};
  if (f.name) rows.push(['Nama', f.name]);
  if (f.category) rows.push(['Kategori', CATEGORY_LABEL[f.category] ?? f.category]);
  if (f.address) rows.push(['Alamat', f.address]);
  if (f.description) rows.push(['Deskripsi', f.description]);
  if (f.lat !== undefined) rows.push(['Koordinat', `${f.lat}, ${f.lon}`]);
  (payload.attributes ?? []).forEach((a) => rows.push([ATTRIBUTE_LABEL[a.code] ?? a.code, `${STATUS[a.status].label}${a.notes ? ` (${a.notes})` : ''}`]));
  return rows;
}
