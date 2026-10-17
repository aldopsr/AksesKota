import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ToastProvider } from '../../context/AppContexts';
import { LogoMark } from './Brand';
import { Badge, Button, buttonClass } from '../ui';

// Ruang kerja admin: navigasi terpisah dari header publik (IA 2.6)
export default function AdminLayout() {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-canvas">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-brand-900 focus:px-4 focus:py-3 focus:font-semibold focus:text-white">Lewati ke konten utama</a>
        <header className="sticky top-0 z-20 border-b border-border bg-surface">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <Link to="/admin" className="flex items-center gap-2.5" aria-label="Dasbor admin AksesKota">
              <LogoMark size={32} />
              <span className="text-lg font-extrabold">AksesKota</span>
              <Badge className="bg-brand-900 text-white">Admin</Badge>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm font-semibold text-ink-secondary sm:inline">{me?.name}</span>
              <Link to="/" className={buttonClass('ghost', 'md', 'hidden sm:inline-flex')}><ExternalLink aria-hidden="true" size={16} /> Lihat situs</Link>
              <Button variant="secondary" onClick={() => { signOut(); navigate('/'); }}><LogOut aria-hidden="true" size={16} /> Keluar</Button>
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="outline-none"><Outlet /></main>
      </div>
    </ToastProvider>
  );
}
