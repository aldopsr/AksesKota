import { Link } from 'react-router-dom';
import { ArrowRight, ListChecks, Path, Wheelchair } from '@phosphor-icons/react';
import { COVERAGE_NOTE } from '../features/accessibility/constants';
import Reveal from '../components/Reveal';

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
  { nilai: '24.180', label: 'ruas jalur pejalan kaki dipetakan' },
  { nilai: '2.228', label: 'tangga yang memutus jalur itu' },
  { nilai: '138', label: 'fasilitas terdata' },
  { nilai: '38', label: 'di antaranya belum punya satu atribut pun', jujur: true },
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
            <Reveal key={label} delay={i * 0.06} as="div">
              {/* Angka dulu, keterangan di bawahnya — mata membaca ukuran sebelum kata.
                  tabular-nums supaya keempatnya berbaris rata, bukan bergoyang. */}
              <dt className={`text-5xl font-extrabold leading-none tracking-[-0.03em] tabular-nums ${jujur ? 'text-ink-secondary' : 'text-brand-800'}`}>
                {nilai}
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

const TAHAP = [
  { lama: 'Sekali ketuk', Ikon: Wheelchair, klausa: 'Pilih kebutuhan Anda, atau pakai preset kursi roda dan low vision.', bg: 'bg-brand-900', teks: 'text-white' },
  { lama: 'Langsung', Ikon: ListChecks, klausa: 'Setiap tempat dinilai ulang terhadap kebutuhan itu, termasuk yang belum diketahui.', bg: 'bg-accent-cyan', teks: 'text-ink' },
  { lama: 'Beberapa detik', Ikon: Path, klausa: 'Rute dibuat, lengkap dengan hambatan yang terdeteksi di jalurnya.', bg: 'bg-brand-700', teks: 'text-white' },
];

function CaraKerja() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-title" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:py-28">
      <Reveal>
        <h2 id="cara-title" className="max-w-[12ch] text-title font-extrabold leading-[0.95] tracking-[-0.03em]">
          Cara kerja
        </h2>
      </Reveal>

      {/* Tiga kartu sejajar dengan tinggi sama. Lebarnya dibuat SAMA, bukan sebanding
          dengan durasi — ketiganya nyaris seketika, jadi lebar berbeda-beda hanya akan
          terlihat seperti data padahal bukan. */}
      <div className="mt-14 grid gap-3 sm:grid-cols-3">
        {TAHAP.map(({ lama, Ikon, klausa, bg, teks }, i) => (
          <Reveal
            key={lama}
            delay={i * 0.06}
            className={`flex min-h-56 flex-col justify-between rounded-[1.5rem] p-6 ${bg} ${teks} ${teks === 'text-white' ? 'on-dark' : ''}`}
          >
            <Ikon aria-hidden="true" size={32} weight="regular" />
            <div className="mt-10">
              <p className="text-lead font-bold leading-tight">{lama}</p>
              {/* Warna penuh tanpa transparansi: opacity-90 menurunkan kontras klausa
                  di atas latar terang jadi di bawah ambang AA 4.5:1. */}
              <p className="font-sub mt-3 max-w-[26ch] leading-snug">{klausa}</p>
            </div>
          </Reveal>
        ))}
      </div>
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
