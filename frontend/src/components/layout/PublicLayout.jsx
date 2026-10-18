import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import { Compass, LogOut, PlusCircle, ShieldCheck, UserRound, ClipboardList, CircleUserRound, ListChecks } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AssistantProvider, LocationProvider, ToastProvider } from '../../context/AppContexts';
import AssistantDock from '../../features/ai/AssistantDock';
import { BrandLink } from './Brand';
import { LinkButton, Menu, buttonClass, menuItemClass } from '../ui';

function RouteAnnouncer() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = setTimeout(() => { const el = document.getElementById('route-announcer'); if (el) el.textContent = document.title; }, 250);
    return () => clearTimeout(t);
  }, [pathname]);
  return <div id="route-announcer" role="status" aria-live="polite" className="sr-only" />;
}

const navCls = (on) => `inline-flex min-h-11 items-center rounded-control px-3.5 font-semibold transition-colors ${on ? 'bg-brand-100 text-brand-900' : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'}`;

function AccountMenu() {
  const { me, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (me?.name ?? 'A').trim().charAt(0).toUpperCase();
  return (
    <Menu
      label={<span className="max-w-28 truncate sm:max-w-40">{me?.name ?? 'Akun'}</span>}
      buttonClassName={`${buttonClass('secondary')} pl-1.5`}
      icon={() => <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{initial}</span>}
    >
      <Link to="/accessibility-profile" className={menuItemClass}><UserRound aria-hidden="true" size={18} /> Profil aksesibilitas</Link>
      <Link to="/my-contributions" className={menuItemClass}><ListChecks aria-hidden="true" size={18} /> Kontribusi saya</Link>
      {isAdmin && <Link to="/admin" className={menuItemClass}><ShieldCheck aria-hidden="true" size={18} /> Dasbor admin</Link>}
      <div className="my-1 border-t border-border" />
      <button type="button" data-close className={menuItemClass} onClick={() => { signOut(); navigate('/'); }}><LogOut aria-hidden="true" size={18} /> Keluar</button>
    </Menu>
  );
}

function Header() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const exploring = pathname.startsWith('/map') || (pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update'));
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <BrandLink />
        <nav aria-label="Navigasi utama" className="ml-4 hidden items-center gap-1 md:flex">
          <NavLink to="/map" className={() => navCls(exploring)} aria-current={exploring ? 'page' : undefined}><Compass aria-hidden="true" size={18} className="mr-1.5" /> Jelajahi</NavLink>
          <Menu label="Kontribusi" align="left" buttonClassName={`${navCls(pathname.startsWith('/facilities/new') || pathname.includes('/update') || pathname.startsWith('/my-contributions'))} gap-1`}>
            <Link to="/facilities/new" className={menuItemClass}><PlusCircle aria-hidden="true" size={18} /> Tambah fasilitas</Link>
            <Link to="/map?intent=update" className={menuItemClass}><ClipboardList aria-hidden="true" size={18} /> Perbarui data fasilitas</Link>
            {session && <Link to="/my-contributions" className={menuItemClass}><ListChecks aria-hidden="true" size={18} /> Kontribusi saya</Link>}
          </Menu>
          <Link to="/tentang#cara-kerja" className={navCls(false)}>Cara kerja</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {session ? <AccountMenu /> : (
            <>
              <LinkButton to="/login" variant="secondary">Masuk</LinkButton>
              <LinkButton to="/register" className="hidden sm:inline-flex">Daftar</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Navigasi bawah mobile: hanya 3 tujuan utama, dan TIDAK tampil di halaman peta/form agar tidak menutup kontrol
const BOTTOM_NAV_PATHS = ['/', '/accessibility-profile', '/my-contributions'];
function BottomNav() {
  const { session } = useAuth();
  const items = [
    { to: '/map', label: 'Jelajahi', Icon: Compass },
    { to: '/facilities/new', label: 'Kontribusi', Icon: PlusCircle },
    session ? { to: '/accessibility-profile', label: 'Profil', Icon: UserRound } : { to: '/login', label: 'Masuk', Icon: CircleUserRound },
  ];
  return (
    <nav aria-label="Navigasi bawah" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink to={to} end className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${isActive ? 'text-brand-800' : 'text-ink-secondary'}`}>
              <Icon aria-hidden="true" size={22} /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_auto_1.3fr]">
        <div>
          <BrandLink size={30} />
          <p className="font-sub mt-2 max-w-xs text-ink-secondary">Cek dulu aksesnya, baru berangkat.</p>
        </div>
        <nav aria-label="Tautan footer">
          <ul className="font-semibold">
            {[['/map', 'Jelajahi fasilitas'], ['/facilities/new', 'Tambah fasilitas'], ['/tentang#cara-kerja', 'Cara kerja']].map(([to, label]) => (
              <li key={to}><Link to={to} className="inline-flex min-h-11 items-center text-ink-secondary hover:text-brand-800">{label}</Link></li>
            ))}
          </ul>
        </nav>
        <p className="font-sub text-sm text-ink-secondary">
          Informasi aksesibilitas berasal dari data yang dipetakan dan kontribusi pengguna yang telah diverifikasi. Kondisi di lapangan dapat berubah, dan AksesKota tidak menjamin suatu fasilitas atau rute sepenuhnya bebas hambatan.
        </p>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname, hash } = useLocation();
  const workspace = pathname.startsWith('/map') || (pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update'));
  const showBottomNav = BOTTOM_NAV_PATHS.includes(pathname);
  const section = workspace ? 'explore' : pathname.split('/')[1] || 'home';

  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
    else if (!workspace) window.scrollTo(0, 0);
  }, [pathname, hash, workspace]);

  return (
    <LocationProvider>
      <AssistantProvider>
        <ToastProvider>
          <div className="flex min-h-dvh flex-col">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-brand-900 focus:px-4 focus:py-3 focus:font-semibold focus:text-white">
              Lewati ke konten utama
            </a>
            <Header />
            <main id="main" tabIndex={-1} className={`flex-1 outline-none ${showBottomNav ? 'pb-16 md:pb-0' : ''}`}>
              <m.div key={section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <Outlet />
              </m.div>
            </main>
            {!workspace && <Footer />}
            {showBottomNav && <BottomNav />}
            <AssistantDock />
            <RouteAnnouncer />
          </div>
        </ToastProvider>
      </AssistantProvider>
    </LocationProvider>
  );
}
