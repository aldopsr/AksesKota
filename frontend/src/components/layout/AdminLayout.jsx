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
            <Link to="/admin" className="flex min-h-11 min-w-0 items-center gap-2.5" aria-label="Dasbor admin AksesKota">
              <LogoMark size={32} />
              <span className="truncate text-lg font-extrabold">AksesKota</span>
              <Badge className="shrink-0 bg-brand-900 text-white">Admin</Badge>
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="hidden text-sm font-semibold text-ink-secondary sm:inline">{me?.name}</span>
              {/* Pembungkus, bukan kelas "hidden" di tombolnya: buttonClass sudah
                  memasang inline-flex, dan dua utilitas display yang bertabrakan
                  dimenangkan oleh urutan CSS — tombol ini sempat tetap tampil di
                  ponsel dan membuat seluruh halaman bisa digeser menyamping. */}
              {/* Di ponsel tinggal ikonnya. Sebelumnya tautan ini disembunyikan sama
                  sekali di bawah sm, dan karena bilah nav bawah publik tidak dipasang di
                  /admin, admin yang membuka dasbor dari ponsel tidak punya jalan kembali
                  ke situs selain keluar atau mengetik alamat sendiri. Yang dulu bikin
                  halaman bisa digeser menyamping adalah LEBAR tombolnya, bukan
                  keberadaannya — teksnya yang pergi, bukan tautannya. */}
              <Link to="/" className={buttonClass('ghost', 'md')} aria-label="Lihat situs">
                <ExternalLink aria-hidden="true" size={16} />
                <span className="max-sm:sr-only">Lihat situs</span>
              </Link>
              <Button variant="secondary" onClick={() => { signOut(); navigate('/'); }} aria-label="Keluar">
                <LogOut aria-hidden="true" size={16} /><span className="max-sm:sr-only">Keluar</span>
              </Button>
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="outline-none"><Outlet /></main>
      </div>
    </ToastProvider>
  );
}
