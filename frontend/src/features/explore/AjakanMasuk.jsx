import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accessibility, CheckCircle2, MessageSquareText, X } from 'lucide-react';

/**
 * Ajakan masuk yang muncul di atas peta — setelah pengguna memakai sesuatu, bukan sebelumnya.
 *
 * Tombol "Masuk" dan "Daftar" dulu menempel permanen di navbar halaman peta. Itu menagih
 * sebelum ada yang dilihat: pengguna baru belum tahu apa yang didapat, jadi tombolnya
 * hanya jadi perabot. Di sini ajakannya menunggu sampai ada bukti ketertarikan — satu
 * fasilitas dibuka, atau kebutuhan dipilih — lalu menjelaskan apa untungnya.
 *
 * Muncul sekali saja. Setelah ditutup, ia tidak kembali selama 30 hari.
 */

const KUNCI = 'ak_ajakan_masuk_ditutup';
const JEDA_HARI = 30;

const bolehTampil = () => {
  try {
    const t = Number(localStorage.getItem(KUNCI));
    return !t || Date.now() - t > JEDA_HARI * 864e5;
  } catch { return true; }
};

const MANFAAT = [
  { Icon: Accessibility, teks: 'Kebutuhan Anda tersimpan, tidak perlu dipilih ulang' },
  { Icon: CheckCircle2, teks: 'Kirim data dan foto fasilitas' },
  { Icon: MessageSquareText, teks: 'Asisten AI dan rute lewat percakapan' },
];

export default function AjakanMasuk({ aktif }) {
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    if (!aktif || !bolehTampil()) return undefined;
    // Jeda pendek setelah pemicunya: muncul di detik yang sama dengan ketukan pengguna
    // membuatnya terbaca seperti akibat dari ketukan itu, bukan tawaran tersendiri.
    const t = setTimeout(() => setTampil(true), 1200);
    return () => clearTimeout(t);
  }, [aktif]);

  if (!tampil) return null;

  const tutup = () => {
    setTampil(false);
    try { localStorage.setItem(KUNCI, String(Date.now())); } catch { /* mode privat */ }
  };

  return (
    <section
      aria-label="Manfaat membuat akun"
      className="ak-muncul pointer-events-auto absolute bottom-4 right-3 z-30 w-[min(20rem,calc(100vw-1.5rem))] origin-bottom-right rounded-panel border border-border bg-surface p-4 shadow-popover max-lg:bottom-auto max-lg:left-3 max-lg:right-[4.25rem] max-lg:top-[7.5rem] max-lg:w-auto max-lg:origin-top"
    >
      {/* size-11 (44 px), bukan size-9. Sebelumnya tombol ini 35x35 px — di bawah
          ambang target sentuh, jadi di ponsel ia praktis selalu meleset dan popup-nya
          terasa tidak bisa ditutup sama sekali. Di aplikasi aksesibilitas itu bukan
          ketidaknyamanan kecil. */}
      <button
        type="button" onClick={tutup} aria-label="Tutup ajakan masuk"
        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-surface-subtle"
      >
        <X aria-hidden="true" size={18} />
      </button>

      <p className="pr-12 font-bold leading-snug">Simpan kebutuhan Anda</p>
      <ul className="ak-chips mt-2.5 space-y-1.5">
        {MANFAAT.map(({ Icon, teks }, j) => (
          <li key={teks} style={{ '--j': j }} className="font-sub flex items-start gap-2 text-sm text-ink-secondary">
            <Icon aria-hidden="true" size={15} className="mt-0.5 shrink-0 text-brand-700" />
            {teks}
          </li>
        ))}
      </ul>
      <Link
        to="/login"
        className="ak-pil mt-3.5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800"
      >
        Masuk atau daftar
      </Link>
    </section>
  );
}
