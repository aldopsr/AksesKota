// Parameter pencarian hidup di URL: bisa di-refresh, di-share, dan dipakai tombol Back/Forward.
// `needs`: tidak ada = pakai profil (bila login) · "none" = tanpa kebutuhan · "ramp,lift" = pilihan eksplisit.
export function readExplore(sp) {
  const needsRaw = sp.get('needs');
  const radius = Number(sp.get('radius'));
  return {
    q: sp.get('q') ?? '',
    category: sp.get('category') ?? '',
    needsRaw,
    needs: needsRaw && needsRaw !== 'none' ? needsRaw.split(',').filter(Boolean) : [],
    radius: Number.isFinite(radius) && radius > 0 ? radius : null,
    route: sp.get('route') === '1',
    assistant: sp.get('assistant') === '1',
    intent: sp.get('intent') ?? '',
  };
}

export function buildExplore({ q, category, needsRaw, radius, route, intent } = {}) {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  if (category) sp.set('category', category);
  if (needsRaw) sp.set('needs', needsRaw);
  if (radius) sp.set('radius', String(radius));
  if (route) sp.set('route', '1');
  if (intent) sp.set('intent', intent);
  const s = sp.toString();
  return s ? `?${s}` : '';
}
