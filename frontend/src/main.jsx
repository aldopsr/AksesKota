import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource-variable/bricolage-grotesque';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

// domMax, bukan domAnimation: transisi elemen-bersama (layoutId) antara kartu hasil dan
// panel detail butuh layout animation, yang tidak termasuk di domAnimation. Tambahannya
// belasan kB, dan itu satu-satunya gerak yang membuat aplikasi terasa sebagai satu ruang
// alih-alih berpindah halaman. MotionConfig reducedMotion="user" tetap menghormati
// pengaturan sistem pengguna.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LazyMotion features={domMax} strict>
          <MotionConfig reducedMotion="user">
            <AuthProvider>
              <App />
            </AuthProvider>
          </MotionConfig>
        </LazyMotion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
