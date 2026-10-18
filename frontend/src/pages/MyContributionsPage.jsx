import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ClipboardList, X } from 'lucide-react';
import { api } from '../lib/api';
import { CONTRIBUTION_STATUS, contributionKind } from '../features/accessibility/constants';
import { summarizePayload } from '../features/contribute/summary';
import { ContributionBadge } from '../components/status';
import { formatDateTime, lamaSejak } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/layout/PageShell';
import { Alert, EmptyState, LinkButton, Skeleton, Tabs, panelId } from '../components/ui';

/**
 * Jejak satu usulan: Dikirim -> Ditinjau -> Hasil.
 *
 * Sebelumnya tiap kartu hanya punya satu lencana status. "Menunggu verifikasi"
 * benar, tapi tidak menjawab pertanyaan yang sebenarnya ada di kepala kontributor:
 * ini masih jalan atau sudah tersangkut? Tiga titik ini memakai cerita yang sama
 * dengan yang dijanjikan di halaman Tentang, jadi apa yang dibaca sebelum mengirim
 * cocok dengan apa yang dilihat sesudahnya.
 */
function Jejak({ status, dikirim, ditinjau }) {
  const selesai = status !== 'pending';
  const langkah = [
    { nama: 'Dikirim', aktif: true, waktu: lamaSejak(dikirim) + ' lalu' },
    { nama: 'Ditinjau admin', aktif: selesai, waktu: selesai ? null : 'sedang berjalan' },
    {
      // Selama belum ada keputusan, langkah ini TIDAK boleh berbunyi "Disetujui".
      // Diredupkan saja tidak cukup: dibaca sekilas, dan oleh pembaca layar, itu
      // menjanjikan hasil yang belum terjadi.
      nama: !selesai ? 'Keputusan' : status === 'rejected' ? 'Ditolak' : 'Disetujui',
      aktif: selesai,
      gagal: status === 'rejected',
      waktu: selesai && ditinjau ? lamaSejak(ditinjau) + ' lalu' : null,
    },
  ];

  return (
    <ol className="flex items-start gap-1">
      {langkah.map((l, i) => (
        <li key={l.nama} className="flex-1">
          {/* Garis penghubung ada DI ATAS titik, bukan di antara dua elemen terpisah,
              supaya lebarnya ikut kolom dan tidak perlu dihitung. */}
          <div className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white ${
                !l.aktif ? 'bg-border-strong' : l.gagal ? 'bg-danger' : 'bg-success'
              }`}
            >
              {l.aktif && (l.gagal ? <X size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />)}
            </span>
            {i < langkah.length - 1 && (
              <span aria-hidden="true" className={`h-0.5 flex-1 rounded-full ${langkah[i + 1].aktif ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
          <p className={`mt-1.5 text-xs font-semibold leading-tight ${l.aktif ? '' : 'text-ink-muted'}`}>{l.nama}</p>
          {l.waktu && <p className="font-sub text-xs leading-tight text-ink-secondary">{l.waktu}</p>}
        </li>
      ))}
    </ol>
  );
}

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
                    <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{c.facility_name}</p>
                          <p className="font-sub text-sm text-ink-secondary">{contributionKind(c)} · #{c.id} · {formatDateTime(c.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ContributionBadge status={c.status} label={st.label} cls={st.cls} />
                          {/* Tanpa penanda ini kartunya tidak terlihat bisa dibuka sama sekali. */}
                          <ChevronDown aria-hidden="true" size={18} className="text-ink-secondary transition-transform group-open:rotate-180" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Jejak status={c.status} dikirim={c.created_at} ditinjau={c.reviewed_at} />
                      </div>
                      <span className="sr-only">Buka rincian usulan</span>
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
