import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { CONTRIBUTION_STATUS, contributionKind } from '../features/accessibility/constants';
import { summarizePayload } from '../features/contribute/summary';
import { ContributionBadge } from '../components/status';
import { formatDateTime } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/layout/PageShell';
import { Alert, EmptyState, LinkButton, Skeleton, Tabs, panelId } from '../components/ui';

export default function MyContributionsPage() {
  useDocumentTitle('Kontribusi saya');
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? 'all';
  const justSubmitted = sp.get('submitted');
  const { data, isLoading, error } = useQuery({ queryKey: ['my-contributions'], queryFn: () => api('/me/contributions') });
  const count = (s) => (data ?? []).filter((c) => c.status === s).length;
  const rows = (data ?? []).filter((c) => status === 'all' || c.status === status);
  const tabs = [
    { key: 'all', label: 'Semua', count: data?.length ?? 0 },
    { key: 'pending', label: 'Menunggu', count: count('pending') },
    { key: 'approved', label: 'Disetujui', count: count('approved') },
    { key: 'rejected', label: 'Ditolak', count: count('rejected') },
  ];

  return (
    <PageShell
      title="Kontribusi saya" subtitle="Pantau status setiap usulan yang Anda kirim." breadcrumb={[{ label: 'Beranda', to: '/' }, { label: 'Kontribusi saya' }]}
      actions={<LinkButton to="/facilities/new">Tambah fasilitas</LinkButton>}
    >
      <div className="space-y-4">
        {justSubmitted && <Alert tone="success" title="Kontribusi terkirim">Usulan #{justSubmitted} berstatus Menunggu verifikasi. Perubahan tampil di peta setelah admin menyetujuinya.</Alert>}
        <Tabs group="contrib" label="Filter status kontribusi" tabs={tabs} value={status} onChange={(k) => setSp(k === 'all' ? {} : { status: k })} />

        <div role="tabpanel" id={panelId('contrib', status)} aria-labelledby={`contrib-tab-${status}`} className="space-y-3">
          {isLoading && <div role="status" aria-label="Memuat kontribusi" className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>}
          {error && <Alert tone="danger">{error.message}</Alert>}
          {data && rows.length === 0 && (
            <EmptyState icon={ClipboardList} title={status === 'all' ? 'Belum ada kontribusi' : 'Tidak ada kontribusi pada status ini'} actions={status === 'all' && <LinkButton to="/facilities/new">Tambah fasilitas pertama</LinkButton>}>
              Usulan Anda akan muncul di sini beserta status verifikasinya.
            </EmptyState>
          )}
          <ul className="space-y-2.5">
            {rows.map((c) => {
              const st = CONTRIBUTION_STATUS[c.status];
              const changes = summarizePayload(c.payload);
              return (
                <li key={c.id}>
                  <details className="group rounded-card border border-border bg-surface">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <p className="font-semibold">{c.facility_name}</p>
                        <p className="font-sub text-sm text-ink-secondary">{contributionKind(c)} · #{c.id} · {formatDateTime(c.created_at)}</p>
                      </div>
                      <ContributionBadge status={c.status} label={st.label} cls={st.cls} />
                    </summary>
                    <div className="space-y-3 border-t border-border p-4">
                      {changes.length > 0 && (
                        <dl className="space-y-1 text-sm">
                          {changes.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-36 shrink-0 font-semibold">{k}</dt><dd className="font-sub text-ink-secondary">{v}</dd></div>)}
                        </dl>
                      )}
                      {c.payload?.photos?.length > 0 && (
                        <ul className="flex flex-wrap gap-2">{c.payload.photos.map((u, i) => <li key={u}><a href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto bukti ${i + 1} untuk ${c.facility_name}`} className="size-20 rounded-control border border-border object-cover" /></a></li>)}</ul>
                      )}
                      {c.payload?.note && <p className="font-sub text-sm"><strong className="font-semibold">Catatan Anda:</strong> {c.payload.note}</p>}
                      {c.review_note && <Alert tone={c.status === 'rejected' ? 'danger' : 'info'} title="Catatan admin">{c.review_note}</Alert>}
                      {c.status === 'approved' && c.facility_id && <Link to={`/facilities/${c.facility_id}`} className="font-semibold text-action-secondary underline underline-offset-4">Lihat fasilitas</Link>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
