import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Clock, Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { ATTRIBUTE_LABEL, CATEGORY_LABEL, CONTRIBUTION_STATUS, REPORT_LABEL, STATUS, contributionKind } from '../features/accessibility/constants';
import { ContributionBadge, Stars } from '../components/status';
import { formatDateTime, lamaSejak } from '../lib/format';
import { useToast } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/layout/PageShell';
import { Alert, Badge, Button, Chip, EmptyState, LinkButton, Modal, SearchInput, Skeleton, Tabs, TextArea, panelId } from '../components/ui';

const TABS = ['contributions', 'reports', 'reviews'];

/* ---------------- antrean kontribusi ---------------- */
function ContributionsTab() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? 'pending';
  const [term, setTerm] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'contributions'], queryFn: () => api('/admin/contributions') });
  const cocok = (data ?? []).filter((c) => (status === 'all' || c.status === status) && (!term || `${c.facility_name} ${c.submitter_name}`.toLowerCase().includes(term.toLowerCase())));
  // Yang masih menunggu diurutkan dari yang PALING LAMA, bukan yang terbaru: antrean
  // verifikasi yang menampilkan kiriman terbaru di atas membuat usulan lama terdorong
  // ke bawah dan tidak pernah ditinjau. Yang sudah diputuskan tetap terbaru dulu.
  const rows = [...cocok].sort((a, b) => {
    if (a.status === 'pending' && b.status === 'pending') return new Date(a.created_at) - new Date(b.created_at);
    if (a.status === 'pending') return -1;
    if (b.status === 'pending') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const setStatus = (s) => { const n = new URLSearchParams(sp); n.set('status', s); setSp(n, { replace: true }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput label="Cari fasilitas atau pengirim" className="min-w-0 flex-1 sm:max-w-sm" value={term} onChange={setTerm} placeholder="Cari fasilitas atau pengirim" />
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          {[['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak'], ['all', 'Semua']].map(([k, l]) => <Chip key={k} pressed={status === k} onClick={() => setStatus(k)}>{l}</Chip>)}
        </div>
      </div>
      {isLoading && <div role="status" aria-label="Memuat antrean" className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {data && rows.length === 0 && <EmptyState icon={Inbox} title={status === 'pending' && !term ? 'Antrean kosong' : 'Tidak ada kontribusi yang cocok'}>{status === 'pending' && !term ? 'Semua kontribusi sudah ditinjau.' : 'Ubah filter atau kata kunci pencarian.'}</EmptyState>}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((c) => {
            const menunggu = c.status === 'pending';
            return (
              <li key={c.id}>
                {/* Dulu ini tabel selebar 44rem yang harus digeser menyamping di ponsel.
                    Antrean ini bukan tabel data untuk dibandingkan antar-baris — tiap
                    baris adalah satu hal untuk dibuka dan diputuskan — jadi daftar
                    tautan lebih tepat, dan muat di lebar berapa pun. */}
                <Link
                  to={`/admin/contributions/${c.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border bg-surface p-3 transition-colors hover:border-brand-400 hover:bg-surface-subtle sm:flex-nowrap"
                >
                  {/* basis-full di ponsel: lencana status tidak bisa mengecil, jadi di
                      lebar 375 px ia menyisakan sembilan karakter untuk nama fasilitas
                      dan barisnya tumbuh jadi kolom sempit setinggi lima baris. Ia
                      turun ke baris kedua, dan mulai sm kembali sebaris seperti semula. */}
                  <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <span className="block truncate font-semibold">{c.facility_name}</span>
                    {/* Lama menunggu ikut baris keterangan, bukan kolom tersendiri di
                        kanan: sebagai kolom ia harus disembunyikan di layar sempit,
                        padahal justru itu yang menentukan mana yang ditinjau duluan.
                        Hanya untuk yang masih menunggu — pada yang sudah diputuskan,
                        angka itu tidak menuntut apa pun. */}
                    <span className="font-sub block text-sm text-ink-secondary">
                      {menunggu && (
                        <span className="font-semibold text-warning">
                          <Clock aria-hidden="true" size={13} className="mr-1 inline align-[-2px]" />
                          menunggu {lamaSejak(c.created_at)}
                          {' · '}
                        </span>
                      )}
                      {contributionKind(c)} · {c.submitter_name} · {formatDateTime(c.created_at)}
                    </span>
                  </span>

                  <ContributionBadge status={c.status} label={CONTRIBUTION_STATUS[c.status].label} cls={CONTRIBUTION_STATUS[c.status].cls} />
                  <ChevronRight aria-hidden="true" size={18} className="ml-auto shrink-0 text-ink-secondary sm:ml-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- laporan ---------------- */
function ReportsTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api('/admin/reports') });
  const m = useMutation({
    mutationFn: ({ id, status }) => api(`/admin/reports/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'reports'] }); toast.show('Status laporan diperbarui.'); },
  });
  const label = { open: 'Terbuka', resolved: 'Selesai', dismissed: 'Ditolak' };
  const rows = (data ?? []).filter((r) => !onlyOpen || r.status === 'open');
  return (
    <div className="space-y-4">
      <Chip pressed={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>Hanya yang terbuka</Chip>
      {isLoading && <Skeleton className="h-24 w-full" />}
      {(error || m.error) && <Alert tone="danger">{(error || m.error).message}</Alert>}
      {data && rows.length === 0 && <EmptyState icon={Inbox} title="Tidak ada laporan" />}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-lg font-semibold">{r.facility_name}</p><p className="font-sub text-ink-secondary">{REPORT_LABEL[r.report_type]}, oleh {r.reported_by_name}</p></div>
              <Badge className={r.status === 'open' ? 'bg-warning-bg text-warning' : 'bg-neutral-bg text-neutral'}>{label[r.status]}</Badge>
            </div>
            <p className="mt-2">{r.description}</p>
            {r.review_content && <p className="font-sub mt-2 rounded-control bg-surface-subtle p-2 text-sm"><strong className="font-semibold">Ulasan yang dilaporkan:</strong> {r.review_content}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to={`/facilities/${r.facility_id}`} variant="secondary" size="sm">Lihat fasilitas</LinkButton>
              {r.status === 'open' && (
                <>
                  <Button size="sm" onClick={() => m.mutate({ id: r.id, status: 'resolved' })} loading={m.isPending && m.variables?.id === r.id}>Tandai selesai</Button>
                  <Button size="sm" variant="ghost" onClick={() => m.mutate({ id: r.id, status: 'dismissed' })}>Tolak laporan</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- ulasan ---------------- */
function ReviewsTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'reviews'], queryFn: () => api('/admin/reviews') });
  const del = useMutation({
    mutationFn: (id) => api(`/admin/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setTarget(null); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['facility'] }); qc.invalidateQueries({ queryKey: ['facilities'] }); toast.show('Ulasan dihapus.'); },
  });
  return (
    <div className="space-y-3">
      {isLoading && <Skeleton className="h-24 w-full" />}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {data?.length === 0 && <EmptyState icon={Inbox} title="Belum ada ulasan" />}
      <ul className="space-y-3">
        {data?.map((r) => (
          <li key={r.id} className="rounded-card border border-border bg-surface p-4">
            <p className="text-lg font-semibold">{r.facility_name}</p>
            <p className="font-sub flex flex-wrap items-center gap-2 text-sm text-ink-secondary">{r.user_name} <Stars value={r.rating} /> {r.rating} dari 5, {formatDateTime(r.created_at)}</p>
            {r.content && <p className="mt-2">{r.content}</p>}
            <div className="mt-3"><Button variant="secondary" size="sm" onClick={() => setTarget(r)}>Hapus ulasan</Button></div>
          </li>
        ))}
      </ul>
      <Modal open={!!target} onClose={() => setTarget(null)} title="Hapus ulasan ini?" footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Batal</Button><Button variant="danger" loading={del.isPending} onClick={() => del.mutate(target.id)}>Ya, hapus</Button></>}>
        <p className="font-sub">Ulasan dari {target?.user_name} akan dihapus permanen, termasuk laporan yang terkait dengannya.</p>
        {del.error && <Alert tone="danger" className="mt-3">{del.error.message}</Alert>}
      </Modal>
    </div>
  );
}

export function AdminQueuePage() {
  useDocumentTitle('Dasbor admin');
  const [sp, setSp] = useSearchParams();
  const tab = TABS.includes(sp.get('tab')) ? sp.get('tab') : 'contributions';
  const contribs = useQuery({ queryKey: ['admin', 'contributions'], queryFn: () => api('/admin/contributions') });
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api('/admin/reports') });
  const reviews = useQuery({ queryKey: ['admin', 'reviews'], queryFn: () => api('/admin/reviews') });
  const menunggu = (contribs.data ?? []).filter((c) => c.status === 'pending');
  const pending = contribs.data ? menunggu.length : undefined;
  const open = reports.data?.filter((r) => r.status === 'open').length;

  // Subjudul lama, "Tinjau kontribusi, tangani laporan, dan moderasi ulasan",
  // hanya mengulang nama-nama tabnya. Sebuah dasbor seharusnya menjawab "apa yang
  // menuntut saya sekarang", jadi tempat itu diisi keadaan nyata antreannya.
  const terlama = menunggu.reduce((a, c) => (!a || new Date(c.created_at) < new Date(a.created_at) ? c : a), null);
  const ringkas = !contribs.data
    ? 'Memuat antrean…'
    : pending === 0
      ? `Tidak ada kontribusi yang menunggu${open ? `, tetapi ada ${open} laporan terbuka` : '. Antrean bersih'}.`
      : `${pending} kontribusi menunggu verifikasi, yang terlama sudah ${lamaSejak(terlama.created_at)}${open ? `. ${open} laporan terbuka` : ''}.`;
  const tabs = [
    { key: 'contributions', label: 'Kontribusi', count: pending },
    { key: 'reports', label: 'Laporan', count: open },
    { key: 'reviews', label: 'Ulasan', count: reviews.data?.length },
  ];
  return (
    <PageShell title="Antrean verifikasi" subtitle={ringkas} width="max-w-6xl">
      <Tabs group="admin" label="Bagian dasbor" tabs={tabs} value={tab} onChange={(k) => setSp({ tab: k }, { replace: true })} />
      <div role="tabpanel" id={panelId('admin', tab)} aria-labelledby={`admin-tab-${tab}`} className="mt-5">
        {tab === 'contributions' && <ContributionsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'reviews' && <ReviewsTab />}
      </div>
    </PageShell>
  );
}

/* ---------------- detail verifikasi ---------------- */
const dash = <span className="text-ink-muted">-</span>;
const statusText = (s) => (s ? `${STATUS[s].label}` : null);
const coordText = (lat, lon) => (lat !== undefined && lon !== undefined && lat !== null ? `${lat}, ${lon}` : null);

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

export function AdminDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [localError, setLocalError] = useState('');
  const { data: c, isLoading, error } = useQuery({ queryKey: ['admin', 'contribution', id], queryFn: () => api(`/admin/contributions/${id}`) });
  useDocumentTitle(c ? `Verifikasi ${c.facility_name}` : 'Verifikasi kontribusi');

  const decide = useMutation({
    mutationFn: (status) => api(`/admin/contributions/${id}`, { method: 'PATCH', body: { status, review_note: notes.trim() || null } }),
    onSuccess: async (_r, status) => {
      await Promise.all(['admin', 'facilities', 'facility', 'my-contributions'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.show(status === 'approved' ? 'Kontribusi disetujui dan data diperbarui.' : 'Kontribusi ditolak.');
      navigate('/admin');
    },
  });
  function ask(status) {
    setLocalError('');
    if (status === 'rejected' && !notes.trim()) { setLocalError('Isi catatan alasan penolakan agar kontributor tahu apa yang perlu diperbaiki.'); return; }
    setConfirm(status);
  }

  const crumbs = [{ label: 'Antrean verifikasi', to: '/admin' }, { label: `Kontribusi #${id}` }];
  if (isLoading) return <PageShell title="Memuat kontribusi…" breadcrumb={crumbs} width="max-w-6xl"><Skeleton className="h-64 w-full" /></PageShell>;
  if (error) return <PageShell title="Kontribusi tidak dapat dimuat" breadcrumb={crumbs} width="max-w-6xl"><Alert tone="danger">{error.message}</Alert></PageShell>;

  const rows = buildRows(c);
  const st = CONTRIBUTION_STATUS[c.status];
  const photos = c.payload.photos ?? [];
  const loc = c.payload.facility?.lat !== undefined ? c.payload.facility : null;

  return (
    <PageShell title={c.facility_name} subtitle={contributionKind(c)} breadcrumb={crumbs} width="max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
        {/* min-w-0: item grid defaultnya min-width:auto, jadi tabel diff yang
            min-w-[30rem] melebarkan kolomnya sampai 482 px dan seluruh HALAMAN bisa
            digeser menyamping di ponsel — pembungkus overflow-x-auto-nya tidak pernah
            terpakai karena tidak pernah kehabisan ruang. */}
        <div className="min-w-0 space-y-6">
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="flex flex-wrap items-center gap-2"><ContributionBadge status={c.status} label={st.label} cls={st.cls} /></p>
            <dl className="font-sub mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="inline font-semibold text-ink">Pengirim: </dt><dd className="inline">{c.submitter_name} ({c.submitter_email})</dd></div>
              <div><dt className="inline font-semibold text-ink">Dikirim: </dt><dd className="inline">{formatDateTime(c.created_at)}</dd></div>
            </dl>
            {c.payload.note && <p className="mt-3 rounded-control bg-brand-50 p-3 text-sm"><strong>Catatan kontributor:</strong> <span className="font-sub">{c.payload.note}</span></p>}
          </div>

          <section aria-labelledby="diff-title" className="space-y-2">
            <h2 id="diff-title" className="text-xl font-semibold">Perubahan yang diusulkan</h2>
            {rows.length === 0 ? <p className="font-sub text-ink-secondary">Tidak ada perubahan data, hanya foto tambahan.</p> : (
              <>
              {/* Ponsel: ditumpuk, bukan tabel yang digulir ke samping.
                  Tiga kolom butuh 480 px, wadahnya di ponsel 342 px — jadi kolom
                  "Usulan", yang justru satu-satunya alasan halaman ini ada, selalu
                  jatuh di luar layar dan baru terlihat kalau admin kebetulan menggeser.
                  Keputusan menyetujui atau menolak tidak boleh bergantung pada gestur
                  yang tidak diberitahukan. Tabelnya tetap dipakai dari lebar sm ke atas,
                  karena di sana ia memang bentuk yang paling terbaca. */}
              <ul className="space-y-2 sm:hidden">
                {rows.map((r) => (
                  <li key={r.label} className={`rounded-card border border-border p-3 ${r.changed ? 'bg-warning-bg/50' : 'bg-surface'}`}>
                    <p className="font-semibold">{r.label}{r.changed && <span className="sr-only"> (berubah)</span>}</p>
                    <dl className="mt-1 space-y-0.5 text-sm">
                      <div className="flex gap-2">
                        <dt className="font-sub w-20 shrink-0 text-ink-secondary">Saat ini</dt>
                        <dd className="font-sub min-w-0 text-ink-secondary">{r.before ?? dash}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 font-semibold">Usulan</dt>
                        <dd className="min-w-0 font-semibold">{r.after ?? dash}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
              <div tabIndex={0} role="region" aria-label="Tabel perbandingan data, dapat digulir ke samping" className="max-sm:hidden overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full min-w-[30rem] text-left">
                  <caption className="sr-only">Perbandingan data saat ini dan usulan</caption>
                  <thead className="bg-surface-subtle"><tr><th scope="col" className="p-3">Bidang</th><th scope="col" className="p-3">Saat ini</th><th scope="col" className="p-3">Usulan</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.label} className={r.changed ? 'bg-warning-bg/50' : ''}>
                        <th scope="row" className="p-3 font-semibold">{r.label}{r.changed && <span className="sr-only"> (berubah)</span>}</th>
                        <td className="font-sub p-3 text-ink-secondary">{r.before ?? dash}</td>
                        <td className="p-3 font-semibold">{r.after ?? dash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </section>

          {loc && (
            <section aria-labelledby="loc-title" className="space-y-1">
              <h2 id="loc-title" className="text-xl font-semibold">Lokasi usulan</h2>
              <p className="font-sub text-ink-secondary">{loc.lat}, {loc.lon}</p>
              <a href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=18/${loc.lat}/${loc.lon}`} target="_blank" rel="noreferrer" className="font-semibold text-action-secondary underline underline-offset-4">Lihat titik di peta (tab baru)</a>
            </section>
          )}

          <section aria-labelledby="ph-title" className="space-y-2">
            <h2 id="ph-title" className="text-xl font-semibold">Foto bukti</h2>
            {photos.length === 0 ? <p className="font-sub text-ink-secondary">Tidak ada foto.</p> : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((url, i) => (
                  <li key={url} className="overflow-hidden rounded-card border border-border bg-surface">
                    <a href={url} target="_blank" rel="noreferrer" aria-label={`Buka foto bukti ${i + 1} di tab baru`}><img src={url} alt={`Foto bukti ${i + 1} untuk ${c.facility_name}`} loading="lazy" className="aspect-[4/3] w-full object-cover" /></a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20">
          {c.status === 'pending' ? (
            <section aria-labelledby="dec-title" className="space-y-3 rounded-panel border border-border bg-surface p-4">
              <h2 id="dec-title" className="text-xl font-semibold">Keputusan</h2>
              <TextArea label="Catatan untuk kontributor" rows={4} hint="Wajib diisi saat menolak. Opsional saat menyetujui." value={notes} onChange={(e) => setNotes(e.target.value)} />
              {localError && <Alert tone="danger">{localError}</Alert>}
              {decide.error && <Alert tone="danger">{decide.error.message}</Alert>}
              <div className="flex flex-wrap gap-2"><Button onClick={() => ask('approved')}>Setujui</Button><Button variant="danger" onClick={() => ask('rejected')}>Tolak</Button></div>
            </section>
          ) : (
            <Alert tone="info" title={`Sudah ${st.label.toLowerCase()}`}>
              {c.reviewer_name && <p>Oleh {c.reviewer_name}, {formatDateTime(c.reviewed_at)}.</p>}
              {c.review_note && <p>Catatan: {c.review_note}</p>}
            </Alert>
          )}
        </aside>
      </div>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'approved' ? 'Setujui kontribusi ini?' : 'Tolak kontribusi ini?'}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Batal</Button><Button variant={confirm === 'approved' ? 'primary' : 'danger'} loading={decide.isPending} onClick={() => decide.mutate(confirm, { onSettled: () => setConfirm(null) })}>{confirm === 'approved' ? 'Ya, setujui' : 'Ya, tolak'}</Button></>}
      >
        <p className="font-sub">{confirm === 'approved' ? 'Perubahan akan langsung diterapkan ke data fasilitas dan tampil di peta.' : 'Kontributor akan melihat status Ditolak beserta catatan Anda.'}</p>
      </Modal>
    </PageShell>
  );
}
