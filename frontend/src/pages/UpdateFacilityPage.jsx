import PageShell from '../components/PageShell';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { normalizeFacility } from '../features/accessibility/match';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import FacilityForm from '../features/contribute/FacilityForm';
import { Alert, LinkButton, LoadingBlock } from '../components/ui';

export default function UpdateFacilityPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: facility, isLoading, error } = useQuery({
    queryKey: ['facility', id, 'edit'],
    queryFn: async () => normalizeFacility(await api(`/facilities/${id}`, { params: { needs: 'none' } })),
    gcTime: 0,
  });
  useDocumentTitle(facility ? `Perbarui ${facility.name}` : 'Perbarui fasilitas');
  const m = useMutation({
    mutationFn: (fd) => api('/contributions', { method: 'POST', formData: fd }),
    onSuccess: () => navigate('/me/contributions', { state: { submitted: true } }),
  });

  return (
    <PageShell title="Perbarui data fasilitas" subtitle={facility ? facility.name : 'Memuat data fasilitas…'} width="max-w-3xl">
      {isLoading && <LoadingBlock />}
      {error && (
        <div className="space-y-3">
          <Alert tone="error">{error.status === 404 ? 'Fasilitas tidak ditemukan.' : error.message}</Alert>
          <LinkButton to="/map" variant="light">Kembali ke peta</LinkButton>
        </div>
      )}
      {facility && (
        <FacilityForm
          key={facility.id} mode="update" facility={facility}
          onSubmit={m.mutate} submitting={m.isPending} serverError={m.error?.message}
        />
      )}
    </PageShell>
  );
}
