import { m } from 'motion/react';
import { List, Navigation } from 'lucide-react';
import { Button } from '../../components/ui';
import { MatchBadge } from '../../components/status';
import { levelFor } from '../accessibility/match';

// Bottom sheet mobile di atas peta: ringkasan hasil, pratinjau marker, atau ringkasan rute.
// Selalu ada tombol eksplisit (tidak hanya gestur) untuk membuka daftar/detail.
export default function MapSheet({ count, preview, onShowList, onOpen, onRoute, children }) {
  return (
    <m.div
      initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="absolute inset-x-0 bottom-0 z-30 rounded-t-[1.25rem] border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-popover lg:hidden"
    >
      <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-strong" />
      {children ?? (preview ? (
        <div>
          <p className="text-lg font-semibold leading-snug">{preview.name}</p>
          <p className="font-sub text-sm text-ink-secondary">{preview.address}</p>
          {preview.label && <div className="mt-1.5"><MatchBadge level={levelFor(preview)} percent={preview.match_pct} /></div>}
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => onOpen(preview.id)}>Lihat detail</Button>
            <Button variant="secondary" className="flex-1" onClick={() => onRoute(preview.id)}><Navigation aria-hidden="true" size={16} /> Rute</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="font-semibold">{count} fasilitas di peta</p>
          <Button variant="secondary" onClick={onShowList}><List aria-hidden="true" size={16} /> Lihat daftar</Button>
        </div>
      ))}
    </m.div>
  );
}
