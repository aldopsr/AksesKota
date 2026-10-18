import { Link } from 'react-router-dom';
import { m } from 'motion/react';
import { MapPin, Navigation } from 'lucide-react';
import { ATTRIBUTE_LABEL, CATEGORY_LABEL, STATUS } from '../accessibility/constants';
import { categoryIcon } from '../accessibility/icons';
import { MatchBadge, Stars } from '../../components/status';
import { Button } from '../../components/ui';
import { formatDistance } from '../../lib/geo';
import { formatDate } from '../../lib/format';

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
export default function FacilityCard({ facility: f, level, distance, selected, to, onRoute, compact = false }) {
  const Icon = categoryIcon(f.category);
  const jarak = distance !== null && distance !== undefined ? formatDistance(distance) : null;
  const diverifikasi = f.last_verified_at ? formatDate(f.last_verified_at) : null;
  const kebutuhan = Object.entries(f.needs_status ?? {});

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
          <m.div layoutId={`match-${f.id}`}><MatchBadge level={level} percent={f.match_pct} /></m.div>
          {jarak && <span className="font-sub shrink-0 text-sm font-semibold text-ink-secondary">{jarak}</span>}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Ikon kategori dibuat netral: di dalam kartu, satu-satunya yang boleh berwarna
            adalah hal yang membawa makna — lencana kecocokan dan chip atribut. Ikon ungu
            di sebelahnya hanya bersaing menarik mata tanpa mengatakan apa pun. */}
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-subtle text-ink-secondary"><Icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <m.h3 layoutId={`nama-${f.id}`} className="text-base font-semibold leading-snug">
            <Link to={to} aria-current={selected ? 'true' : undefined} className="after:absolute after:inset-0 focus-visible:outline-none">{f.name}</Link>
          </m.h3>
          <p className="font-sub text-sm text-ink-secondary">
            {CATEGORY_LABEL[f.category] ?? f.category_name}
            {!f.label && jarak && <> · <strong className="font-semibold text-ink">{jarak}</strong></>}
          </p>
          <p className="font-sub mt-0.5 flex items-start gap-1 text-sm text-ink-secondary">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
            <span>{f.address}</span>
          </p>
        </div>
      </div>

      {/* MANA yang terpenuhi, bukan sekadar "3 dari 4". Bagi pengguna kursi roda,
          "ada ramp tapi tidak ada lift" adalah informasi yang sama sekali berbeda dari 75%. */}
      {kebutuhan.length > 0 && (
        <ul className="ak-chips mt-3 flex flex-wrap gap-1.5">
          {kebutuhan.map(([code, status], j) => <AttributeChip key={code} code={code} status={status} urutan={j} />)}
        </ul>
      )}

      {/* Baris ini hanya muncul kalau memang ada isinya. Sebelumnya selalu tampil dan
          menuliskan "Diverifikasi -" untuk fasilitas yang belum pernah diverifikasi. */}
      {!compact && (diverifikasi || f.rating_count > 0) && (
        <p className="font-sub mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
          {diverifikasi && <span>Diverifikasi {diverifikasi}</span>}
          {f.rating_count > 0 && <span className="inline-flex items-center gap-1"><Stars value={f.rating_avg} /> {f.rating_avg} ({f.rating_count})</span>}
        </p>
      )}

      {onRoute && (
        <div className="relative z-10 mt-3">
          <Button variant="secondary" size="sm" onClick={onRoute}><Navigation aria-hidden="true" size={15} /> Rute<span className="sr-only"> ke {f.name}</span></Button>
        </div>
      )}
    </article>
  );
}
