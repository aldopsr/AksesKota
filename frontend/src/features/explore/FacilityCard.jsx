import { Link } from 'react-router-dom';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { CATEGORY_LABEL } from '../accessibility/constants';
import { categoryIcon } from '../accessibility/icons';
import { MatchBadge, Stars } from '../../components/status';
import { Button } from '../../components/ui';
import { formatDistance } from '../../lib/geo';
import { formatDate } from '../../lib/format';

// Kartu hasil: satu tautan utama (seluruh kartu) + tombol Rute terpisah. Informasi inti: nama, kategori,
// alamat, kecocokan, jumlah kebutuhan terpenuhi/belum diketahui, jarak, waktu verifikasi.
export default function FacilityCard({ facility: f, level, distance, selected, to, onRoute, compact = false }) {
  const Icon = categoryIcon(f.category);
  return (
    <article
      id={`facility-${f.id}`}
      className={`relative rounded-card border bg-surface p-4 transition-colors duration-[var(--motion-fast)] hover:border-brand-400 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus ${selected ? 'border-brand-700 ring-2 ring-brand-200' : 'border-border'}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-800"><Icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link to={to} aria-current={selected ? 'true' : undefined} className="after:absolute after:inset-0 focus-visible:outline-none">{f.name}</Link>
          </h3>
          <p className="font-sub text-sm text-ink-secondary">{CATEGORY_LABEL[f.category] ?? f.category_name}</p>
          <p className="font-sub mt-0.5 flex items-start gap-1 text-sm text-ink-secondary">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
            <span>{f.address}{distance !== null && distance !== undefined && <strong className="font-semibold text-ink"> ({formatDistance(distance)})</strong>}</span>
          </p>
        </div>
      </div>

      {f.label && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MatchBadge level={level} percent={f.match_pct} />
          <span className="font-sub text-sm text-ink-secondary">
            {f.needs_met} dari {f.needs_total} kebutuhan terpenuhi{f.needs_unknown > 0 && `, ${f.needs_unknown} belum diketahui`}
          </span>
        </div>
      )}

      {!compact && (
        <p className="font-sub mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
          <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" size={14} /> Diverifikasi {formatDate(f.last_verified_at)}</span>
          {f.rating_count > 0 && <span className="inline-flex items-center gap-1"><Stars value={f.rating_avg} /> {f.rating_avg} ({f.rating_count})</span>}
        </p>
      )}

      {onRoute && (
        <div className="relative z-10 mt-3">
          <Button variant="secondary" size="sm" onClick={onRoute}><Navigation aria-hidden="true" size={15} /> Rute<span className="sr-only"> ke {f.name}</span></Button>
        </div>
      )}
    </article>
  );
}
