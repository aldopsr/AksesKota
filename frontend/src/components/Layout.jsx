import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'motion/react';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buttonClass } from './ui';

export function LogoMark({ size = 32 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#1b52d1" />
      <g fill="#ffe419">
        <circle cx="20" cy="20" r="5.5" /><circle cx="44" cy="20" r="5.5" />
        <circle cx="20" cy="44" r="5.5" /><circle cx="44" cy="44" r="5.5" />
        <circle cx="32" cy="32" r="5.5" />
      </g>
    </svg>
  );
}

function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setMsg(document.title), 200);
    return () => clearTimeout(t);
  }, [pathname]);
  return <div role="status" aria-live="polite" className="sr-only">{msg}</div>;
}

const navCls = ({ isActive }) =>
  `flex min-h-11 items-center rounded-xl px-3.5 font-bold transition-colors ${
    isActive ? 'bg-cobalt-50 text-cobalt-800' : 'text-slate-700 hover:bg-cobalt-50 hover:text-cobalt-800'
  }`;

function NavItems({ session, isAdmin }) {
  return (
    <>
      <NavLink to="/map" className={navCls}>Peta</NavLink>
      <NavLink to="/contribute/new" className={navCls}>Tambah fasilitas</NavLink>
      {session && <NavLink to="/me/contributions" className={navCls}>Kontribusi saya</NavLink>}
      {session && <NavLink to="/profile/accessibility" className={navCls}>Kebutuhan saya</NavLink>}
      {isAdmin && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
    </>
  );
}

function AuthActions({ session, me, onSignOut }) {
  return session ? (
    <>
      <span className="px-2 text-sm font-bold text-slate-700">{me?.name ?? 'Akun'}</span>
      <button type="button" onClick={onSignOut} className={buttonClass('light')}>
        <LogOut aria-hidden="true" size={18} /> Keluar
      </button>
    </>
  ) : (
    <>
      <Link to="/login" className={buttonClass('light')}>Masuk</Link>
      <Link to="/register" className={buttonClass('primary')}>Daftar</Link>
    </>
  );
}

export default function Layout() {
  const { session, me, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMap = pathname.startsWith('/map');
  const section = pathname.split('/')[1] || 'home';

  useEffect(() => {
    setOpen(false);
    if (!isMap) window.scrollTo(0, 0);
  }, [pathname, isMap]);

  function handleSignOut() {
    signOut();
    navigate('/');
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-sun-400 focus:px-5 focus:py-3 focus:font-bold focus:text-ink"
      >
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-40 border-b border-cobalt-100 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="AksesKota, ke beranda">
            <LogoMark />
            <span className="font-display text-xl font-bold tracking-tight text-ink">Akses<span className="text-cobalt-600">Kota</span></span>
          </Link>

          <nav aria-label="Navigasi utama" className="ml-auto hidden items-center gap-1 lg:flex">
            <NavItems session={session} isAdmin={isAdmin} />
            <div className="ml-3 flex items-center gap-2 border-l border-cobalt-100 pl-3">
              <AuthActions session={session} me={me} onSignOut={handleSignOut} />
            </div>
          </nav>

          <button
            type="button"
            className={buttonClass('light', 'ml-auto lg:hidden')}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
            Menu
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <m.nav
              id="mobile-nav"
              aria-label="Navigasi seluler"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 top-16 flex flex-col gap-1 border-b border-cobalt-100 bg-white p-4 shadow-lg lg:hidden"
            >
              <NavItems session={session} isAdmin={isAdmin} />
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-cobalt-100 pt-3">
                <AuthActions session={session} me={me} onSignOut={handleSignOut} />
              </div>
            </m.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <m.div key={section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <Outlet />
        </m.div>
      </main>

      {!isMap && (
        <footer className="border-t border-cobalt-100 bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_auto_1.4fr]">
            <div className="max-w-sm">
              <Link to="/" className="flex items-center gap-2.5">
                <LogoMark size={28} />
                <span className="font-display text-lg font-bold text-ink">Akses<span className="text-cobalt-600">Kota</span></span>
              </Link>
              <p className="mt-2 text-slate-700">Cek dulu aksesnya, baru berangkat.</p>
            </div>
            <nav aria-label="Tautan footer">
              <ul className="font-bold">
                {[['/map', 'Peta fasilitas'], ['/contribute/new', 'Tambah fasilitas'], ['/profile/accessibility', 'Kebutuhan saya']].map(([to, label]) => (
                  <li key={to}><Link to={to} className="inline-flex min-h-11 items-center text-slate-700 hover:text-cobalt-700">{label}</Link></li>
                ))}
              </ul>
            </nav>
            <p className="text-sm text-slate-600">
              Informasi aksesibilitas berasal dari data yang dipetakan dan kontribusi pengguna yang telah diverifikasi. Kondisi di lapangan dapat berubah, dan AksesKota tidak menjamin suatu fasilitas atau rute sepenuhnya bebas hambatan.
            </p>
          </div>
        </footer>
      )}
      <RouteAnnouncer />
    </div>
  );
}
