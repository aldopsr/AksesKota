import { useState } from 'react';
import { Accessibility, Eye, SlidersHorizontal, X } from 'lucide-react';
import { ATTRIBUTE_LABEL } from './constants';

/**
 * Pertanyaan pertama di layar jelajah: "Apa yang Anda butuhkan?"
 *
 * Tanpa kebutuhan terpilih, aplikasi ini tidak punya apa pun untuk dikatakan — kartu
 * hasil tampil tanpa kecocokan dan semua marker peta berwarna sama. Dulu kebutuhan
 * tersembunyi di balik tombol filter, jadi sebagian besar pengguna tidak pernah
 * menyalakannya dan melihat produk dalam keadaan paling tidak berguna.
 *
 * Dua pilihan teratas mengisi beberapa atribut sekaligus dalam satu ketukan; menyusunnya
 * satu per satu tetap tersedia, satu tingkat lebih dalam (prinsip "jalur umum dulu").
 */
const PRESETS = [
  {
    key: 'kursi_roda',
    label: 'Saya pengguna kursi roda',
    icon: Accessibility,
    codes: ['ramp', 'wheelchair_path', 'accessible_toilet', 'lift'],
  },
  {
    key: 'netra',
    label: 'Saya tunanetra atau low vision',
    icon: Eye,
    codes: ['guiding_block', 'audio_access', 'braille'],
  },
];

const KUNCI = 'ak_needs_prompt_ditutup';
const sudahDitutup = () => {
  try { return localStorage.getItem(KUNCI) === '1'; } catch { return false; }
};

export default function NeedsPrompt({ onApply, onOpenFilter }) {
  const [tertutup, setTertutup] = useState(sudahDitutup);

  const tutup = () => {
    setTertutup(true);
    try { localStorage.setItem(KUNCI, '1'); } catch { /* mode privat */ }
  };

  // Sudah pernah ditutup: sisakan satu tombol tenang, jangan bertanya lagi setiap kunjungan.
  if (tertutup) {
    return (
      <button
        type="button"
        onClick={onOpenFilter}
        className="flex w-full items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold hover:border-brand-400"
      >
        <SlidersHorizontal aria-hidden="true" size={16} /> Atur kebutuhan aksesibilitas
      </button>
    );
  }

  return (
    <section
      aria-labelledby="needs-prompt-judul"
      className="relative rounded-card border border-brand-200 bg-brand-50 p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={tutup}
        aria-label="Tutup, lanjutkan tanpa memilih kebutuhan"
        className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-control text-ink-secondary hover:bg-brand-100"
      >
        <X aria-hidden="true" size={18} />
      </button>

      <h2 id="needs-prompt-judul" className="pr-10 text-lg font-bold leading-snug">
        Apa yang Anda butuhkan?
      </h2>
      <p className="font-sub mt-1 text-sm text-ink-secondary">
        Pilih sekali, lalu hasil dan warna penanda peta langsung menyesuaikan kebutuhan Anda.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {PRESETS.map(({ key, label, icon: Icon, codes }) => (
          <button
            key={key}
            type="button"
            onClick={() => onApply(codes)}
            className="flex min-h-14 items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-left hover:border-brand-500 sm:flex-col sm:items-start sm:gap-2"
          >
            <Icon aria-hidden="true" size={22} className="shrink-0 text-brand-700" />
            <span>
              <span className="block text-sm font-semibold leading-snug">{label}</span>
              <span className="font-sub mt-0.5 block text-xs text-ink-muted">
                {codes.map((c) => ATTRIBUTE_LABEL[c]).join(', ')}
              </span>
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onOpenFilter}
          className="flex min-h-14 items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-left hover:border-brand-500 sm:flex-col sm:items-start sm:gap-2"
        >
          <SlidersHorizontal aria-hidden="true" size={22} className="shrink-0 text-brand-700" />
          <span>
            <span className="block text-sm font-semibold leading-snug">Pilih sendiri</span>
            <span className="font-sub mt-0.5 block text-xs text-ink-muted">Susun dari 10 atribut</span>
          </span>
        </button>
      </div>
    </section>
  );
}
