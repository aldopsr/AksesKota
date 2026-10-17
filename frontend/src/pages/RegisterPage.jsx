import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Alert, Button, TextField } from '../components/ui';
import AuthShell from '../components/AuthShell';

const schema = z.object({
  display_name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(60, 'Nama maksimal 60 karakter.'),
  email: z.string().trim().min(1, 'Isi email Anda.').email('Format email tidak valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi kata sandi tidak sama.' });

export default function RegisterPage() {
  useDocumentTitle('Daftar');
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), defaultValues: { display_name: '', email: '', password: '', confirm: '' },
  });

  if (session) return <Navigate to="/map" replace />;

  async function onSubmit(v) {
    setError('');
    try {
      await signUp(v.email, v.password, v.display_name);
      navigate('/map', { replace: true });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AuthShell
      title="Daftar"
      subtitle="Akun gratis untuk berkontribusi dan menyimpan kebutuhan aksesibilitas."
      footer={<>Sudah punya akun? <Link to="/login" className="font-bold text-cobalt-700 underline underline-offset-4">Masuk</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 rounded-2xl border border-cobalt-100 bg-white p-6">
        <TextField label="Nama tampilan" autoComplete="name" requiredMark error={errors.display_name?.message} {...register('display_name')} />
        <TextField label="Email" type="email" autoComplete="email" requiredMark error={errors.email?.message} {...register('email')} />
        <TextField label="Kata sandi" type="password" autoComplete="new-password" hint="Minimal 8 karakter." requiredMark error={errors.password?.message} {...register('password')} />
        <TextField label="Ulangi kata sandi" type="password" autoComplete="new-password" requiredMark error={errors.confirm?.message} {...register('confirm')} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={isSubmitting} className="w-full">Buat akun</Button>
      </form>
    </AuthShell>
  );
}
