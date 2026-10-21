import { Check, CircleHelp, Clock, Star, X, CheckCircle2, XCircle } from 'lucide-react';
import AngkaBerjalan from './AngkaBerjalan';
import { ATTRIBUTES, ATTRIBUTE_HINT, ATTRIBUTE_LABEL, STATUS } from '../features/accessibility/constants';
import { Badge } from './ui';
import { formatDate } from '../lib/format';

/* Tiga konsep terpisah (design system 4.3): status kontribusi, status atribut, Accessibility Match. */

// 1) Accessibility Match: warna + simbol + label (+ persen)
export function MatchBadge({ level, percent = null, className = '' }) {
  return (
    <Badge className={`${level.cls} ${className}`}>
      {level.symbol && <span aria-hidden="true">{level.symbol}</span>}
      {level.label}
      {percent !== null && percent !== undefined && <span><AngkaBerjalan nilai={percent} />%</span>}
    </Badge>
  );
}

// 2) Status atribut: ikon + teks
const ATTR_ICON = { available: Check, not_available: X, unknown: CircleHelp };
export function AttributeStatus({ status = 'unknown', className = '' }) {
  const st = STATUS[status];
  const Icon = ATTR_ICON[status];
  return (
    <Badge className={`${st.cls} ${className}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={2.5} /> {st.label}
    </Badge>
  );
}

export function AttributeRow({ code, status, note, required }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
      <div className="min-w-0">
        <p className="font-semibold">
          {ATTRIBUTE_LABEL[code]}
          {required && <span className="ml-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-900">Dibutuhkan</span>}
        </p>
        {note
          ? <p className="font-sub text-sm text-ink-secondary">{note}</p>
          : status === 'unknown' && <p className="font-sub text-sm text-ink-secondary">Informasi ini belum cukup untuk memastikan ketersediaan.</p>}
      </div>
      <AttributeStatus status={status} />
    </li>
  );
}

// 3) Status kontribusi
const C_ICON = { pending: Clock, approved: CheckCircle2, rejected: XCircle };
export function ContributionBadge({ status, label, cls }) {
  const Icon = C_ICON[status];
  return <Badge className={cls}><Icon aria-hidden="true" size={14} /> {label}</Badge>;
}

export function Stars({ value }) {
  const v = Math.round(value ?? 0);
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} className={n <= v ? 'fill-amber-400 text-amber-500' : 'text-border-strong'} />)}
    </span>
  );
}

// Waktu pembaruan sebagai informasi tersendiri (bukan bagian dari match)
export function FreshnessNote({ iso, freshness }) {
  return (
    <p className="font-sub flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
      {/* Belum pernah = kalimatnya sendiri, bukan "Terakhir diverifikasi: -".
          Sejak cap verifikasi diturunkan dari atribut, fasilitas yang seluruh
          atributnya masih "Belum diketahui" memang tidak punya tanggal — dan tanda
          hubung membuat keadaan itu terbaca seperti data yang hilang, bukan seperti
          fakta yang memang begitu. */}
      {iso ? (
        <>Terakhir diverifikasi: <strong className="font-semibold text-ink">{formatDate(iso)}</strong></>
      ) : (
        <strong className="font-semibold text-ink">Belum pernah diverifikasi</strong>
      )}
      {freshness !== 'verified_recently' && <Badge className="bg-warning-bg text-warning">Perlu verifikasi ulang</Badge>}
    </p>
  );
}

export { ATTRIBUTES, ATTRIBUTE_HINT };
