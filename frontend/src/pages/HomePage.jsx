import { COVERAGE_NOTE } from '../features/accessibility/constants';
import Reveal from '../components/Reveal';
import { ListChecks, Path, Wheelchair } from '@phosphor-icons/react';

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
  { lama: 'Sekali ketuk', Ikon: Wheelchair, klausa: 'Pilih kebutuhan Anda, atau pakai preset kursi roda dan low vision.', bg: 'bg-brand-900', teks: 'text-white' },
  { lama: 'Langsung', Ikon: ListChecks, klausa: 'Setiap tempat dinilai ulang terhadap kebutuhan itu, termasuk yang belum diketahui.', bg: 'bg-accent-cyan', teks: 'text-ink' },
  { lama: 'Beberapa detik', Ikon: Path, klausa: 'Rute dibuat, lengkap dengan hambatan yang terdeteksi di jalurnya.', bg: 'bg-brand-700', teks: 'text-white' },
];

function CaraKerja() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-title" className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
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
        {TAHAP.map(({ lama, Ikon, klausa, bg, teks }, i) => (
          <Reveal
            key={lama}
            delay={i * 0.06}
            className={`flex min-h-[4.5rem] flex-1 flex-col justify-between rounded-card p-5 ${bg} ${teks} ${teks === 'text-white' ? 'on-dark' : ''}`}
          >
            <Ikon aria-hidden="true" size={30} weight="regular" />
            <p className="mt-4 text-lead font-bold leading-tight">{lama}</p>
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
    /* Pita warna, melanjutkan selang-seling bab: putih, bernada, putih, bernada, gelap.
       Tanpa itu "Cara kerja" dan bagian ini menyatu jadi satu blok putih panjang. */
    <section aria-labelledby="cakupan-title" className="bg-brand-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
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
      </Reveal>

      {/* Pendirian yang dulu berdiri sebagai kartu terpisah di bagian Sorotan.
          Tempatnya memang di sini: ia menjelaskan arti kolom "Belum diketahui" di
          tabel tepat di atasnya, bukan berdiri sendiri sebagai slogan. */}
      <p className="mt-8 max-w-[46ch] text-lead font-bold leading-snug">
        Yang belum diketahui ditulis apa adanya — tidak pernah dihitung sebagai tersedia.
      </p>
      <p className="font-sub mt-3 max-w-[52ch] text-ink-secondary">
        Salah menebak satu ramp berarti perjalanan yang gagal.
      </p>

      <p className="font-sub mt-8 max-w-[62ch] text-sm text-ink-secondary">{COVERAGE_NOTE}</p>
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
    <section aria-labelledby="pitch-title" className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:pb-24 sm:pt-28">
      {/* Baris pengantar kecil di atas judul besar — pada acuan inilah yang memberi
          judul display sebuah pijakan, alih-alih membiarkannya muncul begitu saja. */}
      <p className="font-sub text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Peta aksesibilitas</p>
      {/* Chip preset kebutuhan dulu berdiri di sini. Dihapus setelah pengujian: ia
          berada DI BAWAH hero peta, jadi satu-satunya cara mencapainya adalah menggulir
          melewati peta — yang saat itu justru mustahil karena peta menangkap roda mouse.
          Orang yang berhasil menekannya pun dikirim kembali ke atas, ke peta yang baru
          saja mereka tinggalkan. Pintu yang sama sudah ada di dua tempat yang benar:
          kartu kebutuhan di atas peta, dan menu filter di navbar. */}
      <h2 id="pitch-title" className="mt-4 max-w-[20ch] text-title font-extrabold leading-[0.95] tracking-[-0.035em]">
        Cek akses sebelum berangkat
      </h2>
      <p className="font-sub mt-5 max-w-[48ch] text-lead text-ink-secondary">
        Setiap tempat dicocokkan dengan kebutuhan Anda, bukan satu angka untuk semua orang.
      </p>
    </section>
  );
}

/* Sorotan (tiga kartu foto arsip) dan Penutup (CTA gelap) dulu ada di sini.
   Sorotan dibuang: halaman ini kini halaman PENJELASAN — petanya sudah punya rumah
   sendiri di "/" — dan tiga kartu bergambar yang tidak menjelaskan apa pun hanya
   menunda isi yang sebenarnya. Penguji menyebutnya "nanggung"; mereka benar.
   Penutup dipindah ke footer, supaya halaman tidak berakhir dua kali. */

export function LandingSections() {
  return (
    <>
      <Pitch />
      <CaraKerja />
      <Cakupan />
    </>
  );
}
