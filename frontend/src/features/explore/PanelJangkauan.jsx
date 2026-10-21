import { X } from 'lucide-react';
import { WARNA_JANGKAUAN } from '../map/jangkauan';
import { Skeleton } from '../../components/ui';

/**
 * Hasil "jangkauan nyata": berapa banyak jaringan jalan yang tersisa bagi pengguna
 * kursi roda dibandingkan pejalan kaki, dari titik dan batas waktu yang sama.
 *
 * Angka yang dicari orang di panel ini cuma satu — persennya. Sisanya penjelasan
 * supaya angka itu tidak dibaca sebagai sesuatu yang lebih pasti daripada yang
 * sebenarnya: ia gabungan dari laju yang lebih lambat DAN jalur yang terputus, dan
 * keduanya ditulis apa adanya di bawah.
 */
const MENIT = [10, 15, 20];

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default function PanelJangkauan({ data, memuat, galat, menit, onGantiMenit, onTutup }) {
  return (
    <section
      aria-labelledby="jangkauan-judul"
      className="ak-muncul pointer-events-auto absolute bottom-4 left-3 z-30 w-[min(22rem,calc(100vw-1.5rem))] lg:left-[26.5rem] rounded-panel border border-border bg-surface p-4 shadow-popover max-lg:bottom-auto max-lg:left-3 max-lg:right-[4.25rem] max-lg:top-[7.5rem] max-lg:w-auto"
    >
      <button
        type="button" onClick={onTutup} aria-label="Tutup panel jangkauan"
        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-surface-subtle"
      >
        <X aria-hidden="true" size={18} />
      </button>

      <h2 id="jangkauan-judul" className="pr-12 font-bold leading-snug">Jangkauan dari titik ini</h2>

      <div role="group" aria-label="Batas waktu" className="mt-2.5 flex gap-1.5">
        {MENIT.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === menit}
            onClick={() => onGantiMenit(m)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-control border text-sm font-semibold ${
              m === menit ? 'border-brand-700 bg-brand-700 text-white' : 'border-border-strong bg-surface hover:bg-surface-subtle'
            }`}
          >
            {m} menit
          </button>
        ))}
      </div>

      {memuat && <div className="mt-3 space-y-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /></div>}
      {galat && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{galat}</p>}

      {!memuat && !galat && data && !data.ada_jaringan && (
        <p className="font-sub mt-3 text-sm text-ink-secondary">
          Belum ada jaringan pejalan kaki terdata di sekitar titik ini, jadi jangkauannya tidak bisa dihitung.
        </p>
      )}

      {!memuat && !galat && data?.ada_jaringan && (
        <>
          <p className="mt-3 text-display-sm text-3xl font-extrabold leading-none tracking-[-0.02em]">
            {data.persen_tersisa}%
          </p>
          <p className="font-sub mt-1 text-sm text-ink-secondary">
            jaringan yang tersisa bagi pengguna kursi roda
          </p>

          <ul className="mt-3 space-y-1.5">
            {[
              ['jalan', 'Jalan kaki', data.panjang_m.jalan],
              ['kursi_roda', 'Kursi roda', data.panjang_m.kursi_roda],
            ].map(([k, label, nilai]) => (
              <li key={k} className="flex items-center gap-2.5 text-sm">
                <span aria-hidden="true" style={{ background: WARNA_JANGKAUAN[k] }} className="h-1.5 w-6 shrink-0 rounded-full" />
                <span className="flex-1">{label}</span>
                <strong className="font-semibold tabular-nums">{km(nilai)}</strong>
              </li>
            ))}
          </ul>

          {/* Asumsinya ditulis, bukan disembunyikan. Selisih ini gabungan dua hal, dan
              membiarkan orang mengira ia murni soal hambatan itu menyesatkan. */}
          <p className="font-sub mt-3 text-xs text-ink-secondary">
            Dihitung di atas jaringan pejalan kaki OSM: {data.laju_kmj.jalan} km/jam untuk jalan kaki,{' '}
            {data.laju_kmj.kursi_roda} km/jam untuk kursi roda, dengan tangga dan ruas bertanda tidak dapat
            dilalui dibuang dari jaringan. Ruas yang belum terdata dianggap bisa dilalui — angka sebenarnya
            kemungkinan lebih kecil.
          </p>
        </>
      )}
    </section>
  );
}
