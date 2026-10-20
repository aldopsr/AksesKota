import { useEffect, useId, useRef, useState } from 'react';
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react';
import { LEVELS } from '../accessibility/match';
import { Spinner } from '../../components/ui';

/**
 * Kontrol peta: satu klaster melayang di kanan, bukan tombol-tombol yang tersebar.
 *
 * Sebelumnya zoom ada di kanan atas dan legenda jadi tombol tersendiri di kiri atas,
 * berebut tempat dengan bilah pencarian. Mengumpulkannya jadi satu kolom membuat
 * pojok kiri sepenuhnya milik pencarian, dan semua kontrol manual berada di satu
 * tempat yang bisa dihafal.
 */

const kelasTombol =
  'inline-flex size-11 items-center justify-center bg-surface/95 text-ink backdrop-blur hover:bg-surface-subtle active:scale-[0.97] disabled:opacity-50';

function Tombol({ label, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${kelasTombol} ${className}`}
      style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
    >
      {children}
    </button>
  );
}

export function MapControls({ onZoomIn, onZoomOut, onLocate, locating }) {
  const [legenda, setLegenda] = useState(false);
  const id = useId();
  const bungkus = useRef(null);

  // Legenda menutup saat diklik di luar atau Escape: ia menumpang di atas peta, dan
  // panel yang menempel di sana menghalangi hal yang justru ingin dilihat pengguna.
  useEffect(() => {
    if (!legenda) return undefined;
    const klik = (e) => { if (!bungkus.current?.contains(e.target)) setLegenda(false); };
    const esc = (e) => { if (e.key === 'Escape') setLegenda(false); };
    document.addEventListener('pointerdown', klik);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', klik); document.removeEventListener('keydown', esc); };
  }, [legenda]);

  return (
    // Di layar sempit klaster ini turun ke bawah baris kategori. Pada posisi atas ia
    // menindih tombol "Tanya asisten" tepat di koordinat yang sama — di layar lebar
    // bilah perintah berhenti di 28rem sehingga keduanya tidak pernah bertemu.
    //
    // 7.5rem diukur dari wadah peta, bukan dari layar: wadahnya sendiri sudah mulai
    // 65 px di bawah header. Angka yang diukur dari layar membuat klaster ini jatuh
    // terlalu rendah dan tombol legendanya tertutup panel bawah.
    <div ref={bungkus} className="absolute right-3 top-[7.5rem] z-30 flex flex-col items-end gap-2 lg:top-[4.5rem]">
      <div className="flex flex-col overflow-hidden rounded-control border border-border-strong">
        <Tombol label="Perbesar peta" onClick={onZoomIn}><Plus aria-hidden="true" size={19} /></Tombol>
        <span aria-hidden="true" className="h-px bg-border" />
        <Tombol label="Perkecil peta" onClick={onZoomOut}><Minus aria-hidden="true" size={19} /></Tombol>
      </div>

      <div className="flex flex-col overflow-hidden rounded-control border border-border-strong">
        <Tombol label="Gunakan lokasi saya" onClick={onLocate}>
          {locating ? <Spinner size={19} /> : <LocateFixed aria-hidden="true" size={19} />}
        </Tombol>
        <span aria-hidden="true" className="h-px bg-border" />
        <button
          type="button"
          aria-expanded={legenda}
          aria-controls={id}
          aria-label="Keterangan warna penanda peta"
          onClick={() => setLegenda((v) => !v)}
          className={`${kelasTombol} ${legenda ? 'bg-brand-100 text-brand-900' : ''}`}
          style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
        >
          <Layers aria-hidden="true" size={19} />
        </button>
      </div>

      {legenda && (
        <div
          id={id}
          // Muncul dari sudut tombolnya, bukan dari tengah: panel yang membesar dari
          // titik lain terasa datang entah dari mana.
          className="ak-muncul w-64 origin-top-right rounded-card border border-border bg-surface p-3 shadow-popover"
        >
          <p className="mb-2 text-sm font-bold">Kecocokan dengan kebutuhan Anda</p>
          <ul className="space-y-1.5">
            {['high', 'partial', 'low', 'limited', 'neutral'].map((k) => {
              const l = LEVELS[k];
              return (
                <li key={k} className="flex items-center gap-2.5">
                  <span aria-hidden="true" style={{ background: l.bg }} className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ring-1 ring-border-strong">
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
