import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LinkButton } from '../components/ui';

export default function NotFoundPage() {
  useDocumentTitle('Halaman tidak ditemukan');
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p aria-hidden="true" className="text-8xl font-extrabold text-brand-200">404</p>
      <h1 className="mt-2 text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p className="font-sub mt-2 text-lg text-ink-secondary">Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><LinkButton to="/">Ke beranda</LinkButton><LinkButton to="/map" variant="secondary">Jelajahi fasilitas</LinkButton></div>
    </div>
  );
}
