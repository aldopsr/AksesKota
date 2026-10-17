import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Alert, Button, TextField } from '../components/ui';

const schema = z.object({
  email: z.string().trim().min(1, 'Isi email Anda.').email('Format email tidak valid.'),
  password: z.string().min(1, 'Isi kata sandi Anda.'),
});

export default function LoginPage() {
  useDocumentTitle('Masuk');
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), defaultValues: { email: '', password: '' },
  });
  const from = location.state?.from ?? '/map';

  if (session) return <Navigate to={from} replace />;

  async function onSubmit({ email, password }) {
    setError('');
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AuthShell
      title="Masuk"
      subtitle="Masuk untuk menambah data, menulis ulasan, dan menyimpan kebutuhan aksesibilitas Anda."
      footer={<>Belum punya akun? <Link to="/register" className="font-bold text-cobalt-700 underline underline-offset-4">Daftar</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 rounded-2xl border border-cobalt-100 bg-white p-6">
        <TextField label="Email" type="email" autoComplete="email" requiredMark error={errors.email?.message} {...register('email')} />
        <TextField label="Kata sandi" type="password" autoComplete="current-password" requiredMark error={errors.password?.message} {...register('password')} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={isSubmitting} className="w-full">Masuk</Button>
      </form>
    </AuthShell>
  );
}
