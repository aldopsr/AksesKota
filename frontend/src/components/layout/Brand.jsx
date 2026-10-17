import { Link } from 'react-router-dom';

/**
 * Logo AksesKota: huruf A yang terbentuk dari sosok yang sedang bergerak —
 * kaki kiri sebagai langkah, kepala, dan sayap aqua sebagai kaki kanan.
 *
 * Digambar ulang sebagai SVG, bukan memasang berkas JPEG-nya: tajam di segala ukuran,
 * latarnya benar-benar transparan (JPEG membawa kotak lavender yang akan terlihat di
 * atas permukaan putih), dan warnanya bisa ikut tema.
 */
export function LogoMark({ size = 36 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* kaki kiri huruf A */}
      <path d="M10.2 29 L20.2 6.6" stroke="#7B7BE8" strokeWidth="5.6" strokeLinecap="round" />
      {/* puncak kanan, nada lebih terang */}
      <path d="M20.2 6.6 L24.9 13.1" stroke="#B3B0F0" strokeWidth="5.2" strokeLinecap="round" />
      {/* sayap aqua sebagai kaki kanan */}
      <path d="M16.8 21.2 C22.4 18.6 27.4 21.4 29.6 29" stroke="#A5D8DE" strokeWidth="5.4" strokeLinecap="round" />
      {/* kepala */}
      <circle cx="24.6" cy="16.4" r="3.1" fill="#3B35D1" />
    </svg>
  );
}

export function Wordmark({ light = false }) {
  return (
    <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
      Akses<span className={light ? 'text-brand-300' : 'text-brand-700'}>Kota</span>
    </span>
  );
}

export function BrandLink({ to = '/', light = false, size = 34 }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="AksesKota, ke beranda">
      <LogoMark size={size} /> <Wordmark light={light} />
    </Link>
  );
}
