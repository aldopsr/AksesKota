import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LinkButton } from '../components/ui';

export default function NotFoundPage() {
  useDocumentTitle('Halaman tidak ditemukan');
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      {/* Satu-satunya halaman yang masih memakai ukuran lepas (text-8xl, text-3xl)
          setelah skala tipografi dipindah ke token. Dirapikan agar sebangun dengan
          halaman lain, bukan dirancang ulang: susunannya tetap sama. */}
      <p aria-hidden="true" className="text-[clamp(5rem,22vw,9rem)] font-extrabold leading-none text-brand-500">404</p>
      <h1 className="mt-3 text-title font-extrabold leading-[0.95] tracking-[-0.03em]">Halaman tidak ditemukan</h1>
      <p className="font-sub mt-3 text-lg text-ink-secondary">Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <LinkButton to="/" className="ak-pil rounded-full">Ke beranda</LinkButton>
        <LinkButton to="/map" variant="secondary" className="ak-pil rounded-full">Jelajahi fasilitas</LinkButton>
      </div>
    </div>
  );
}
