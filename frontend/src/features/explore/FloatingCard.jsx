import { GripHorizontal, RotateCcw, X } from 'lucide-react';
import { useKartuApung } from '../../hooks/useKartuApung';

/**
 * Kartu mengambang di atas peta: bisa dipindahkan, posisinya diingat.
 *
 * Menggantikan kolom samping. Peta jadi lapisan utama dan isi menumpang di atasnya,
 * sehingga ruang peta hampir dua kali lipat di layar lebar.
 *
 * Perilaku seret/pindahnya ada di useKartuApung, dipakai bersama panel asisten.
 *
 * ponytail: ukuran kartu tidak bisa diubah. Menambah pegangan ukur berarti menambah
 * gestur kedua yang harus ikut punya padanan papan ketik; tambahkan kalau memang diminta.
 */
export default function FloatingCard({ id, label, posisiAwal, lebar = 24, onClose, aksi, children }) {
  const kartu = useKartuApung({ id, posisiAwal });

  return (
    <section
      ref={kartu.kartuRef}
      aria-label={label}
      style={{ ...kartu.gaya, width: `${lebar}rem` }}
      className={`ak-kartu-apung fixed left-0 top-0 z-30 flex flex-col overflow-hidden rounded-panel border border-border bg-surface ${
        kartu.menyeret ? 'shadow-dialog' : 'shadow-panel'
      }`}
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
        <button
          type="button"
          {...kartu.gagang}
          aria-label={`Pindahkan kartu ${label}. Gunakan tombol panah, tahan Shift untuk melangkah lebih jauh.`}
          className="flex min-h-9 flex-1 cursor-grab touch-none select-none items-center gap-2 rounded-control px-1.5 text-left text-sm font-semibold hover:bg-surface-subtle active:cursor-grabbing"
        >
          <GripHorizontal aria-hidden="true" size={16} className="shrink-0 text-ink-muted" />
          <span className="truncate">{label}</span>
        </button>
        {aksi}
        {kartu.dipindah && (
          <button
            type="button"
            onClick={kartu.reset}
            aria-label="Kembalikan kartu ke posisi semula"
            className="inline-flex size-9 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-subtle"
          >
            <RotateCcw aria-hidden="true" size={15} />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup ${label}`}
            className="inline-flex size-9 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-subtle"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}
