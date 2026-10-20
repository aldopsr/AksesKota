import { Accessibility, CheckCircle2, MessageSquareText } from 'lucide-react';

/**
 * Halaman masuk dan daftar.
 *
 * Bahasa yang sama dengan halaman depan hasil tiru-dekat acuan: dua kartu bersudut
 * 1.75rem berdampingan — satu blok foto full-bleed dengan scrim dan teks menumpang di
 * atasnya, satu lagi kertas putih berisi formulir. Tidak ada bayangan; permukaan
 * dibedakan oleh nada, bukan oleh kartu yang mengambang.
 *
 * Blok foto itu bukan hiasan — ia menjawab "kenapa saya harus punya akun" dengan tiga
 * baris. Di ponsel blok itu menyusut jadi pita setinggi 11rem di ATAS formulir dan daftar
 * manfaatnya disembunyikan: tanpa itu halaman masuk dimulai dengan kotak isian telanjang
 * tanpa judul, sedangkan foto setinggi layar sebelum formulir membuatnya terasa buntu.
 */
const MANFAAT = [
  { Icon: Accessibility, teks: 'Kebutuhan aksesibilitas Anda tersimpan, tidak perlu dipilih ulang' },
  { Icon: CheckCircle2, teks: 'Kirim data dan foto fasilitas yang belum terdata' },
  { Icon: MessageSquareText, teks: 'Asisten AI dan rute lewat percakapan' },
];

export default function AuthShell({ title, subtitle, notice, children, footer }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-3 px-3 pb-4 lg:min-h-[calc(100dvh-6rem)] lg:grid-cols-[1fr_30rem] lg:items-stretch">
      {/* Kartu foto. Greyscale seperti di halaman depan supaya satu-satunya warna di
          layar ini tetap milik tombol dan penanda status. */}
      <section className="on-dark relative overflow-hidden rounded-[1.75rem] text-white max-lg:h-44">
        <img
          src="/img/kitlv-a1219-straat-te-buitenzorg-met-op.jpg"
          alt=""
          width="1920"
          height="1310"
          className="absolute inset-0 size-full scale-110 object-cover [filter:grayscale(1)_contrast(1.05)]"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />

        <div className="relative flex h-full flex-col justify-end p-5 sm:p-9">
          <h1 className="max-w-[12ch] text-title font-extrabold leading-[0.95] tracking-[-0.03em]">
            {title}
          </h1>
          {subtitle && <p className="font-sub mt-2 max-w-md text-white/85 lg:mt-4 lg:text-lg">{subtitle}</p>}

          <ul className="ak-chips mt-7 space-y-3 border-t border-white/20 pt-6 max-lg:hidden">
            {MANFAAT.map(({ Icon, teks }, j) => (
              <li key={teks} style={{ '--j': j }} className="flex items-start gap-3">
                <Icon aria-hidden="true" size={19} className="mt-0.5 shrink-0 text-accent-cyan" />
                <span className="font-sub max-w-sm text-sm text-white/90">{teks}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Kertas: formulirnya sendiri. */}
      <section className="flex flex-col justify-center rounded-[1.75rem] bg-surface p-6 sm:p-9">
        {notice && <div className="mb-5">{notice}</div>}
        {children}
        {footer && <p className="mt-7">{footer}</p>}
      </section>
    </div>
  );
}
