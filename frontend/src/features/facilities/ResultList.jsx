import { Link, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import { GraduationCap, HeartPulse, Landmark, MapPin, Store, TrainFront } from 'lucide-react';
import LevelBadge from '../../components/LevelBadge';
import { CATEGORY_LABEL } from '../accessibility/constants';
import { formatDistance } from '../../lib/geo';
import { Stars } from './parts';

export const CATEGORY_ICON = {
  kesehatan: HeartPulse, pendidikan: GraduationCap, layanan_publik: Landmark, transportasi: TrainFront, komersial: Store,
};

export default function ResultList({ items, selectedId }) {
  const { search } = useLocation();
  return (
    <ul className="space-y-2.5">
      {items.map(({ facility, level, distance }, i) => {
        const Icon = CATEGORY_ICON[facility.category] ?? MapPin;
        const selected = String(facility.id) === selectedId;
        return (
          <m.li
            key={facility.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.03 }}
          >
            <Link
              to={`/map/${facility.id}${search}`}
              aria-current={selected ? 'true' : undefined}
              className={`flex gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-cobalt-400 ${selected ? 'border-cobalt-700 ring-1 ring-cobalt-700' : 'border-cobalt-100'}`}
            >
              <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-700">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold leading-snug">{facility.name}</span>
                <span className="block text-sm text-slate-600">{CATEGORY_LABEL[facility.category] ?? facility.category_name}</span>
                <span className="mt-1 flex items-start gap-1 text-sm text-slate-700">
                  <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
                  <span>
                    {facility.address}
                    {distance !== null && <span className="font-bold"> ({formatDistance(distance)})</span>}
                  </span>
                </span>
                {facility.label && (
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <LevelBadge level={level} percent={facility.match_pct} />
                    <span className="text-sm text-slate-700">{facility.needs_met} dari {facility.needs_total} kebutuhan terpenuhi</span>
                  </span>
                )}
                {facility.rating_count > 0 && (
                  <span className="mt-1 inline-flex items-center gap-1 text-sm">
                    <Stars value={facility.rating_avg} /> {facility.rating_avg} ({facility.rating_count})
                  </span>
                )}
              </span>
            </Link>
          </m.li>
        );
      })}
    </ul>
  );
}
