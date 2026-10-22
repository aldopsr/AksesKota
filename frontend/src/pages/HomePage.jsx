import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { m, useInView, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { ArrowRight, ListChecks, Path, Wheelchair } from '@phosphor-icons/react';
import { ATTRIBUTE_LABEL, COVERAGE_NOTE, NEEDS_PRESETS, STATUS } from '../features/accessibility/constants';
import Reveal from '../components/Reveal';
import AngkaHitung from '../components/AngkaHitung';

/**
 * Halaman penjelasan ("/#cara-kerja").
 *
 * Petanya punya rumah sendiri di "/", jadi halaman ini tidak perlu memperagakan produk
 * — ia hanya perlu menjawab satu pertanyaan: kenapa peta ini berbeda dari peta lain.
 *
 * Susunannya mengikuti pola "Minimal Single Column": satu pernyataan, satu bukti, satu
 * penjelasan cara kerja, satu pengakuan batas, lalu ajakan di footer. Empat bagian,
 * masing-masing satu pekerjaan, berselang-seling putih dan bernada supaya terbaca
 * sebagai empat bab dan bukan satu dinding panjang.
 *
 * Yang sengaja TIDAK ada di sini: kartu foto hiasan, gradien, bayangan bertumpuk, dan
 * badge yang tidak mengubah keputusan siapa pun. Setiap blok harus membawa satu fakta.
 */

/* ---------- 1. pernyataan ---------- */

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:pb-28 sm:pt-28">
      <Reveal as="p" className="font-sub text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
        Peta aksesibilitas
      </Reveal>

      <Reveal delay={0.06}>
        <h1 id="hero-title" className="mt-5 max-w-[14ch] text-display font-extrabold leading-[0.9] tracking-[-0.035em]">
          Cek akses sebelum berangkat
        </h1>
      </Reveal>

      <Reveal delay={0.12}>
        <p className="font-sub mt-7 max-w-[46ch] text-lead leading-snug text-ink-secondary">
          Setiap tempat dicocokkan dengan kebutuhan Anda — bukan satu angka untuk semua orang.
        </p>
      </Reveal>

      {/* Dua tindakan, bobotnya berbeda. Tombol gelap adalah yang kami ingin orang
          lakukan; yang satu lagi tetap ada tapi tidak bersaing menarik mata. */}
      <Reveal delay={0.18} className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/"
          className="ak-pil inline-flex min-h-14 items-center gap-2 rounded-control bg-ink px-6 text-base font-bold text-white hover:bg-brand-900"
        >
          Buka peta <ArrowRight aria-hidden="true" size={18} weight="bold" />
        </Link>
        <Link
          to="/facilities/new"
          className="ak-pil inline-flex min-h-14 items-center rounded-control border border-border-strong bg-surface px-6 text-base font-semibold hover:bg-surface-subtle"
        >
          Tambah fasilitas
        </Link>
      </Reveal>
    </section>
  );
}

/* ---------- 2. bukti: angka, termasuk yang tidak enak ---------- */

// Dari basis data, 22 Okt 2026. Angka terakhir sengaja ikut: ia yang membuat tiga
// angka sebelumnya bisa dipercaya. Peta yang hanya memamerkan cakupannya dan diam soal
// lubangnya adalah peta yang tidak bisa dipakai untuk memutuskan apa pun.
const ANGKA = [
  { nilai: 24180, label: 'ruas jalur pejalan kaki dipetakan' },
  { nilai: 2228, label: 'tangga yang memutus jalur itu' },
  { nilai: 138, label: 'fasilitas terdata' },
  { nilai: 38, label: 'di antaranya belum punya satu atribut pun', jujur: true },
];

function Angka() {
  return (
    <section aria-labelledby="angka-title" className="bg-brand-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <Reveal>
          <h2 id="angka-title" className="max-w-[18ch] text-title font-extrabold leading-[0.95] tracking-[-0.035em]">
            Yang kami ukur bukan tempatnya, tapi jalannya
          </h2>
        </Reveal>

        <dl className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {ANGKA.map(({ nilai, label, jujur }, i) => (
            <Reveal key={label} delay={i * 0.06} as="div" className={jujur ? 'border-l-4 border-ink-secondary pl-5' : ''}>
              {/* Angka dulu, keterangan di bawahnya — mata membaca ukuran sebelum kata.
                  tabular-nums supaya keempatnya berbaris rata, bukan bergoyang. */}
              <dt className={`text-5xl font-extrabold leading-none tracking-[-0.03em] tabular-nums ${jujur ? 'text-ink-secondary' : 'text-brand-800'}`}>
                <AngkaHitung nilai={nilai} />
              </dt>
              <dd className="font-sub mt-3 max-w-[22ch] leading-snug text-ink-secondary">{label}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ---------- 3. cara kerja ---------- */

/**
 * Tiap langkah punya satu pratinjau kecil yang memperagakan LANGKAH ITU, memakai kosakata
 * asli aplikasi (preset kebutuhan, status ✓ ✕ ?, garis rute) — bukan ilustrasi hiasan.
 * Pratinjau sengaja tidak bisa diklik dan tampil sebagai gambar: ia aria-hidden karena
 * isinya sudah dikatakan teks di atasnya, dan tak satu pun terlihat seperti tombol.
 * Geraknya hanya jalan sekali saat kartu terlihat, dan mati bila pengguna memilih
 * mengurangi gerakan.
 */
function Pratinjau({ children }) {
  const ref = useRef(null);
  const kurangiGerak = useReducedMotion();
  const terlihat = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const aktif = terlihat || !!kurangiGerak;
  return (
    <div ref={ref} aria-hidden="true" className="rounded-2xl bg-surface-subtle p-4">
      <p className="font-sub mb-3 text-xs font-bold uppercase text-ink-secondary">Contoh tampilan</p>
      {children(aktif, !!kurangiGerak)}
    </div>
  );
}

const PRESET_CONTOH = NEEDS_PRESETS[0];

function PratinjauKebutuhan() {
  return (
    <Pratinjau>
      {(aktif) => (
        <>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-300 delay-500 ${aktif ? 'border-brand-700 bg-brand-700 text-white' : 'border-border-strong bg-surface text-ink'}`}>
              <Check size={14} strokeWidth={3} className={`transition-opacity duration-300 delay-500 ${aktif ? 'opacity-100' : 'hidden opacity-0'}`} />
              {PRESET_CONTOH.labelPendek}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold">
              {NEEDS_PRESETS[1].labelPendek}
            </span>
          </div>
          <p className={`font-sub mt-3 text-sm leading-snug text-ink-secondary transition-opacity duration-500 delay-700 ${aktif ? 'opacity-100' : 'opacity-0'}`}>
            Dicocokkan: {PRESET_CONTOH.codes.map((c) => ATTRIBUTE_LABEL[c]).join(' · ')}
          </p>
        </>
      )}
    </Pratinjau>
  );
}

const BARIS_CONTOH = [
  { nama: 'Ramp', status: 'available' },
  { nama: 'Toilet aksesibel', status: 'not_available' },
  { nama: 'Lift', status: 'unknown' },
];

function PratinjauPenilaian() {
  return (
    <Pratinjau>
      {(aktif) => (
        <ul className="space-y-2">
          {BARIS_CONTOH.map(({ nama, status }, i) => (
            <li
              key={nama}
              style={{ transitionDelay: aktif ? `${i * 160}ms` : '0ms' }}
              className={`flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm transition-all duration-300 ease-[var(--ease-out)] ${aktif ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
            >
              <span className="font-semibold">{nama}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[status].cls}`}>
                <span>{STATUS[status].symbol}</span>{STATUS[status].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Pratinjau>
  );
}

function PratinjauRute() {
  return (
    <Pratinjau>
      {(aktif, kurangi) => (
        <>
          <svg viewBox="0 0 240 92" className="h-auto w-full" focusable="false">
            <path d="M24 70 C 78 70, 92 34, 138 42 S 196 30, 214 24" fill="none" stroke="var(--color-border)" strokeWidth="6" strokeLinecap="round" />
            <m.path
              d="M24 70 C 78 70, 92 34, 138 42 S 196 30, 214 24"
              fill="none" stroke="var(--color-brand-700)" strokeWidth="4" strokeLinecap="round"
              initial={kurangi ? false : { pathLength: 0 }}
              animate={{ pathLength: aktif ? 1 : 0 }}
              transition={{ duration: kurangi ? 0 : 1.1, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            />
            <circle cx="24" cy="70" r="7" fill="var(--color-ink)" stroke="#fff" strokeWidth="3" />
            <circle cx="214" cy="24" r="7" fill="var(--color-brand-700)" stroke="#fff" strokeWidth="3" />
            {/* Hambatan muncul setelah garis sampai ke sana, bukan bersamaan: urutannya
                menceritakan \"rute dibuat, lalu hambatannya terdeteksi\". */}
            <g style={{ opacity: aktif ? 1 : 0, transition: `opacity 300ms ${kurangi ? 0 : 0.75}s` }}>
              <rect x="128" y="32" width="20" height="20" rx="4" transform="rotate(45 138 42)" fill="var(--color-warning-bg)" stroke="var(--color-warning)" strokeWidth="2.5" />
              <text x="138" y="47" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--color-warning)">!</text>
            </g>
          </svg>
          <p className="font-sub mt-2 text-sm leading-snug text-ink-secondary">Hambatan di jalur ditandai, misalnya tangga.</p>
        </>
      )}
    </Pratinjau>
  );
}

const TAHAP = [
  { lama: 'Sekali ketuk', judul: 'Pilih kebutuhan', Ikon: Wheelchair, klausa: 'Pilih kebutuhan Anda, atau pakai preset kursi roda dan low vision.', Contoh: PratinjauKebutuhan },
  { lama: 'Langsung', judul: 'Tempat dinilai ulang', Ikon: ListChecks, klausa: 'Setiap tempat dinilai ulang terhadap kebutuhan itu, termasuk yang belum diketahui.', Contoh: PratinjauPenilaian },
  { lama: 'Beberapa detik', judul: 'Rute dengan hambatan', Ikon: Path, klausa: 'Rute dibuat, lengkap dengan hambatan yang terdeteksi di jalurnya.', Contoh: PratinjauRute },
];

function CaraKerja() {
  const kurangiGerak = useReducedMotion();
  return (
    <section id="cara-kerja" aria-labelledby="cara-title" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:py-28">
      <div className="max-w-2xl">
        <Reveal as="p" className="font-sub text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
          Tiga langkah
        </Reveal>
        <Reveal delay={0.06}>
          <h2 id="cara-title" className="mt-4 max-w-[12ch] text-title font-extrabold leading-[0.95] tracking-[-0.03em]">
            Cara kerja
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="font-sub mt-6 max-w-[44ch] text-lead leading-snug text-ink-secondary">
            Dari kebutuhan Anda sampai rute, tanpa menebak apakah jalannya bisa dilalui.
          </p>
        </Reveal>
      </div>

      <ol className="mt-14 grid gap-4 lg:grid-cols-3">
        {TAHAP.map(({ lama, judul, Ikon, klausa, Contoh }, i) => (
          <Reveal key={judul} as="li" delay={i * 0.08} className="flex flex-col rounded-[1.5rem] border border-border bg-surface p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-extrabold text-white">{i + 1}</span>
              {/* Garis ke langkah berikutnya menggambar dirinya saat kartu terlihat. Hanya
                  di layar lebar, tempat ketiga kartu berjajar dan garisnya memang menunjuk
                  ke kartu di sebelahnya. */}
              {i < TAHAP.length - 1 ? (
                <m.span
                  aria-hidden="true" className="hidden h-0.5 flex-1 origin-left rounded-full bg-brand-300 lg:block"
                  initial={kurangiGerak ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.35 + i * 0.2, ease: [0.23, 1, 0.32, 1] }}
                />
              ) : <span aria-hidden="true" className="hidden flex-1 lg:block" />}
              <Ikon aria-hidden="true" size={30} className="ml-auto shrink-0 text-brand-700 lg:ml-0" />
            </div>

            <p className="font-sub mt-8 text-sm font-bold uppercase text-brand-700">{lama}</p>
            <h3 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.02em]">{judul}</h3>
            <p className="font-sub mt-3 leading-snug text-ink-secondary">{klausa}</p>

            <div className="mt-auto pt-7"><Contoh /></div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------- 4. batas yang diakui ---------- */

// Per wilayah, dari basis data 22 Okt 2026. "Belum diketahui" sengaja jadi kolom
// tersendiri, bukan sisa hitungan: itu satu-satunya angka yang membedakan kami.
const BARIS_CAKUPAN = [
  ['Kota Bogor', 51, 33],
  ['DKI Jakarta', 43, 32],
  ['Kota Bandung', 43, 34],
];

function Cakupan() {
  return (
    <section aria-labelledby="cakupan-title" className="bg-brand-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <h2 id="cakupan-title" className="max-w-[12ch] text-title font-extrabold leading-[0.98] tracking-[-0.03em]">
                Cakupan data apa adanya
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mt-7 max-w-[34ch] text-lead font-bold leading-snug">
                Yang belum diketahui tidak pernah dihitung sebagai tersedia.
              </p>
              <p className="font-sub mt-4 max-w-[38ch] leading-relaxed text-ink-secondary">
                Salah menebak satu ramp berarti perjalanan yang gagal. Karena itu kolom
                “Belum diketahui” berdiri sendiri, bukan disembunyikan sebagai sisa hitungan.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="lg:col-span-6 lg:col-start-7">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left sm:min-w-[30rem]">
                <caption className="sr-only">Jumlah fasilitas terdata dan yang sudah punya atribut aksesibilitas, per wilayah</caption>
                <thead>
                  <tr className="font-sub text-sm text-ink-secondary">
                    <th scope="col" className="py-3.5 pr-2 font-semibold sm:pr-4">Wilayah</th>
                    <th scope="col" className="py-3.5 pr-2 font-semibold sm:pr-4">Terdata</th>
                    <th scope="col" className="py-3.5 pr-2 font-semibold sm:pr-4">Punya atribut</th>
                    <th scope="col" className="py-3.5 text-right font-semibold">Belum diketahui</th>
                  </tr>
                </thead>
                <tbody>
                  {BARIS_CAKUPAN.map(([wilayah, total, beratribut]) => (
                    // Nada latar berselang-seling menggantikan garis — di atas pita
                    // bernada, putih lebih tenang daripada garis rambut.
                    <tr key={wilayah} className="odd:bg-white">
                      <th scope="row" className="py-3.5 pl-2 pr-2 font-semibold sm:pl-3 sm:pr-4">{wilayah}</th>
                      <td className="py-3.5 pr-2 tabular-nums sm:pr-4">{total}</td>
                      <td className="py-3.5 pr-2 tabular-nums sm:pr-4">{beratribut}</td>
                      <td className="py-3.5 pr-2 text-right font-semibold tabular-nums sm:pr-3">
                        <span aria-hidden="true" className="mr-1 text-ink-secondary">?</span>{total - beratribut}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-sub mt-6 max-w-[56ch] text-sm leading-relaxed text-ink-secondary">{COVERAGE_NOTE}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function LandingSections() {
  return (
    <>
      <Hero />
      <Angka />
      <CaraKerja />
      <Cakupan />
    </>
  );
}
