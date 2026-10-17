import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ATTRIBUTE_LABEL, CATEGORY_LABEL, CONTRIBUTION_STATUS, STATUS, contributionKind } from '../features/accessibility/constants';
import { formatDateTime } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/PageShell';
import { Alert, Badge, Button, LoadingBlock, Modal, TextArea, buttonClass } from '../components/ui';

const dash = <span className="text-slate-500">-</span>;
const statusText = (s) => (s ? `${STATUS[s].symbol} ${STATUS[s].label}` : null);
const coordText = (lat, lon) => (lat !== undefined && lon !== undefined && lat !== null ? `${lat}, ${lon}` : null);

// Bandingkan nilai resmi saat ini (previous) dengan usulan (payload) — bentuk dari backend
function buildRows(c) {
  const rows = [];
  const pf = c.previous?.facility ?? {};
  const nf = c.payload.facility;
  const add = (label, before, after) => rows.push({ label, before, after, changed: before !== after });
  if (nf) {
    if ('name' in nf) add('Nama', pf.name ?? null, nf.name);
    if ('category' in nf) add('Kategori', pf.category ? CATEGORY_LABEL[pf.category] : null, CATEGORY_LABEL[nf.category]);
    if ('address' in nf) add('Alamat', pf.address ?? null, nf.address);
    if ('description' in nf) add('Deskripsi', pf.description ?? null, nf.description || null);
    if ('lat' in nf) add('Koordinat (lat, lon)', coordText(pf.lat, pf.lon), coordText(nf.lat, nf.lon));
  }
  (c.payload.attributes ?? []).forEach((a) => {
    const prev = c.previous?.attributes?.find((x) => x.code === a.code);
    const before = [statusText(prev?.status), prev?.notes].filter(Boolean).join(' - ') || null;
    const after = [statusText(a.status), a.notes].filter(Boolean).join(' - ') || null;
    rows.push({ label: ATTRIBUTE_LABEL[a.code] ?? a.code, before, after, changed: before !== after });
  });
  return rows;
}

export default function AdminContributionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(null); // 'approved' | 'rejected'
  const [localError, setLocalError] = useState('');

  const { data: c, isLoading, error } = useQuery({
    queryKey: ['admin', 'contribution', id],
    queryFn: () => api(`/admin/contributions/${id}`),
  });
  useDocumentTitle(c ? `Verifikasi ${c.facility_name}` : 'Verifikasi kontribusi');

  const decide = useMutation({
    mutationFn: (status) => api(`/admin/contributions/${id}`, { method: 'PATCH', body: { status, review_note: notes.trim() || null } }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin'] }),
        qc.invalidateQueries({ queryKey: ['facilities'] }),
        qc.invalidateQueries({ queryKey: ['facility'] }),
        qc.invalidateQueries({ queryKey: ['my-contributions'] }),
      ]);
      navigate('/admin');
    },
  });

  function ask(status) {
    setLocalError('');
    if (status === 'rejected' && !notes.trim()) {
      setLocalError('Isi catatan alasan penolakan agar kontributor tahu apa yang perlu diperbaiki.');
      return;
    }
    setConfirm(status);
  }

  if (isLoading) return <LoadingBlock />;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">
        <Alert tone="error">{error.message}</Alert>
        <Link to="/admin" className="font-bold text-cobalt-700 underline underline-offset-4">Kembali ke dashboard</Link>
      </div>
    );
  }
  const rows = buildRows(c);
  const st = CONTRIBUTION_STATUS[c.status];
  const photos = c.payload.photos ?? [];

  return (
    <PageShell
      title={c.facility_name}
      subtitle="Tinjau perubahan yang diusulkan, lalu setujui atau tolak."
      actions={<Link to="/admin" className={buttonClass('light')}>Kembali ke dashboard</Link>}
      width="max-w-4xl"
    >
      <div className="space-y-6">
        <header className="space-y-2 rounded-2xl border border-cobalt-100 bg-white p-5">
          <p className="flex flex-wrap items-center gap-2">
            <Badge className="border-slate-400 bg-slate-100 text-slate-900">{contributionKind(c)}</Badge>
            <Badge className={st.cls}>{st.label}</Badge>
          </p>
          <dl className="grid gap-1 text-slate-800 sm:grid-cols-2">
            <div><dt className="inline font-bold">Pengirim: </dt><dd className="inline">{c.submitter_name} ({c.submitter_email})</dd></div>
            <div><dt className="inline font-bold">Dikirim: </dt><dd className="inline">{formatDateTime(c.created_at)}</dd></div>
          </dl>
        </header>

        <section aria-labelledby="diff-title" className="space-y-2">
          <h2 id="diff-title" className="font-display text-xl font-bold">Perubahan yang diusulkan</h2>
          {rows.length === 0 ? (
            <p className="text-slate-700">Tidak ada perubahan data, hanya foto tambahan.</p>
          ) : (
            <div tabIndex={0} role="region" aria-label="Tabel perbandingan data, dapat digulir ke samping" className="overflow-x-auto rounded-2xl border border-cobalt-100 bg-white">
              <table className="w-full min-w-[34rem] text-left">
                <caption className="sr-only">Perbandingan data sebelumnya dan usulan</caption>
                <thead className="bg-cobalt-50">
                  <tr><th scope="col" className="p-3">Bidang</th><th scope="col" className="p-3">Sebelumnya</th><th scope="col" className="p-3">Usulan</th></tr>
                </thead>
                <tbody className="divide-y divide-cobalt-100">
                  {rows.map((r) => (
                    <tr key={r.label} className={r.changed ? 'bg-sun-100/60' : ''}>
                      <th scope="row" className="p-3 font-bold">{r.label}{r.changed && <span className="sr-only"> (berubah)</span>}</th>
                      <td className="p-3">{r.before ?? dash}</td>
                      <td className="p-3 font-bold">{r.after ?? dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="ph-title" className="space-y-2">
          <h2 id="ph-title" className="font-display text-xl font-bold">Foto bukti</h2>
          {photos.length === 0 ? (
            <p className="text-slate-700">Tidak ada foto.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((url, i) => (
                <li key={url} className="overflow-hidden rounded-xl border border-cobalt-100 bg-white">
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Foto bukti ${i + 1} untuk ${c.facility_name}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {c.status === 'pending' ? (
          <section aria-labelledby="dec-title" className="space-y-3 rounded-2xl border border-cobalt-100 bg-white p-5">
            <h2 id="dec-title" className="font-display text-xl font-bold">Keputusan</h2>
            <TextArea
              label="Catatan untuk kontributor" rows={3}
              hint="Wajib diisi saat menolak. Opsional saat menyetujui."
              value={notes} onChange={(e) => setNotes(e.target.value)}
            />
            {localError && <Alert tone="error">{localError}</Alert>}
            {decide.error && <Alert tone="error">{decide.error.message}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => ask('approved')}>Setujui</Button>
              <Button variant="danger" onClick={() => ask('rejected')}>Tolak</Button>
            </div>
          </section>
        ) : (
          <Alert tone="info" title={`Sudah ${st.label.toLowerCase()}`}>
            {c.reviewer_name && <p>Oleh {c.reviewer_name}, {formatDateTime(c.reviewed_at)}.</p>}
            {c.review_note && <p>Catatan: {c.review_note}</p>}
          </Alert>
        )}
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'approved' ? 'Setujui kontribusi ini?' : 'Tolak kontribusi ini?'}>
        <p className="mb-4">
          {confirm === 'approved'
            ? 'Perubahan akan langsung diterapkan ke data fasilitas dan tampil di peta.'
            : 'Kontributor akan melihat status Ditolak beserta catatan Anda.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="light" onClick={() => setConfirm(null)}>Batal</Button>
          <Button
            variant={confirm === 'approved' ? 'primary' : 'danger'}
            loading={decide.isPending}
            onClick={() => decide.mutate(confirm, { onSettled: () => setConfirm(null) })}
          >
            {confirm === 'approved' ? 'Ya, setujui' : 'Ya, tolak'}
          </Button>
        </div>
      </Modal>
    </PageShell>
  );
}
