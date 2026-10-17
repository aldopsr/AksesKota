import { Navigate, Outlet, matchPath, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock } from './ui';

// Alasan login ditampilkan di halaman masuk agar pengguna tahu mengapa (IA 5.7)
const REASONS = [
  ['/facilities/new', 'Masuk untuk mengirim data fasilitas baru.'],
  ['/facilities/:id/update', 'Masuk untuk mengusulkan pembaruan data fasilitas.'],
  ['/accessibility-profile', 'Masuk untuk menyimpan kebutuhan aksesibilitas Anda.'],
  ['/my-contributions', 'Masuk untuk melihat status kontribusi Anda.'],
];

// Pengaman UX saja. Keamanan sebenarnya ada di Express (JWT + role).
export default function ProtectedRoute({ adminOnly = false }) {
  const { session, me, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock label="Memeriksa akun…" />;
  if (!session) {
    const reason = REASONS.find(([p]) => matchPath(p, location.pathname))?.[1];
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search, reason }} />;
  }
  if (adminOnly && me?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
