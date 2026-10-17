import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import AuthShell from '../components/layout/AuthShell';
import { Alert, Button, PasswordField, TextField } from '../components/ui';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Isi email Anda.').email('Format email tidak valid.'),
  password: z.string().min(1, 'Isi kata sandi Anda.'),
});

export function LoginPage() {
  useDocumentTitle('Masuk');
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const from = location.state?.from ?? '/map';
  const reason = location.state?.reason;
  if (session) return <Navigate to={from} replace />;

  async function onSubmit({ email, password }) {
    setError('');
    try { await signIn(email, password); navigate(from, { replace: true }); } catch (e) { setError(e.message); }
  }
  return (
    <AuthShell
      title="Masuk" subtitle="Masuk untuk menyimpan kebutuhan, mengirim data, dan menulis ulasan."
      notice={reason && <Alert tone="info">{reason} Setelah masuk, Anda akan kembali ke halaman ini.</Alert>}
      footer={<>Belum punya akun? <Link to="/register" state={location.state} className="font-semibold text-action-secondary underline underline-offset-4">Daftar</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField label="Email" type="email" autoComplete="email" requiredMark error={errors.email?.message} {...register('email')} />
        <PasswordField label="Kata sandi" autoComplete="current-password" requiredMark error={errors.password?.message} {...register('password')} />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Masuk</Button>
      </form>
    </AuthShell>
  );
}

const registerSchema = z.object({
  display_name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(60, 'Nama maksimal 60 karakter.'),
  email: z.string().trim().min(1, 'Isi email Anda.').email('Format email tidak valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi kata sandi tidak sama.' });

export function RegisterPage() {
  useDocumentTitle('Daftar');
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { display_name: '', email: '', password: '', confirm: '' } });
  const from = location.state?.from ?? '/map';
  const reason = location.state?.reason;
  if (session) return <Navigate to={from} replace />;

  async function onSubmit(v) {
    setError('');
    try { await signUp(v.email, v.password, v.display_name); navigate(from, { replace: true }); } catch (e) { setError(e.message); }
  }
  return (
    <AuthShell
      title="Daftar" subtitle="Akun gratis untuk berkontribusi dan menyimpan kebutuhan aksesibilitas."
      notice={reason && <Alert tone="info">{reason} Setelah mendaftar, Anda akan kembali ke halaman ini.</Alert>}
      footer={<>Sudah punya akun? <Link to="/login" state={location.state} className="font-semibold text-action-secondary underline underline-offset-4">Masuk</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField label="Nama tampilan" autoComplete="name" requiredMark error={errors.display_name?.message} {...register('display_name')} />
        <TextField label="Email" type="email" autoComplete="email" requiredMark error={errors.email?.message} {...register('email')} />
        <PasswordField label="Kata sandi" autoComplete="new-password" hint="Minimal 8 karakter." requiredMark error={errors.password?.message} {...register('password')} />
        <PasswordField label="Ulangi kata sandi" autoComplete="new-password" requiredMark error={errors.confirm?.message} {...register('confirm')} />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Buat akun</Button>
      </form>
    </AuthShell>
  );
}
