import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Perilaku kartu mengambang: diseret, dipindah dengan papan ketik, posisinya diingat.
 *
 * Dipakai bersama oleh kartu hasil/detail dan panel asisten. Ditaruh di satu tempat
 * supaya keduanya benar-benar berperilaku sama — dua salinan logika gestur pasti
 * menyimpang begitu salah satunya diperbaiki.
 *
 * Aturan yang tidak boleh hilang: memindahkan kartu SELALU opsional. Ini aplikasi
 * untuk pengguna disabilitas, dan menyeret menuntut kontrol motorik halus yang justru
 * tidak dimiliki sebagian penggunanya. Karena itu gagangnya selalu tombol sungguhan
 * dengan padanan papan ketik, dan posisi bawaannya harus sudah benar tanpa digeser.
 */

const LANGKAH = 16;
const LANGKAH_JAUH = 64;
const TEPI = 12;

const simpan = (id, pos) => {
  try { localStorage.setItem(`ak_kartu_${id}`, JSON.stringify(pos)); } catch { /* mode privat */ }
};
const muat = (id) => {
  try {
    const v = JSON.parse(localStorage.getItem(`ak_kartu_${id}`) || 'null');
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null;
  } catch { return null; }
};

export function useKartuApung({ id, posisiAwal, aktif = true }) {
  const kartuRef = useRef(null);
  // posisiAwal boleh berupa fungsi: posisi bawaan panel asisten bergantung pada
  // ukuran jendela, yang tidak ada saat modul dimuat.
  const awalRef = useRef(null);
  if (awalRef.current === null) awalRef.current = typeof posisiAwal === 'function' ? posisiAwal() : posisiAwal;
  const awal = awalRef.current;

  const [pos, setPos] = useState(() => muat(id) ?? awal);
  const [menyeret, setMenyeret] = useState(false);
  const geser = useRef({ aktif: false, dx: 0, dy: 0 });
  const dipindah = pos.x !== awal.x || pos.y !== awal.y;

  // Kartu yang tersimpan di luar layar (jendela mengecil, pindah monitor) tidak bisa
  // diraih sama sekali, jadi posisinya selalu dijepit ke dalam viewport.
  //
  // Batas atasnya posisi bawaan, bukan tepi layar: di atas situ ada bilah perintah,
  // dan kartu yang menutupinya membuat pencarian tidak bisa dipakai sama sekali.
  const jepit = useCallback((p) => {
    const w = kartuRef.current?.offsetWidth ?? 384;
    return {
      x: Math.round(Math.min(Math.max(TEPI, p.x), Math.max(TEPI, window.innerWidth - w - TEPI))),
      y: Math.round(Math.min(Math.max(awal.y, p.y), Math.max(awal.y, window.innerHeight - 160 - TEPI))),
    };
  }, [awal.y]);

  useEffect(() => {
    if (!aktif) return undefined;
    // Hasil penjepitan ikut disimpan, bukan hanya dipakai menggambar. Tanpa itu,
    // posisi yang terlanjur cacat — misalnya hasil penjepitan saat jendela sesaat
    // berukuran aneh ketika diubah ukurannya — bertahan di localStorage selamanya dan
    // menaruh kartu di tempat yang tidak masuk akal setiap kali halaman dibuka.
    const rapikan = () => setPos((p) => {
      const aman = jepit(p);
      if (aman.x !== p.x || aman.y !== p.y) simpan(id, aman);
      return aman;
    });
    rapikan();
    window.addEventListener('resize', rapikan);
    return () => window.removeEventListener('resize', rapikan);
  }, [jepit, aktif, id]);

  const pindah = useCallback((next) => {
    const aman = jepit(next);
    setPos(aman);
    simpan(id, aman);
  }, [jepit, id]);

  const reset = useCallback(() => { setPos(awal); simpan(id, awal); }, [awal, id]);

  const onPointerDown = (e) => {
    if (geser.current.aktif) return; // jari/kursor kedua diabaikan: tanpa ini kartu melompat
    e.currentTarget.setPointerCapture(e.pointerId);
    geser.current = { aktif: true, dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setMenyeret(true);
  };
  const onPointerMove = (e) => {
    if (!geser.current.aktif) return;
    // Selama kursor menempel, transform ditulis langsung supaya tiap frame tidak
    // memicu render ulang React. Nilai akhirnya baru masuk state saat dilepas.
    if (kartuRef.current) {
      kartuRef.current.style.transform =
        `translate3d(${e.clientX - geser.current.dx}px, ${e.clientY - geser.current.dy}px, 0)`;
    }
  };
  const onPointerUp = (e) => {
    if (!geser.current.aktif) return;
    geser.current.aktif = false;
    setMenyeret(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    pindah({ x: e.clientX - geser.current.dx, y: e.clientY - geser.current.dy });
  };
  const onKeyDown = (e) => {
    const jauh = e.shiftKey ? LANGKAH_JAUH : LANGKAH;
    const arah = {
      ArrowLeft: { x: -jauh, y: 0 }, ArrowRight: { x: jauh, y: 0 },
      ArrowUp: { x: 0, y: -jauh }, ArrowDown: { x: 0, y: jauh },
    }[e.key];
    if (!arah) return;
    e.preventDefault();
    pindah({ x: pos.x + arah.x, y: pos.y + arah.y });
  };

  return {
    kartuRef,
    pos,
    menyeret,
    dipindah,
    reset,
    // Disebar ke tombol gagang. Pointer untuk menyeret, panah untuk papan ketik.
    gagang: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
    // Gaya posisi kartu. Tinggi maksimum dihitung dari posisi kartunya sendiri —
    // max-height tetap membuat kartu yang digeser ke bawah menjulur keluar layar.
    gaya: {
      transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
      maxHeight: `calc(100dvh - ${pos.y}px - 0.75rem)`,
      transition: menyeret ? 'none' : 'transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out)',
    },
  };
}
