import { useId, useState } from 'react';
import { Bot, LocateFixed, Minus, Plus } from 'lucide-react';
import { LEVELS } from '../accessibility/match';
import { Button, IconButton, Spinner } from '../../components/ui';
import { Layers } from 'lucide-react';

// Kontrol peta: jarak antar tombol cukup, target 44px, nama aksesibel berbahasa Indonesia
export function MapControls({ onZoomIn, onZoomOut, onLocate, locating }) {
  return (
    <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
      <IconButton label="Perbesar peta" onClick={onZoomIn} className="shadow-panel"><Plus aria-hidden="true" size={20} /></IconButton>
      <IconButton label="Perkecil peta" onClick={onZoomOut} className="shadow-panel"><Minus aria-hidden="true" size={20} /></IconButton>
      <IconButton label="Gunakan lokasi saya" onClick={onLocate} className="mt-1 shadow-panel">{locating ? <Spinner size={20} /> : <LocateFixed aria-hidden="true" size={20} />}</IconButton>
    </div>
  );
}

export function MapLegend() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="absolute left-3 top-3 z-30">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 font-semibold shadow-panel hover:bg-surface-subtle">
        <Layers aria-hidden="true" size={18} /> Legenda
      </button>
      {open && (
        <div id={id} className="mt-2 w-64 rounded-card border border-border bg-surface p-3 shadow-popover">
          <p className="mb-2 font-semibold">Kecocokan dengan kebutuhan Anda</p>
          <ul className="space-y-2">
            {['high', 'partial', 'low', 'limited', 'neutral'].map((k) => {
              const l = LEVELS[k];
              return (
                <li key={k} className="flex items-center gap-2.5">
                  <span aria-hidden="true" style={{ background: l.bg }} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ring-1 ring-border-strong">
                    {l.symbol || <span className="size-2 rounded-full bg-white" />}
                  </span>
                  <span className="text-sm">{k === 'neutral' ? 'Belum ada kebutuhan dipilih' : l.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="font-sub mt-2 text-xs text-ink-secondary">Kecocokan bukan sertifikasi. Detail ada di halaman fasilitas.</p>
        </div>
      )}
    </div>
  );
}

export function AssistantFab({ onClick }) {
  return (
    <Button onClick={onClick} aria-haspopup="dialog" size="lg" className="absolute bottom-4 right-4 z-30 rounded-full shadow-popover max-lg:hidden">
      <Bot aria-hidden="true" size={20} /> Tanya asisten
    </Button>
  );
}
