export function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function validatePhoto(file, rules) {
  if (!rules.types.includes(file.type)) return `${file.name}: format harus JPG, PNG, atau WebP.`;
  if (file.size > rules.maxMB * 1024 * 1024) return `${file.name}: ukuran maksimal ${rules.maxMB} MB.`;
  return null;
}
