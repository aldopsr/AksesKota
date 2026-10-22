import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

/**
 * Angka yang menghitung naik dari nol saat masuk layar — sekali saja.
 *
 * Berbeda dari AngkaBerjalan (yang menganimasikan PERUBAHAN nilai), ini menganimasikan
 * KEMUNCULAN. Layak di sini karena empat angka ini adalah bukti utama halaman: menghitung
 * naik membuat mata berhenti di tiap angka, dan angka terakhir (yang jujur soal lubang
 * data) tidak lewat begitu saja.
 *
 * Pembaca layar hanya menerima nilai akhir (sr-only), bukan angka antara yang berlari.
 * Dengan prefers-reduced-motion nilai akhir langsung tampil tanpa menghitung.
 */
const fmt = new Intl.NumberFormat('id-ID');

export default function AngkaHitung({ nilai, durasi = 1100, className = '' }) {
  const ref = useRef(null);
  const terlihat = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const kurangiGerak = useReducedMotion();
  const [tampil, setTampil] = useState(0);

  useEffect(() => {
    if (!terlihat) return undefined;
    if (kurangiGerak) { setTampil(nilai); return undefined; }
    const mulai = performance.now();
    let raf = 0;
    const jalan = (t) => {
      const p = Math.min(1, (t - mulai) / durasi);
      setTampil(Math.round(nilai * (1 - (1 - p) ** 4))); // ease-out: cepat, lalu mengendap
      if (p < 1) raf = requestAnimationFrame(jalan);
    };
    raf = requestAnimationFrame(jalan);
    return () => cancelAnimationFrame(raf);
  }, [terlihat, kurangiGerak, nilai, durasi]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className={`tabular-nums ${className}`}>{fmt.format(tampil)}</span>
      <span className="sr-only">{fmt.format(nilai)}</span>
    </>
  );
}
