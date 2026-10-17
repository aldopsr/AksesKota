import { Star } from 'lucide-react';
import { ATTRIBUTES, STATUS } from '../accessibility/constants';
import { Badge } from '../../components/ui';

// Daftar 10 atribut: simbol + teks status (tidak mengandalkan warna saja).
// attributes dari backend: [{ code, status, notes }] — selalu 10 baris, yang belum ada datanya 'unknown'.
export function AttributeList({ attributes = [], required = [] }) {
  const byCode = Object.fromEntries(attributes.map((a) => [a.code, a]));
  return (
    <ul className="divide-y divide-cobalt-100 overflow-hidden rounded-xl border border-cobalt-100 bg-white">
      {ATTRIBUTES.map(({ code, label }) => {
        const a = byCode[code];
        const st = STATUS[a?.status ?? 'unknown'];
        return (
          <li key={code} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
            <span className="font-bold">
              {label}
              {required.includes(code) && (
                <span className="ml-2 rounded-md bg-sun-300 px-1.5 py-0.5 text-xs font-bold text-ink">Dibutuhkan</span>
              )}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-bold ${st.cls}`}>
              <span aria-hidden="true">{st.symbol}</span> {st.label}
            </span>
            {a?.notes && <p className="basis-full text-sm text-slate-700">{a.notes}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function PhotoGallery({ photos = [] }) {
  if (!photos.length) {
    return <p className="rounded-xl border border-dashed border-cobalt-200 bg-white p-4 text-slate-700">Belum ada foto untuk fasilitas ini.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-2">
      {photos.map((p, i) => (
        <li key={p.id} className="overflow-hidden rounded-xl border border-cobalt-100 bg-white">
          <img src={p.url} alt={`Foto ${i + 1} dari ${photos.length}`} loading="lazy" decoding="async" className="aspect-[8/5] w-full object-cover" />
          {p.caption && <p className="px-2 py-1 text-sm text-slate-700">{p.caption}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Stars({ value }) {
  const v = Math.round(value ?? 0);
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={16} className={n <= v ? 'fill-sun-400 text-sun-500' : 'text-slate-300'} />
      ))}
    </span>
  );
}

export function FreshnessBadge({ freshness }) {
  return freshness === 'verified_recently' ? (
    <Badge className="border-green-700 bg-green-50 text-green-900">Diverifikasi baru-baru ini</Badge>
  ) : (
    <Badge className="border-amber-600 bg-sun-100 text-amber-950">Perlu verifikasi ulang</Badge>
  );
}
