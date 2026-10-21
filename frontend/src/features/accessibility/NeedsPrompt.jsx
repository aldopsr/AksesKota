import { useState } from 'react';
import { Accessibility, Eye, SlidersHorizontal, Target, X } from 'lucide-react';
import { ATTRIBUTE_LABEL, NEEDS_PRESETS } from './constants';

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
const IKON = { kursi_roda: Accessibility, netra: Eye };

const KUNCI = 'ak_needs_prompt_ditutup';
const sudahDitutup = () => {
  try { return localStorage.getItem(KUNCI) === '1'; } catch { return false; }
};

export default function NeedsPrompt({ onApply, onOpenFilter, onCobaJangkauan, sisakanTombol = true, ringkas = false }) {
  const [tertutup, setTertutup] = useState(sudahDitutup);

  const tutup = () => {
    setTertutup(true);
    try { localStorage.setItem(KUNCI, '1'); } catch { /* mode privat */ }
  };

  // Sudah pernah ditutup: sisakan satu tombol tenang, jangan bertanya lagi setiap kunjungan.
  // Kecuali saat ia dipakai sebagai kartu mengambang di atas peta — di sana tombol sisa
  // itu jadi perabot yang menutupi peta selamanya, dan pintunya sudah ada di menu cari.
  if (tertutup) {
    if (!sisakanTombol) return null;
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
        {ringkas
          ? 'Pilih sekali, hasil dan warna penanda peta menyesuaikan.'
          : 'Pilih sekali, lalu hasil dan warna penanda peta langsung menyesuaikan kebutuhan Anda.'}
      </p>

      {/* Bentuk ringkas untuk kartu yang mengambang DI ATAS PETA.
          Versi penuhnya 430 px dan di layar 375 px itu menyisakan sepertiga layar
          untuk petanya sendiri — padahal di halaman depan peta itulah kesan pertama.
          Isinya sama, cuma kehilangan baris keterangan tiap preset. */}
      {ringkas ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {NEEDS_PRESETS.map(({ key, labelPendek, icon, codes }) => {
            const Icon = IKON[icon];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onApply(codes)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-semibold hover:border-brand-500"
              >
                <Icon aria-hidden="true" size={18} className="shrink-0 text-brand-700" />
                {labelPendek}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenFilter}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-semibold hover:border-brand-500"
          >
            <SlidersHorizontal aria-hidden="true" size={18} className="shrink-0 text-brand-700" /> Pilih sendiri dari 10 atribut
          </button>
        </div>
      ) : (

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {NEEDS_PRESETS.map(({ key, label, icon, codes }) => {
          const Icon = IKON[icon];
          return (
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
          );
        })}

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
      )}

      {/* Jalan masuk ke jangkauan, di layar pertama.
          Ini temuan terkuat yang kami punya — biru menjulur jauh, hijau berhenti
          beberapa blok dari titik yang sama — dan sampai sekarang ia bersembunyi di
          balik satu ikon di bilah peta yang tidak akan ditekan orang yang belum tahu
          ada apa di baliknya. Ditaruh sebagai satu baris, bukan tombol sebesar preset:
          memilih kebutuhan tetap pekerjaan utama layar ini, yang ini tawaran. */}
      {onCobaJangkauan && (
        <button
          type="button"
          onClick={onCobaJangkauan}
          className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-control border border-brand-200 bg-surface px-3 text-left text-sm font-semibold hover:border-brand-500"
        >
          <Target aria-hidden="true" size={18} className="shrink-0 text-brand-700" />
          <span>Atau lihat sejauh mana kursi roda bisa pergi dari satu titik</span>
        </button>
      )}
    </section>
  );
}
