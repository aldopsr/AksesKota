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
    // Keadaan hasil, supaya satu jangkauan atau satu rute bisa dikirim ke orang lain
    // dan terbuka persis seperti yang dilihat pengirimnya.
    jangkauan: bacaTitik(sp.get('jangkauan')),
    menit: [10, 15, 20].includes(Number(sp.get('menit'))) ? Number(sp.get('menit')) : 15,
    awal: bacaTitik(sp.get('awal')),
    gaya: sp.get('gaya') === 'satelit' ? 'satelit' : null,
    jalur: sp.get('jalur') === '1',
  };
}

export function buildExplore({ q, category, needsRaw, radius, route, intent, jangkauan, menit, awal, gaya, jalur } = {}) {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  if (category) sp.set('category', category);
  if (needsRaw) sp.set('needs', needsRaw);
  if (radius) sp.set('radius', String(radius));
  if (route) sp.set('route', '1');
  if (intent) sp.set('intent', intent);
  if (jangkauan) sp.set('jangkauan', tulisTitik(jangkauan));
  if (jangkauan && menit) sp.set('menit', String(menit));
  if (awal) sp.set('awal', tulisTitik(awal));
  if (gaya === 'satelit') sp.set('gaya', 'satelit');
  if (jalur) sp.set('jalur', '1');
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// 5 desimal ≈ 1,1 meter. Cukup teliti untuk menandai pintu masuk, dan tautannya tetap
// bisa dibaca orang — koordinat 14 angka di belakang koma membuat URL terlihat seperti
// sampah dan tidak menambah ketelitian yang berarti bagi siapa pun.
const tulisTitik = ({ lng, lat }) => `${(+lng).toFixed(5)},${(+lat).toFixed(5)}`;

/** "106.80450,-6.59710" -> { lng, lat }. Null untuk apa pun yang tidak masuk akal. */
export function bacaTitik(teks) {
  const [lng, lat] = String(teks ?? '').split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lng, lat };
}
