import PageShell from '../components/PageShell';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ATTRIBUTES } from '../features/accessibility/constants';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Alert, Button, LinkButton, LoadingBlock } from '../components/ui';

export default function AccessibilityProfilePage() {
  useDocumentTitle('Kebutuhan aksesibilitas saya');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['my-profile'], queryFn: () => api('/me/accessibility-profile') });
  const [selected, setSelected] = useState([]);
  useEffect(() => { if (data) setSelected(data.attributes); }, [data]);

  const save = useMutation({
    mutationFn: () => api('/me/accessibility-profile', { method: 'PUT', body: { attributes: selected } }),
    onSuccess: (res) => qc.setQueryData(['my-profile'], res),
  });
  const toggle = (c) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <PageShell title="Kebutuhan aksesibilitas saya" subtitle="Pilih fasilitas yang Anda butuhkan. Profil ini dipakai menghitung Accessibility Match di peta, dan tetap bisa Anda ubah sebelum mencari." width="max-w-2xl">

      {isLoading && <LoadingBlock />}
      {error && <Alert tone="error" className="mt-4">{error.message}</Alert>}

      {data && (
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="mt-6 space-y-4"
        >
          <fieldset className="rounded-2xl border-2 border-cobalt-200 bg-white p-4">
            <legend className="px-1 text-lg font-bold">Saya membutuhkan</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {ATTRIBUTES.map((a) => (
                <label key={a.code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-slate-100">
                  <input type="checkbox" className="size-5 accent-cobalt-700" checked={selected.includes(a.code)} onChange={() => toggle(a.code)} />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>

          {save.isSuccess && <Alert tone="success">Profil tersimpan.</Alert>}
          {save.error && <Alert tone="error">{save.error.message}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={save.isPending}>Simpan profil</Button>
            <LinkButton to="/map" variant="light">Buka peta</LinkButton>
          </div>
        </form>
      )}
    </PageShell>
  );
}
