import { Link } from 'react-router-dom';

// Simbol abstrak: pin lokasi + garis rute. Bukan simbol disabilitas literal (design system 3.3).
export function LogoMark({ size = 36 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="11" fill="#4f46e5" />
      <path d="M20 8c-5 0-9 3.9-9 8.8 0 6.5 9 13.2 9 13.2s9-6.7 9-13.2C29 11.9 25 8 20 8z" fill="#fff" />
      <circle cx="20" cy="16.8" r="3.6" fill="#4f46e5" />
      <path d="M10 33.5c3.3-2.2 6.6-2.2 10 0s6.7 2.2 10 0" stroke="#a8dfe8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
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
