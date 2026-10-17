import PageShell from '../components/PageShell';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import FacilityForm from '../features/contribute/FacilityForm';

export default function AddFacilityPage() {
  useDocumentTitle('Tambah fasilitas');
  const navigate = useNavigate();
  const m = useMutation({
    mutationFn: (fd) => api('/contributions', { method: 'POST', formData: fd }),
    onSuccess: () => navigate('/me/contributions', { state: { submitted: true } }),
  });
  return (
    <PageShell title="Tambah fasilitas" subtitle="Bantu orang lain mengetahui aksesibilitas suatu tempat sebelum mereka berkunjung." width="max-w-3xl">
      <FacilityForm mode="create" onSubmit={m.mutate} submitting={m.isPending} serverError={m.error?.message} />
    </PageShell>
  );
}
