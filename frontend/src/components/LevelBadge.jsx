import { m } from 'motion/react';

// Status kecocokan = warna + simbol + label teks (tidak bergantung pada warna saja)
export default function LevelBadge({ level, percent = null, className = '' }) {
  return (
    <span
      style={{ background: level.bg }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white ${className}`}
    >
      {level.symbol && <span aria-hidden="true">{level.symbol}</span>}
      {level.label}
      {percent !== null && percent !== undefined && <span>{percent}%</span>}
    </span>
  );
}

// Bar kecocokan beranimasi (transform-friendly). Info utama tetap berupa teks di sekitarnya.
export function MatchMeter({ level, percent }) {
  if (percent === null || percent === undefined) return null;
  return (
    <div role="img" aria-label={`Kecocokan ${percent} persen`} className="h-2 w-full overflow-hidden rounded-full bg-cobalt-100">
      <m.div
        className="h-full origin-left rounded-full"
        style={{ background: level.bg, width: `${percent}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
