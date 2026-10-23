import { useState } from 'react';
import { Accessibility, ChevronRight, Eye, SlidersHorizontal, Target, X } from 'lucide-react';
import { ATTRIBUTES, ATTRIBUTE_LABEL, NEEDS_PRESETS } from './constants';

/**
 * Pertanyaan pertama di layar jelajah: "Apa yang Anda butuhkan?"
 *
 * Tata letak: SATU KOLOM, satu baris per pilihan. Dulu tiga kolom (sm:grid-cols-3) yang
 * mengikuti lebar LAYAR, bukan lebar kartu — padahal kartu ini mengambang selebar 24 rem,
 * jadi tiap kolom hanya ~100 px dan teksnya terpotong per suku kata. Baris penuh memberi
 * teks lebar yang cukup di kartu selebar apa pun.
 */
const IKON = { kursi_roda: Accessibility, netra: Eye };

const KUNCI = 'ak_needs_prompt_ditutup';
/** Sudah pernah ditanya (dan ditutup) di peramban ini? */
export const sudahDitutup = () => {
  try { return localStorage.getItem(KUNCI) === '1'; } catch { return false; }
};
/** Catat bahwa pertanyaannya sudah ditutup, supaya tidak muncul lagi tiap kunjungan. */
export const tandaiDitutup = () => {
  try { localStorage.setItem(KUNCI, '1'); } catch { /* mode privat */ }
};

// Satu gaya baris untuk semua pilihan supaya ketiganya benar-benar sejajar.
const barisCls =
  'group flex w-full items-center gap-3 rounded-control border border-border bg-surface p-3 text-left transition-colors duration-200 hover:border-brand-500 hover:bg-white';

function Baris({ Ikon, judul, keterangan, onClick }) {
  return (
    <button type="button" onClick={onClick} className={barisCls}>
      <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-800">
        <Ikon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-semibold leading-snug">{judul}</span>
        {keterangan && <span className="font-sub mt-0.5 block text-xs leading-snug text-ink-secondary">{keterangan}</span>}
      </span>
      {/* motion-safe: panah hanya bergeser bila pengguna tidak memilih mengurangi gerakan. */}
      <ChevronRight
        aria-hidden="true" size={18}
        className="shrink-0 text-ink-muted transition-transform duration-200 group-hover:text-brand-700 motion-safe:group-hover:translate-x-0.5"
      />
    </button>
  );
}

// onApply menerima (codes, key): key-nya dipakai pemanggil untuk perlakuan khusus per
// preset — mis. menyalakan hands-free saat yang dipilih adalah preset tunanetra.
export default function NeedsPrompt({ onApply, onOpenFilter, onCobaJangkauan, dalamDialog = false }) {
  const [tertutup, setTertutup] = useState(dalamDialog ? false : sudahDitutup);

  const tutup = () => {
    setTertutup(true);
    tandaiDitutup();
  };

  // Sudah pernah ditutup: sisakan satu tombol tenang, jangan bertanya lagi setiap
  // kunjungan. Kecuali di dalam dialog — di sana yang memutuskan muncul-tidaknya
  // adalah pemanggilnya.
  if (tertutup && !dalamDialog) {
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

  const isi = (
    <>
      {/* Di dialog sambutan kalimatnya menjawab satu pertanyaan lagi: KENAPA ditanya.
          Pengunjung pertama belum tahu peta ini menilai tempat dengan cara yang berbeda
          dari peta lain, dan tanpa itu tiga pilihan di bawah hanya terbaca sebagai
          formulir. Satu kalimat, bukan dua paragraf: sapaan yang panjang tidak dibaca
          siapa pun. "Bukan satu angka untuk semua orang" sengaja sama persis dengan
          kalimat di hero beranda — dua tempat, satu suara.

          Kalimat kedua ("pilih sekali, warna penanda menyesuaikan") sengaja dibuang:
          di layar 320 px ia mendorong dua dari tiga pilihan ke bawah lipatan, dan
          akibatnya yang tunanetra harus menggulir untuk menemukan barisnya sendiri.
          Lagi pula efeknya terlihat sendiri begitu satu pilihan ditekan. */}
      <p className="font-sub mt-1.5 text-sm leading-snug text-ink-secondary">
        {dalamDialog
          ? 'Peta ini menilai tiap tempat dari kebutuhan Anda — bukan dengan satu angka untuk semua orang.'
          : 'Pilih sekali, hasil dan warna penanda peta langsung menyesuaikan.'}
      </p>

      {/* ak-stagger: baris masuk bergiliran (CSS di index.css, otomatis mati bila
          pengguna memilih mengurangi gerakan). */}
      <ul className="ak-stagger mt-4 space-y-2">
        {NEEDS_PRESETS.map(({ key, label, icon, codes }, i) => (
          <li key={key} style={{ '--i': i }}>
            <Baris
              Ikon={IKON[icon]}
              judul={label}
              keterangan={codes.map((c) => ATTRIBUTE_LABEL[c]).join(' · ')}
              onClick={() => onApply(codes, key)}
            />
          </li>
        ))}
        <li style={{ '--i': NEEDS_PRESETS.length }}>
          <Baris
            Ikon={SlidersHorizontal}
            judul="Pilih sendiri"
            keterangan={`Susun dari ${ATTRIBUTES.length} atribut`}
            onClick={onOpenFilter}
          />
        </li>
      </ul>

      {/* Jalan masuk ke jangkauan: dipisah garis tipis dan dibuat sebagai tautan tenang,
          bukan kotak sebesar preset — memilih kebutuhan tetap pekerjaan utama layar ini. */}
      {onCobaJangkauan && (
        <div className="mt-3 border-t border-brand-200 pt-3">
          <button
            type="button"
            onClick={onCobaJangkauan}
            className="group flex min-h-11 w-full items-center gap-2.5 rounded-control px-1 text-left text-sm font-semibold text-brand-900 transition-colors hover:text-brand-700"
          >
            <Target aria-hidden="true" size={18} className="shrink-0 text-brand-700" />
            <span className="flex-1 leading-snug underline-offset-4 group-hover:underline">
              Lihat sejauh mana kursi roda bisa pergi dari satu titik
            </span>
            <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-ink-muted" />
          </button>
        </div>
      )}
    </>
  );

  // Di dalam dialog, judul dan tombol tutup sudah disediakan dialognya sendiri —
  // mengulangnya di sini berarti dua tombol tutup dan dua judul yang sama.
  if (dalamDialog) return isi;

  return (
    <section
      aria-labelledby="needs-prompt-judul"
      className="relative rounded-card border border-brand-200 bg-brand-50 p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={tutup}
        aria-label="Tutup, lanjutkan tanpa memilih kebutuhan"
        className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-brand-100"
      >
        <X aria-hidden="true" size={18} />
      </button>

      <h2 id="needs-prompt-judul" className="pr-10 text-lg font-bold leading-snug">
        Apa yang Anda butuhkan?
      </h2>
      {isi}
    </section>
  );
}