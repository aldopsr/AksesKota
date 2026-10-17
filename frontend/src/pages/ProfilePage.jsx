import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { api } from '../lib/api';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_HINT, ATTRIBUTE_LABEL } from '../features/accessibility/constants';
import { useToast } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/layout/PageShell';
import { Alert, Button, LinkButton, Skeleton } from '../components/ui';

export default function ProfilePage() {
  useDocumentTitle('Profil aksesibilitas');
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ['my-profile'], queryFn: () => api('/me/accessibility-profile') });
  const saved = data?.attributes ?? [];
  const [selected, setSelected] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => { if (data) setSelected(data.attributes); }, [data]);

  const dirty = selected.length !== saved.length || selected.some((c) => !saved.includes(c));
  const save = useMutation({
    mutationFn: () => api('/me/accessibility-profile', { method: 'PUT', body: { attributes: selected } }),
    onSuccess: (res) => { qc.setQueryData(['my-profile'], res); setJustSaved(true); toast.show('Profil aksesibilitas tersimpan.'); },
  });
  const toggle = (c) => { setJustSaved(false); setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c])); };

  return (
    <PageShell title="Profil aksesibilitas" subtitle="Pilih fasilitas yang Anda butuhkan. Profil dipakai untuk menghitung kecocokan di peta, dan bisa Anda ubah kapan saja." breadcrumb={[{ label: 'Beranda', to: '/' }, { label: 'Profil aksesibilitas' }]}>
      <div className="space-y-5">
        <p className="font-sub flex gap-2 rounded-card bg-surface-subtle p-3 text-sm text-ink-secondary">
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          Profil ini hanya dipakai untuk personalisasi hasil pencarian di akun Anda. Tidak ada pilihan yang dipilih sebelumnya.
        </p>

        {isLoading && <div className="space-y-3" aria-label="Memuat profil" role="status"><Skeleton className="h-40 w-full" /><Skeleton className="h-28 w-full" /></div>}
        {error && <Alert tone="danger">{error.message}</Alert>}

        {data && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
            {ATTRIBUTE_GROUPS.map((g) => (
              <fieldset key={g.key}>
                <legend className="mb-1.5 text-lg font-semibold">{g.label}</legend>
                <div className="divide-y divide-border rounded-card border border-border bg-surface">
                  {g.codes.map((code) => (
                    <label key={code} className="flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3 hover:bg-surface-subtle">
                      <input type="checkbox" checked={selected.includes(code)} onChange={() => toggle(code)} className="mt-0.5 size-5 shrink-0 accent-brand-700" />
                      <span><span className="block font-semibold">{ATTRIBUTE_LABEL[code]}</span><span className="font-sub block text-sm text-ink-secondary">{ATTRIBUTE_HINT[code]}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="sticky bottom-0 -mx-4 border-t border-border bg-canvas px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <p role="status" className="font-sub mb-2 text-sm text-ink-secondary">{selected.length} kebutuhan dipilih{dirty ? ' · ada perubahan yang belum disimpan' : ''}</p>
              {save.error && <Alert tone="danger" className="mb-2">{save.error.message}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={save.isPending} disabled={!dirty}>Simpan perubahan</Button>
                <Button variant="secondary" disabled={!dirty} onClick={() => { setSelected(saved); setJustSaved(false); }}>Batalkan perubahan</Button>
                <Button variant="ghost" disabled={selected.length === 0} onClick={() => { setSelected([]); setJustSaved(false); }}>Kosongkan semua</Button>
              </div>
              {justSaved && !dirty && <div className="mt-3"><LinkButton to="/map" variant="secondary">Jelajahi dengan profil ini</LinkButton></div>}
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
