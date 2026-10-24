import { Link } from 'react-router-dom';
import { m } from 'motion/react';
import { MapPin, Navigation } from 'lucide-react';
import { ATTRIBUTE_LABEL, CATEGORY_LABEL, STATUS } from '../accessibility/constants';
import { categoryIcon } from '../accessibility/icons';
import { belumBisaDinilai } from '../accessibility/match';
import { MatchBadge } from '../../components/status';
import { formatDistance } from '../../lib/geo';

/**
 * Chip satu atribut: simbol + nama. Simbol dibaca lebih dulu daripada warna, jadi tetap
 * terbaca pengguna buta warna; warna hanya memperkuat. `?` berarti belum diketahui —
 * bukan "tidak ada", dan itu dinyatakan lewat teks pada pembaca layar.
 */
function AttributeChip({ code, status, urutan = 0 }) {
  const s = STATUS[status] ?? STATUS.unknown;
  return (
    <li style={{ '--j': urutan }} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <span aria-hidden="true">{s.symbol}</span>
      {ATTRIBUTE_LABEL[code] ?? code}
      <span className="sr-only">: {s.label}</span>
    </li>
  );
}

/**
 * Kartu hasil. Urutan sengaja: kecocokan dulu, baru nama.
 *
 * Alasannya pengguna di sini tidak sedang memilih tempat berdasarkan nama — mereka
 * memindai mana yang bisa mereka masuki. Versi sebelumnya menaruh nama dan alamat di
 * atas dan kecocokan di bawah, sehingga angka yang menjadi seluruh alasan produk ini
 * ada justru terbaca paling akhir.
 */
// onOpen: kait opsional yang ikut jalan saat kartunya dibuka — bukan pengganti navigasi.
// Dipakai panel asisten, yang harus menutup dirinya sendiri di layar sempit.
export default function FacilityCard({ facility: f, level, distance, selected, to, onRoute, onOpen, berbagiLayout = true }) {
  const Icon = categoryIcon(f.category);
  const jarak = distance !== null && distance !== undefined ? formatDistance(distance) : null;
  const kebutuhan = Object.entries(f.needs_status ?? {});
  /**
   * Chip hanya untuk kebutuhan yang BELUM terjawab.
   *
   * Dulu tiap kartu menampilkan chip untuk semua kebutuhan. Dengan tiga kebutuhan dan
   * dua puluh hasil yang semuanya 100%, layar berisi enam puluh pil hijau yang
   * mengulang persis apa yang sudah dikatakan lencana "Sangat Sesuai 100%" di atasnya —
   * banyak sekali tinta untuk nol informasi, dan justru menenggelamkan kartu yang
   * benar-benar punya masalah.
   *
   * Yang berharga adalah kebalikannya: apa yang TIDAK ada, atau belum diketahui.
   * Kartu sempurna kini diam; kartu bermasalah yang berbicara.
   */
  /**
   * layoutId hanya dipasang bila kartunya memang punya pasangan untuk dituju.
   *
   * layoutId itu GLOBAL di motion: dua elemen dengan id sama yang hidup bersamaan
   * dianggap satu elemen yang berpindah, dan yang kalah dirender kosong. Fasilitas yang
   * sama bisa muncul dua kali sekaligus — sekali di daftar hasil, sekali di kartu
   * rekomendasi dalam percakapan asisten — dan akibatnya nama serta lencana di kartu
   * asisten hilang, menyisakan alamat yang menggantung tanpa judul.
   *
   * Di dalam asisten tidak ada panel detail yang ditujunya, jadi tidak ada yang hilang
   * dengan mematikannya di sana.
   */
  const idNama = berbagiLayout ? { layoutId: `nama-${f.id}` } : {};
  const idLencana = berbagiLayout ? { layoutId: `match-${f.id}` } : {};

  const perluPerhatian = kebutuhan.filter(([, status]) => status !== 'available');
  const chipTampil = perluPerhatian.slice(0, 3);
  const sisaChip = perluPerhatian.length - chipTampil.length;

  return (
    <article
      id={`facility-${f.id}`}
      className={`relative rounded-card border bg-surface p-4 transition-colors duration-[var(--motion-fast)] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus ${selected ? 'border-brand-700 ring-2 ring-brand-200' : 'border-border'} hover:border-brand-400`}
    >
      {/* Baris penilaian: hal pertama yang dibaca. Jarak menempel di sini karena
          "seberapa cocok" dan "seberapa jauh" adalah satu keputusan, bukan dua. */}
      {/* layoutId: nama dan lencana kecocokan adalah elemen yang SAMA dengan yang ada di
          panel detail. Saat kartu dibuka, keduanya melebar ke posisi barunya alih-alih
          hilang lalu muncul lagi — aplikasi terasa satu ruang, bukan tumpukan halaman. */}
      {f.label && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <m.div {...idLencana}><MatchBadge level={level} percent={belumBisaDinilai(f) ? null : f.match_pct} /></m.div>
          {jarak && <span className="font-sub shrink-0 text-sm font-semibold text-ink-secondary">{jarak}</span>}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Ikon kategori dibuat netral: di dalam kartu, satu-satunya yang boleh berwarna
            adalah hal yang membawa makna — lencana kecocokan dan chip atribut. Ikon ungu
            di sebelahnya hanya bersaing menarik mata tanpa mengatakan apa pun. */}
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-subtle text-ink-secondary"><Icon size={20} /></span>
        <div className="min-w-0 flex-1">
          {/* Dibatasi dua baris: diuji dengan "Rumah Sakit Umum Daerah Dokter Soekardjo
              Kecamatan Bogor Tengah Provinsi Jawa Barat", namanya memanjat jadi empat
              baris dan kartunya hampir dua kali tinggi kartu lain. Nama utuhnya tetap
              ada di atribut title dan di halaman detail. */}
          <m.h3 {...idNama} title={f.name} className="line-clamp-2 text-base font-semibold leading-snug">
            <Link to={to} onClick={onOpen} aria-current={selected ? 'true' : undefined} className="after:absolute after:inset-0 focus-visible:outline-none">{f.name}</Link>
          </m.h3>
          {/* Satu baris keterangan, bukan tiga. Kategori sudah dikatakan ikon di
              sebelahnya, jadi menuliskannya lagi hanya menambah baris; alamat dipotong
              satu baris karena saat memindai daftar yang dicari nama, bukan alamat
              lengkap — alamat utuhnya ada di halaman detail.
              Kategori tetap dibacakan pembaca layar lewat teks tersembunyi, karena di
              sana ikon tidak mengatakan apa-apa. */}
          <p className="font-sub flex items-center gap-1 text-sm text-ink-secondary">
            <span className="sr-only">{CATEGORY_LABEL[f.category] ?? f.category_name}. </span>
            {f.address && <MapPin aria-hidden="true" className="shrink-0" size={14} />}
            <span className="truncate">{f.address || 'Alamat belum terdata'}</span>
            {!f.label && jarak && <strong className="shrink-0 font-semibold text-ink"> · {jarak}</strong>}
          </p>
        </div>

        {/* Tombol bundar berikon, bukan tombol berteks di barisnya sendiri: ia menghemat
            satu baris penuh pada setiap kartu, dan bentuk ini sudah dipakai di halaman
            depan sehingga terbaca sebagai "buka/lanjutkan" tanpa perlu dibaca. */}
        {onRoute && (
          <button
            type="button" onClick={onRoute}
            className="ak-pil relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink hover:bg-surface-subtle"
          >
            <Navigation aria-hidden="true" size={16} />
            <span className="sr-only">Rute ke {f.name}</span>
          </button>
        )}
      </div>

      {/* MANA yang terpenuhi, bukan sekadar "3 dari 4". Bagi pengguna kursi roda,
          "ada ramp tapi tidak ada lift" adalah informasi yang sama sekali berbeda dari 75%. */}
      {chipTampil.length > 0 && (
        <ul className="ak-chips mt-3 flex flex-wrap gap-1.5">
          {chipTampil.map(([code, status], j) => <AttributeChip key={code} code={code} status={status} urutan={j} />)}
          {sisaChip > 0 && (
            <li className="inline-flex items-center rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-ink-secondary">
              +{sisaChip} lagi
            </li>
          )}
        </ul>
      )}
      {/* Pembaca layar tidak melihat lencana kecocokan sebagai gambar utuh, jadi
          "tidak ada chip" tidak berarti apa-apa di sana. Satu kalimat menggantikannya. */}
      {kebutuhan.length > 0 && perluPerhatian.length === 0 && (
        <p className="sr-only">Semua kebutuhan Anda terpenuhi di tempat ini.</p>
      )}

      {/* Tanggal verifikasi dan rating dipindah ke halaman detail. Di dalam daftar
          keduanya menambah satu baris pada setiap kartu untuk informasi yang tidak
          dipakai saat memindai — keputusan "bisa saya masuki atau tidak" sudah dijawab
          lencana kecocokan dan chip atribut di atas. */}
    </article>
  );
}
