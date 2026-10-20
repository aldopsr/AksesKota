import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { LoadingBlock } from './components/ui';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import ProfilePage from './pages/ProfilePage';
import MyContributionsPage from './pages/MyContributionsPage';
import { AdminDetailPage, AdminQueuePage } from './pages/AdminPages';
import NotFoundPage from './pages/NotFoundPage';

// Halaman yang memuat Mapbox dipisah agar halaman awal ringan
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const ContributionFormPage = lazy(() => import('./pages/ContributionFormPage'));

// Alamat lama tetap berfungsi (mengarah ke struktur URL baru)
function Redirect({ to }) {
  const { id } = useParams();
  return <Navigate to={to.replace(':id', id ?? '')} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock label="Memuat halaman…" />}>
      <Routes>
        <Route element={<PublicLayout />}>
          {/* PRD §13: "Peta adalah antarmuka utama AksesKota". Halaman depan dulu berisi
              penjelasan setinggi 4,3 layar HP sebelum ada yang bisa disentuh — itu melawan
              dokumennya sendiri. Sekarang "/" membuka langsung dengan peta setinggi satu
              layar, dan penjelasannya menyusul di bawahnya dalam satu halaman yang digulir.
              Satu komponen untuk /, /map, dan /facilities/:id supaya peta tidak dimuat ulang
              saat berpindah di antara ketiganya. */}
          <Route element={<ExplorePage />}>
            <Route index element={null} />
            <Route path="map" element={null} />
            <Route path="facilities/:id" element={null} />
          </Route>
          {/* Penjelasan tidak lagi punya halaman sendiri — ia bagian bawah dari "/".
              Alamat lama tetap dilayani supaya tautan yang terlanjur dibagikan tidak mati. */}
          <Route path="tentang" element={<Navigate to="/#cara-kerja" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="accessibility-profile" element={<ProfilePage />} />
            <Route path="facilities/new" element={<ContributionFormPage mode="create" />} />
            <Route path="facilities/:id/update" element={<ContributionFormPage mode="update" />} />
            <Route path="my-contributions" element={<MyContributionsPage />} />
          </Route>

          <Route path="map/:id" element={<Redirect to="/facilities/:id" />} />
          <Route path="contribute/new" element={<Navigate to="/facilities/new" replace />} />
          <Route path="contribute/:id/update" element={<Redirect to="/facilities/:id/update" />} />
          <Route path="profile/accessibility" element={<Navigate to="/accessibility-profile" replace />} />
          <Route path="me/contributions" element={<Navigate to="/my-contributions" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<ProtectedRoute adminOnly />}>
          <Route element={<AdminLayout />}>
            <Route path="admin" element={<AdminQueuePage />} />
            <Route path="admin/contributions/:id" element={<AdminDetailPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
