import { m } from 'motion/react';
import { Accessibility, CheckCircle2, MessageSquareText } from 'lucide-react';
import { LogoMark } from './Brand';

/**
 * Halaman masuk/daftar.
 *
 * Versi sebelumnya satu kartu di tengah dengan kalimat panjang "Masuk untuk menyimpan
 * kebutuhan, mengirim data, dan menulis ulasan." Tiga manfaat dipadatkan jadi satu
 * kalimat yang harus dibaca utuh untuk dimengerti, dan separuh layar desktop kosong.
 *
 * Sekarang ketiganya jadi tiga baris pendek dengan ikon — lebih sedikit kata, bisa
 * dipindai sekilas, dan di layar lebar mengisi kolom yang tadinya kosong. Bentuknya
 * sengaja meniru chip di halaman peta supaya terasa satu aplikasi, bukan halaman formulir
 * yang ditempel belakangan.
 */
const MANFAAT = [
  { Icon: Accessibility, teks: 'Simpan kebutuhan aksesibilitas Anda' },
  { Icon: CheckCircle2, teks: 'Kirim data dan foto fasilitas' },
  { Icon: MessageSquareText, teks: 'Tulis ulasan pengalaman' },
];

export default function AuthShell({ title, subtitle, notice, children, footer }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col items-start justify-center gap-8 px-4 py-8 sm:py-12 lg:grid lg:grid-cols-[1fr_26rem] lg:items-center lg:gap-16">
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      >
        <LogoMark size={44} />
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="font-sub mt-2 max-w-md text-lg text-ink-secondary">{subtitle}</p>}

        <ul className="ak-chips mt-6 flex flex-col gap-2">
          {MANFAAT.map(({ Icon, teks }, j) => (
            <li
              key={teks}
              style={{ '--j': j }}
              className="flex items-center gap-2.5 text-sm font-semibold"
            >
              <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-800">
                <Icon size={17} />
              </span>
              {teks}
            </li>
          ))}
        </ul>
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.06, ease: [0.23, 1, 0.32, 1] }}
        className="w-full lg:order-none"
        style={{ order: -1 }}
      >
        {notice && <div className="mb-4">{notice}</div>}
        <div className="rounded-panel border border-border bg-surface p-5 shadow-panel sm:p-6">{children}</div>
        {footer && <p className="mt-5 text-center">{footer}</p>}
      </m.div>
    </div>
  );
}
