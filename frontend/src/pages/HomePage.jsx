import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { COVERAGE_NOTE, NEEDS_PRESETS } from '../features/accessibility/constants';
import Reveal from '../components/Reveal';

/**
 * Isi halaman depan di bawah hero peta.
 *
 * Ditiru DEKAT dari acuan landing page yang diberikan (Rallyo Club), bukan diadaptasi:
 * baris chip dengan satu chip gelap sebagai yang aktif tepat di atas judul besar, lalu
 * grid kartu campur — kartu foto bersudut besar dengan teks menumpang di atasnya dan
 * tombol panah bundar di pojok, berdampingan dengan blok warna padat.
 *
 * Tiga hal sengaja TIDAK disalin bulat-bulat, dan alasannya penting:
 *  1. Warna. Di acuan hijau dan oranye dipakai sebagai warna hias. Di sini hijau,
 *     kuning, dan merah SUDAH punya arti — tingkat kecocokan aksesibilitas. Memakainya
 *     untuk hiasan membuat satu-satunya sistem warna yang wajib dibaca benar berhenti
 *     berarti. Slot warna acuan diisi warna merek: indigo pekat dan cyan.
 *  2. Foto. Acuan hidup dari foto orang bermain tenis. Slot fotonya diisi foto arsip
 *     jalanan Bogor dari Rijksmuseum dan KITLV — dunia di sekitar subjek, bukan milik
 *     kami, kredit lengkap di footer.
 *  3. Panjang teks. Jumlah kata kita berbeda; yang diikuti geometri bloknya, bukan
 *     jumlah katanya.
 */


/* ---------- 2. how-it-works — tahapan sebagai satu bilah ---------- */

const TAHAP = [
  { lama: 'Sekali ketuk', klausa: 'Pilih kebutuhan Anda, atau pakai preset kursi roda dan low vision.', bg: 'bg-brand-900', teks: 'text-white' },
  { lama: 'Langsung', klausa: 'Setiap tempat dinilai ulang terhadap kebutuhan itu, termasuk yang belum diketahui.', bg: 'bg-accent-cyan', teks: 'text-ink' },
  { lama: 'Beberapa detik', klausa: 'Rute dibuat, lengkap dengan hambatan yang terdeteksi di jalurnya.', bg: 'bg-brand-700', teks: 'text-white' },
];

function CaraKerja() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-title" className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
      <Reveal>
        <h2 id="cara-title" className="max-w-[12ch] text-display font-extrabold leading-[0.95] tracking-[-0.03em]">
          Cara kerja
        </h2>
      </Reveal>

      {/* Satu bilah melintang, bukan tiga kartu berjajar: bilahnya sendiri yang jadi
          diagramnya. Lebar segmen dibuat SAMA, bukan proporsional terhadap durasi —
          ketiganya nyaris seketika, jadi lebar yang berbeda-beda hanya akan terlihat
          seperti data padahal bukan. */}
      <div className="mt-14 flex flex-col gap-1.5 sm:h-[22vh] sm:min-h-44 sm:flex-row">
        {TAHAP.map(({ lama, klausa, bg, teks }, i) => (
          <Reveal
            key={lama}
            delay={i * 0.06}
            className={`flex min-h-[4.5rem] flex-1 flex-col justify-between rounded-card p-5 ${bg} ${teks} ${teks === 'text-white' ? 'on-dark' : ''}`}
          >
            <p className="text-lead font-bold leading-tight">{lama}</p>
            {/* opacity-90 menurunkan kontras klausa di atas brand-500 jadi 3.6:1,
                di bawah ambang AA 4.5:1. Warna penuh, tanpa transparansi. */}
            <p className="font-sub mt-3 max-w-[24ch] text-sm sm:text-base">{klausa}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- 3. proof — cakupan sebagai tabel ---------- */

// Per wilayah, dari database 20 Okt 2026. "Belum diketahui" sengaja jadi kolom
// tersendiri, bukan sisa hitungan: itu satu-satunya angka yang membedakan kami.
const BARIS_CAKUPAN = [
  ['Kota Bogor', 51, 33],
  ['DKI Jakarta', 43, 32],
  ['Kota Bandung', 43, 34],
];

function Cakupan() {
  return (
    <section aria-labelledby="cakupan-title" className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
      <Reveal>
        <h2 id="cakupan-title" className="text-title font-extrabold leading-[1.02] tracking-[-0.02em]">
          Cakupan data
          <span className="block pl-[8%]">apa adanya</span>
        </h2>
      </Reveal>

      <Reveal delay={0.05} className="mt-12 overflow-x-auto">
        <table className="w-full border-collapse text-left sm:min-w-[32rem]">
          <caption className="sr-only">Jumlah fasilitas terdata dan yang sudah punya atribut aksesibilitas, per wilayah</caption>
          <thead>
            <tr className="text-sm text-ink-secondary">
              <th scope="col" className="py-3.5 pr-2 font-semibold sm:pr-4">Wilayah</th>
              <th scope="col" className="py-3.5 pr-2 font-semibold sm:pr-4">Fasilitas terdata</th>
              <th scope="col" className="py-3.5 pr-2 font-semibold sm:pr-4">Punya atribut</th>
              <th scope="col" className="py-3.5 text-right font-semibold">Belum diketahui</th>
            </tr>
          </thead>
          <tbody>
            {BARIS_CAKUPAN.map(([wilayah, total, beratribut]) => (
              // Nada latar berselang-seling menggantikan garis — lembar arah melarang
              // garis rambut di mana pun kecuali di dalam tabel, dan di sini pun nada
              // lebih tenang daripada garis.
              <tr key={wilayah} className="odd:bg-surface-subtle">
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
      </Reveal>

      <p className="font-sub mt-6 max-w-[62ch] text-sm text-ink-secondary">{COVERAGE_NOTE}</p>
    </section>
  );
}

/* ---------- 4. cta — ide yang sama, dibalik ---------- */

function Penutup() {
  return (
    <section
      aria-labelledby="penutup-title"
      className="on-dark flex flex-col bg-ink px-4 py-16 text-white sm:min-h-[90svh] sm:justify-between sm:py-20"
    >
      <div className="mx-auto w-full max-w-7xl">
        <Reveal>
          <h2 id="penutup-title" className="max-w-[14ch] text-display font-extrabold leading-[0.9] tracking-[-0.035em]">
            Datanya belum lengkap
          </h2>
        </Reveal>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-7xl gap-6 sm:mt-16 sm:grid-cols-12 sm:items-end">
        <p className="font-sub text-lg leading-relaxed text-brand-100 sm:col-span-5">
          Bantu lengkapi: tambahkan fasilitas atau perbarui datanya dengan foto bukti.
          Setiap kiriman ditinjau admin sebelum data resmi berubah.
        </p>
        <div className="sm:col-span-3 sm:col-start-10">
          <Link
            to="/facilities/new"
            className="ak-pil flex h-14 w-full items-center justify-center rounded-control bg-accent-cyan px-6 text-base font-bold text-ink hover:brightness-95"
          >
            Tambah fasilitas
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- pitch: contoh hasil yang sesungguhnya ---------- */

/**
 * Kepala halaman: baris chip di atas, judul besar di bawahnya.
 *
 * Ditiru dari acuan: di sana baris chip (Competition / Training / Friendly match)
 * berada tepat di atas judul besar, dengan satu chip gelap sebagai yang aktif. Di sini
 * chip-nya bukan hiasan — tiap satu membuka peta dengan kebutuhan itu sudah terpasang.
 */
function Pitch() {
  return (
    <section aria-labelledby="pitch-title" className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:pt-24">
      <ul aria-label="Mulai dari kebutuhan Anda" className="ak-chips flex flex-wrap gap-2">
        {NEEDS_PRESETS.map((p, j) => (
          <li key={p.key} style={{ '--j': j }}>
            <Link to={`/?needs=${p.codes.join(',')}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle">
              {p.label}
            </Link>
          </li>
        ))}
        <li style={{ '--j': NEEDS_PRESETS.length }}>
          <Link to="/" className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-brand-900">
            Lihat semua fasilitas
          </Link>
        </li>
      </ul>

      <h2 id="pitch-title" className="mt-7 max-w-[20ch] text-title font-extrabold leading-[0.95] tracking-[-0.035em]">
        Cek akses sebelum berangkat
      </h2>
      <p className="font-sub mt-5 max-w-[48ch] text-lead text-ink-secondary">
        Setiap tempat dicocokkan dengan kebutuhan Anda, bukan satu angka untuk semua orang.
      </p>
    </section>
  );
}

/**
 * Grid kartu campur, bahasa acuan: kartu foto bersudut besar dengan teks menumpang di
 * atasnya dan tombol panah bundar di pojok, berdampingan dengan blok warna padat.
 */
function KartuFoto({ src, alt, judul, keterangan, to, besar }) {
  return (
    <Reveal className={`group relative overflow-hidden rounded-[1.75rem] ${besar ? 'sm:col-span-2 sm:row-span-2' : ''}`}>
      <img src={src} alt={alt} loading="lazy" width="1920" height="1310" className={`${besar ? 'aspect-[4/3]' : 'aspect-[4/3] sm:aspect-[3/2]'} w-full scale-110 object-cover [filter:grayscale(1)_contrast(1.05)]`} />
      {/* Scrim: satu-satunya gradien yang diizinkan, dan hanya supaya teks di atas foto
          tetap terbaca. Tanpa ini kontrasnya bergantung pada kebetulan isi fotonya. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0 text-white">
          <p className={`font-extrabold leading-tight ${besar ? 'text-lead' : 'text-lg'}`}>{judul}</p>
          <p className="font-sub mt-1 max-w-[34ch] text-sm text-white/85">{keterangan}</p>
        </div>
        {to && (
          <Link to={to} aria-label={judul} className="ak-pil inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-ink hover:bg-surface-subtle">
            <ArrowUpRight aria-hidden="true" size={19} />
          </Link>
        )}
      </div>
    </Reveal>
  );
}

function Sorotan() {
  return (
    <section aria-labelledby="sorotan-title" className="mx-auto max-w-7xl px-4 pb-10">
      <h2 id="sorotan-title" className="sr-only">Tentang AksesKota</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <KartuFoto
          besar
          src="/img/straat-inbij-buitenzorg-huidige-bogor-west-java.jpg"
          alt="Jalan berpohon di Buitenzorg — kini Bogor — dengan sebuah kereta kuda, sekitar awal 1900-an."
          judul="Jalan yang sama, seratus tahun kemudian"
          keterangan="Sekarang yang kami ukur bukan pemandangannya, melainkan siapa yang bisa melewatinya."
          to="/"
        />

        {/* Blok warna padat di samping foto — pasangan yang persis dipakai acuan. */}
        <Reveal delay={0.05} className="on-dark flex flex-col justify-between rounded-[1.75rem] bg-brand-900 p-6 text-white">
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">Aturan kami</span>
          <div className="mt-8">
            <p className="text-lead font-extrabold leading-tight">Yang belum diketahui ditulis apa adanya</p>
            <p className="font-sub mt-2 text-sm text-brand-100">
              Tidak pernah dihitung sebagai tersedia. Salah menebak satu ramp berarti perjalanan yang gagal.
            </p>
          </div>
        </Reveal>

        <KartuFoto
          src="/img/eetstalletjes-aan-de-roode-brug-te-buitenzorg.jpg"
          alt="Deretan warung makan di dekat Jembatan Merah, Buitenzorg."
          judul="138 fasilitas terdata"
          keterangan="Bogor, Jakarta, dan Bandung."
        />
      </div>
    </section>
  );
}

export function LandingSections() {
  return (
    <>
      <Pitch />
      <Sorotan />
      <CaraKerja />
      <Cakupan />
      <Penutup />
    </>
  );
}
