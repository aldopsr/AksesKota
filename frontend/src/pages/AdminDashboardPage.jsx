import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CONTRIBUTION_STATUS, REPORT_LABEL, contributionKind } from '../features/accessibility/constants';
import { formatDateTime } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/PageShell';
import { Alert, Badge, Button, EmptyState, LinkButton, LoadingBlock, Modal } from '../components/ui';
import { Stars } from '../features/facilities/parts';

const TABS = [
  { key: 'contributions', label: 'Kontribusi' },
  { key: 'reports', label: 'Laporan' },
  { key: 'reviews', label: 'Ulasan' },
];

function ContributionsTab() {
  const [status, setStatus] = useState('pending');
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'contributions'], queryFn: () => api('/admin/contributions') });
  const rows = (data ?? []).filter((c) => !status || c.status === status);

  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <label htmlFor="f-status" className="mb-1 block font-bold">Filter status</label>
        <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)} className="block min-h-11 w-full rounded-xl border-2 border-cobalt-200 bg-white px-3">
          <option value="pending">Menunggu verifikasi</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="">Semua</option>
        </select>
      </div>
      {isLoading && <LoadingBlock />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && rows.length === 0 && <EmptyState title="Tidak ada kontribusi pada status ini" />}
      {rows.length > 0 && (
        <div tabIndex={0} role="region" aria-label="Tabel kontribusi, dapat digulir ke samping" className="overflow-x-auto rounded-2xl border border-cobalt-100 bg-white">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">Daftar kontribusi</caption>
            <thead className="bg-cobalt-50">
              <tr>
                <th scope="col" className="p-3">Fasilitas</th>
                <th scope="col" className="p-3">Jenis</th>
                <th scope="col" className="p-3">Pengirim</th>
                <th scope="col" className="p-3">Dikirim</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cobalt-100">
              {rows.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="p-3 font-bold">{c.facility_name}</th>
                  <td className="p-3">{contributionKind(c)}</td>
                  <td className="p-3">{c.submitter_name}</td>
                  <td className="p-3">{formatDateTime(c.created_at)}</td>
                  <td className="p-3"><Badge className={CONTRIBUTION_STATUS[c.status].cls}>{CONTRIBUTION_STATUS[c.status].label}</Badge></td>
                  <td className="p-3">
                    <Link to={`/admin/contributions/${c.id}`} className="font-bold text-cobalt-700 underline underline-offset-4">
                      Tinjau<span className="sr-only"> {c.facility_name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsTab() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api('/admin/reports') });
  const m = useMutation({
    mutationFn: ({ id, status }) => api(`/admin/reports/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
  const label = { open: 'Terbuka', resolved: 'Selesai', dismissed: 'Ditolak' };

  return (
    <div className="space-y-3">
      {isLoading && <LoadingBlock />}
      {(error || m.error) && <Alert tone="error">{(error || m.error).message}</Alert>}
      {data?.length === 0 && <EmptyState title="Belum ada laporan" />}
      <ul className="space-y-3">
        {data?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-cobalt-100 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold">{r.facility_name}</p>
                <p className="text-slate-700">{REPORT_LABEL[r.report_type]}, oleh {r.reported_by_name}</p>
              </div>
              <Badge className={r.status === 'open' ? 'border-amber-600 bg-sun-100 text-amber-950' : 'border-slate-400 bg-slate-100 text-slate-800'}>{label[r.status]}</Badge>
            </div>
            <p className="mt-2">{r.description}</p>
            {r.review_content && <p className="mt-2 rounded-xl bg-cobalt-50 p-2 text-sm"><strong>Ulasan yang dilaporkan:</strong> {r.review_content}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to={`/map/${r.facility_id}`} variant="light">Lihat fasilitas</LinkButton>
              {r.status === 'open' && (
                <>
                  <Button onClick={() => m.mutate({ id: r.id, status: 'resolved' })} loading={m.isPending && m.variables?.id === r.id}>Tandai selesai</Button>
                  <Button variant="ghost" onClick={() => m.mutate({ id: r.id, status: 'dismissed' })}>Tolak laporan</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewsTab() {
  const qc = useQueryClient();
  const [target, setTarget] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'reviews'], queryFn: () => api('/admin/reviews') });
  const del = useMutation({
    mutationFn: (id) => api(`/admin/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setTarget(null);
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['facility'] });
      qc.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
  return (
    <div className="space-y-3">
      {isLoading && <LoadingBlock />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data?.length === 0 && <EmptyState title="Belum ada ulasan" />}
      <ul className="space-y-3">
        {data?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-cobalt-100 bg-white p-4">
            <p className="font-display text-lg font-bold">{r.facility_name}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {r.user_name} <Stars value={r.rating} /> {r.rating} dari 5, {formatDateTime(r.created_at)}
            </p>
            {r.content && <p className="mt-2">{r.content}</p>}
            <div className="mt-3"><Button variant="light" onClick={() => setTarget(r)}>Hapus ulasan</Button></div>
          </li>
        ))}
      </ul>
      <Modal open={!!target} onClose={() => setTarget(null)} title="Hapus ulasan ini?">
        <p className="mb-4">Ulasan dari {target?.user_name} akan dihapus permanen, termasuk laporan yang terkait dengannya.</p>
        {del.error && <Alert tone="error" className="mb-3">{del.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="light" onClick={() => setTarget(null)}>Batal</Button>
          <Button variant="danger" loading={del.isPending} onClick={() => del.mutate(target.id)}>Ya, hapus</Button>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminDashboardPage() {
  useDocumentTitle('Dashboard admin');
  const [tab, setTab] = useState('contributions');
  const contribs = useQuery({ queryKey: ['admin', 'contributions'], queryFn: () => api('/admin/contributions') });
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api('/admin/reports') });
  const pending = contribs.data?.filter((c) => c.status === 'pending').length ?? 0;
  const openReports = reports.data?.filter((r) => r.status === 'open').length ?? 0;

  return (
    <PageShell title="Dashboard admin" subtitle="Verifikasi kontribusi, tinjau laporan, dan moderasi ulasan." width="max-w-5xl">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-cobalt-100 bg-white p-4">
          <dt className="text-slate-700">Kontribusi menunggu verifikasi</dt>
          <dd className="font-display text-3xl font-bold">{pending}</dd>
        </div>
        <div className="rounded-2xl border border-cobalt-100 bg-white p-4">
          <dt className="text-slate-700">Laporan terbuka</dt>
          <dd className="font-display text-3xl font-bold">{openReports}</dd>
        </div>
      </dl>

      <div role="tablist" aria-label="Bagian dashboard" className="mt-8 flex gap-1 border-b border-cobalt-200">
        {TABS.map((t) => (
          <button
            key={t.key} type="button" role="tab" id={`tab-${t.key}`}
            aria-selected={tab === t.key} aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`min-h-11 rounded-t-xl px-5 font-bold ${tab === t.key ? 'bg-cobalt-700 text-white' : 'text-slate-700 hover:bg-cobalt-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === 'contributions' && <ContributionsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'reviews' && <ReviewsTab />}
      </div>
    </PageShell>
  );
}
