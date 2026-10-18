import { useEffect, useRef, useState } from 'react';

/**
 * Angka yang merayap ke nilai barunya, bukan berganti mendadak.
 *
 * Bukan hiasan. Persentase kecocokan adalah HASIL HITUNGAN dari kebutuhan yang
 * dipilih pengguna — itu seluruh tesis produk ini. Kalau angkanya langsung berganti,
 * orang tidak sadar bahwa pilihannya barusan yang mengubahnya. Gerakannya menghubungkan
 * sebab dengan akibat.
 *
 * Tidak beranimasi saat pertama kali muncul: yang layak dianimasikan adalah PERUBAHAN,
 * bukan kemunculan. Daftar dua puluh kartu yang semuanya berhitung dari nol saat halaman
 * terbuka hanya bising.
 */
const DURASI = 420;

export default function AngkaBerjalan({ nilai, className = '' }) {
  const [tampil, setTampil] = useState(nilai);
  const sebelumnya = useRef(nilai);
  const raf = useRef(0);

  useEffect(() => {
    const dari = sebelumnya.current;
    sebelumnya.current = nilai;
    if (dari === nilai || nilai === null || nilai === undefined) { setTampil(nilai); return undefined; }

    // Hormati pengaturan sistem: gerakan bisa memicu mual pada sebagian orang.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setTampil(nilai); return undefined; }

    const mulai = performance.now();
    const jalan = (t) => {
      const p = Math.min(1, (t - mulai) / DURASI);
      // ease-out: cepat di awal lalu melambat, supaya terasa responsif sejak frame pertama
      const e = 1 - (1 - p) ** 3;
      setTampil(Math.round(dari + (nilai - dari) * e));
      if (p < 1) raf.current = requestAnimationFrame(jalan);
    };
    raf.current = requestAnimationFrame(jalan);
    return () => cancelAnimationFrame(raf.current);
  }, [nilai]);

  // tabular-nums: lebar tiap digit sama, jadi angkanya tidak bergoyang saat berhitung
  return <span className={`tabular-nums ${className}`}>{tampil}</span>;
}
