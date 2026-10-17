import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Alert, Button, Modal, SelectField, TextArea } from '../../components/ui';
import { REPORT_TYPES } from '../accessibility/constants';

function LoginNeeded({ onClose, action }) {
  return (
    <div className="space-y-4">
      <p>Anda perlu masuk untuk {action}.</p>
      <div className="flex gap-2">
        <Link to="/login" state={{ from: window.location.pathname }} className="inline-flex min-h-11 items-center rounded-xl bg-cobalt-700 px-4 font-bold text-white">Masuk</Link>
        <Button variant="light" onClick={onClose}>Batal</Button>
      </div>
    </div>
  );
}

const reviewSchema = z.object({
  rating: z.string().min(1, 'Pilih rating 1 sampai 5.'),
  content: z.string().trim().min(5, 'Tulis minimal 5 karakter.').max(500, 'Maksimal 500 karakter.'),
});

export function ReviewModal({ open, onClose, facilityId }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: '', content: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      await api(`/facilities/${facilityId}/reviews`, { method: 'POST', body: { rating: Number(values.rating), content: values.content } });
      await qc.invalidateQueries({ queryKey: ['facility'] });
      await qc.invalidateQueries({ queryKey: ['facilities'] });
      reset();
      onClose();
    } catch (e) {
      setServerError(e.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tulis ulasan">
      {!session ? <LoginNeeded onClose={onClose} action="menulis ulasan" /> : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <p className="text-sm text-slate-700">
            Rating menggambarkan pengalaman Anda dan tidak memengaruhi nilai kecocokan. Satu ulasan per fasilitas; mengirim ulang akan memperbarui ulasan Anda.
          </p>
          <fieldset>
            <legend className="mb-1 font-bold">Rating pengalaman</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex min-h-11 min-w-16 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-cobalt-200 px-3 font-bold has-[:checked]:border-cobalt-700 has-[:checked]:bg-cobalt-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt-700">
                  <input type="radio" value={String(n)} className="sr-only" {...register('rating')} />
                  {n} <span aria-hidden="true">★</span>
                </label>
              ))}
            </div>
            {errors.rating && <p role="alert" className="mt-1 text-sm font-bold text-red-700">{errors.rating.message}</p>}
          </fieldset>
          <TextArea label="Ulasan singkat" requiredMark error={errors.content?.message} {...register('content')} />
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="light" onClick={onClose}>Batal</Button>
            <Button type="submit" loading={isSubmitting}>Kirim ulasan</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const reportSchema = z.object({
  report_type: z.string().min(1, 'Pilih jenis masalah.'),
  description: z.string().trim().min(10, 'Jelaskan minimal 10 karakter.').max(1000, 'Maksimal 1000 karakter.'),
});

// reviewId diisi bila yang dilaporkan adalah sebuah ulasan
export function ReportModal({ open, onClose, facilityId, reviewId = null }) {
  const { session } = useAuth();
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(reportSchema),
    values: { report_type: reviewId ? 'review_bermasalah' : '', description: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      await api(`/facilities/${facilityId}/reports`, { method: 'POST', body: { ...values, review_id: reviewId ?? undefined } });
      setDone(true);
      reset();
    } catch (e) {
      setServerError(e.message);
    }
  }

  function close() {
    setDone(false);
    setServerError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={reviewId ? 'Laporkan ulasan' : 'Laporkan data'}>
      {!session ? <LoginNeeded onClose={close} action="mengirim laporan" /> : done ? (
        <div className="space-y-4">
          <Alert tone="success" title="Laporan terkirim">Admin akan memeriksa laporan Anda. Terima kasih sudah membantu menjaga data tetap akurat.</Alert>
          <div className="flex justify-end"><Button onClick={close}>Tutup</Button></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {reviewId ? (
            <input type="hidden" {...register('report_type')} />
          ) : (
            <SelectField label="Jenis masalah" requiredMark error={errors.report_type?.message} {...register('report_type')}>
              <option value="">Pilih jenis masalah</option>
              {REPORT_TYPES.filter((r) => r.code !== 'review_bermasalah').map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </SelectField>
          )}
          <TextArea label="Penjelasan" requiredMark hint="Apa yang tidak sesuai dan bagaimana kondisi sebenarnya?" error={errors.description?.message} {...register('description')} />
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="light" onClick={close}>Batal</Button>
            <Button type="submit" loading={isSubmitting}>Kirim laporan</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
