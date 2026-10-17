import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Panel bawah yang bisa ditarik di atas peta (mobile).
 *
 * Menggantikan tombol Daftar/Peta. Dengan tombol itu, peta dan hasil tidak pernah
 * terlihat bersamaan — padahal memilih tempat justru butuh keduanya sekaligus.
 *
 * Gesturnya ditulis dengan Pointer Events, bukan fitur drag Motion: paket ini dimuat
 * dengan `domAnimation` yang tidak menyertakan drag, dan menaikkannya ke `domMax`
 * membebani bundle untuk satu komponen.
 *
 * Tiga aturan yang membuatnya terasa benar:
 *  1. Panel menempel 1:1 pada jari selama ditarik — bukan menunggu jari dilepas.
 *  2. Kecepatan lepas ikut dihitung. Sentakan cepat berpindah posisi walau jaraknya
 *     pendek; tanpa ini pengguna harus menyeret jauh dan terasa berat.
 *  3. Di luar batas, gerakan diredam, bukan dihentikan mendadak. Benda nyata melambat
 *     dulu sebelum berhenti.
 *
 * ponytail: tarikan hanya dari gagang, bukan dari seluruh isi panel. Menarik dari isi
 * butuh serah-terima antara scroll dan gestur yang mudah salah; kalau nanti terasa
 * kurang, tambahkan: mulai drag dari isi hanya ketika scrollTop === 0.
 */

const SENTAKAN = 0.4; // px/ms — di atas ini dianggap sentakan, bukan seretan
const REDAM = 0.35; // seberapa jauh panel masih bergerak setelah melewati batas atas

export default function BottomSheet({ titikPeek = 120, label, ringkasan, children }) {
  const panelRef = useRef(null);
  const [snapIdx, setSnapIdx] = useState(1); // 0 peek, 1 setengah, 2 penuh
  const [menarik, setMenarik] = useState(false);
  // Posisi istirahat dipegang state, bukan ditulis langsung ke elemen: `style` di JSX
  // dikelola React, jadi setiap render akan menghapus transform yang ditulis imperatif.
  // Selama jari menempel barulah transform ditulis langsung — supaya tiap frame tidak
  // memicu render ulang React.
  const [offset, setOffset] = useState(null);
  const snaps = useRef([0, 0, 0]);
  const geser = useRef({ aktif: false, mulaiY: 0, mulaiOffset: 0, jejak: [] });

  // Offset = seberapa jauh panel digeser ke bawah dari posisi penuh.
  const hitungSnaps = useCallback(() => {
    const tinggi = panelRef.current?.offsetHeight ?? 0;
    snaps.current = [Math.max(0, tinggi - titikPeek), Math.round(tinggi * 0.45), 0];
    setOffset((o) => (o === null ? snaps.current[1] : o));
  }, [titikPeek]);

  useEffect(() => {
    hitungSnaps();
    const ro = new ResizeObserver(hitungSnaps);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [hitungSnaps]);

  const keSnap = useCallback((idx) => {
    setSnapIdx(idx);
    setOffset(snaps.current[idx]);
  }, []);

  const onPointerDown = (e) => {
    if (geser.current.aktif) return; // jari kedua diabaikan: tanpa ini panel melompat
    e.currentTarget.setPointerCapture(e.pointerId);
    geser.current = { aktif: true, mulaiY: e.clientY, mulaiOffset: snaps.current[snapIdx], jejak: [] };
    setMenarik(true);
  };

  const onPointerMove = (e) => {
    const g = geser.current;
    if (!g.aktif) return;
    let offset = g.mulaiOffset + (e.clientY - g.mulaiY);
    const maks = snaps.current[0];
    // Di luar batas: diredam, tidak ditembok.
    if (offset < 0) offset *= REDAM;
    else if (offset > maks) offset = maks + (offset - maks) * REDAM;
    if (panelRef.current) panelRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    g.jejak.push({ y: e.clientY, t: performance.now() });
    if (g.jejak.length > 5) g.jejak.shift();
  };

  const onPointerUp = (e) => {
    const g = geser.current;
    if (!g.aktif) return;
    g.aktif = false;
    setMenarik(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const offset = g.mulaiOffset + (e.clientY - g.mulaiY);
    // Kecepatan dari beberapa titik terakhir, bukan dari satu titik: satu titik
    // menghasilkan angka yang melompat-lompat di akhir gestur.
    const awal = g.jejak[0];
    const akhir = g.jejak[g.jejak.length - 1];
    const dt = akhir && awal ? akhir.t - awal.t : 0;
    const kecepatan = dt > 0 ? (akhir.y - awal.y) / dt : 0;

    if (Math.abs(kecepatan) > SENTAKAN) {
      // Sentakan: pindah satu posisi ke arah gerakan, berapa pun jaraknya.
      keSnap(Math.max(0, Math.min(2, snapIdx + (kecepatan > 0 ? -1 : 1))));
      return;
    }
    // Seretan pelan: berhenti di posisi terdekat dari tempat jari dilepas.
    let terdekat = 0;
    snaps.current.forEach((s, i) => {
      if (Math.abs(offset - s) < Math.abs(offset - snaps.current[terdekat])) terdekat = i;
    });
    keSnap(terdekat);
  };

  const namaPosisi = ['sebagian kecil', 'setengah layar', 'satu layar penuh'];

  return (
    <div
      ref={panelRef}
      className="absolute inset-x-0 bottom-0 z-30 flex h-[92dvh] flex-col rounded-t-[1.25rem] border-t border-border bg-surface shadow-popover lg:hidden"
      style={{
        transform: `translate3d(0, ${offset ?? 0}px, 0)`,
        // Transisi dimatikan selama menarik supaya panel benar-benar menempel pada jari.
        transition: menarik ? 'none' : 'transform 320ms var(--ease-sheet)',
        willChange: 'transform',
        visibility: offset === null ? 'hidden' : undefined,
      }}
    >
      {/* Gagang: satu-satunya permukaan gestur. touch-action none karena ia memiliki
          sumbu vertikal; tanpa itu browser ikut menggulir halaman saat ditarik. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}. Posisi ${namaPosisi[snapIdx]}. Tarik, atau tekan untuk mengubah tinggi panel.`}
        aria-expanded={snapIdx === 2}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => keSnap(snapIdx === 2 ? 0 : snapIdx + 1)}
        onKeyDown={(e) => {
          // Keyboard tidak bisa menyeret, jadi panah naik/turun memindahkan posisi.
          if (e.key === 'ArrowUp') { e.preventDefault(); keSnap(Math.min(2, snapIdx + 1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); keSnap(Math.max(0, snapIdx - 1)); }
        }}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-3 active:cursor-grabbing"
      >
        <div aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-border-strong" />
        {ringkasan && <div className="mt-2">{ringkasan}</div>}
      </div>

      {/* overscroll contain: saat daftar mentok, peta di belakang tidak ikut tergeser. */}
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
