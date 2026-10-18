import { useEffect, useMemo, useState } from 'react';
import { m } from 'motion/react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Flag, MapPin, MessageSquarePlus, Navigation, Pencil, SlidersHorizontal, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABEL, CATEGORY_LABEL, DISCLAIMER } from '../accessibility/constants';
import { categoryIcon } from '../accessibility/icons';
import { breakdown, levelFor, normalizeFacility } from '../accessibility/match';
import { AttributeRow, FreshnessNote, MatchBadge, Stars } from '../../components/status';
import { Alert, Button, LinkButton, Skeleton } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate } from '../../lib/format';
import { formatDistance } from '../../lib/geo';
import { ReportModal, ReviewModal } from './FeedbackModals';

const names = (codes) => codes.map((c) => ATTRIBUTE_LABEL[c]).join(', ');

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export default function FacilityDetailPanel({
  id, required, usingProfile, distance, onBack, onStartRoute, onShowMap, onEditNeeds, onLoaded, routeSlot, awal = null, backLabel = 'Kembali ke hasil',
}) {
  const needsParam = required.length ? required.join(',') : 'none';
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['facility', id, needsParam], queryFn: () => api(`/facilities/${id}`, { params: { needs: needsParam } }) });
  const f = useMemo(() => (data ? normalizeFacility(data) : null), [data]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReview, setReportReview] = useState(null);
  useDocumentTitle(f?.name ?? 'Detail fasilitas');
  useEffect(() => { if (f) onLoaded?.(f); }, [f?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo(() => (f ? breakdown(f.attributes, required) : null), [f, required]);

  // Judul, kategori, dan kecocokan sudah kita punya dari kartu yang barusan diketuk —
  // tidak ada alasan menunggu jaringan untuk menampilkannya. Dulu seluruh panel kosong
  // selama ±1 detik, dan transisi kartu->detail mustahil terjadi karena pasangan
  // elemennya belum lahir saat kartunya menghilang.
  if (isLoading) {
    return (
      <div className="p-4" role="status" aria-label="Memuat detail fasilitas">
        {awal ? (
          <>
            <m.h2 layoutId={`nama-${awal.id}`} className="text-2xl font-bold leading-tight">{awal.name}</m.h2>
            <p className="font-semibold text-brand-800">{CATEGORY_LABEL[awal.category] ?? awal.category_name}</p>
            {awal.label && (
              <m.div layoutId={`match-${awal.id}`} className="mt-2 inline-block">
                <MatchBadge level={levelFor(awal)} percent={awal.match_pct} />
              </m.div>
            )}
          </>
        ) : (
          <><Skeleton className="h-8 w-1/3" /><Skeleton className="h-7 w-3/4" /></>
        )}
        <div className="mt-4 space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-40 w-full" /></div>
      </div>
    );
  }
  if (error || !f) {
    return (
      <div className="space-y-3 p-4">
        <Alert tone="danger" title="Detail fasilitas tidak dapat dimuat">{error?.status === 404 ? 'Fasilitas tidak ditemukan atau sudah dihapus.' : error?.message}</Alert>
        <div className="flex gap-2"><Button onClick={onBack} variant="secondary">{backLabel}</Button>{error?.status !== 404 && <Button onClick={() => refetch()}>Coba lagi</Button>}</div>
      </div>
    );
  }

  const Icon = categoryIcon(f.category);
  const level = levelFor(f);
  const byCode = Object.fromEntries(f.attributes.map((a) => [a.code, a]));

  return (
    <article aria-labelledby="facility-name" className="ak-menajam">
      <header className="border-b border-border bg-surface px-4 pb-4 pt-2">
        <Button variant="link" onClick={onBack} className="min-h-11"><ArrowLeft aria-hidden="true" size={16} /> {backLabel}</Button>
        <div className="mt-1 flex items-start gap-3">
          <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-800"><Icon size={22} /></span>
          <div className="min-w-0">
            <m.h2 layoutId={`nama-${f.id}`} id="facility-name" className="text-2xl font-bold leading-tight">{f.name}</m.h2>
            <p className="font-semibold text-brand-800">{CATEGORY_LABEL[f.category] ?? f.category_name}</p>
            <p className="font-sub mt-1 flex items-start gap-1 text-ink-secondary"><MapPin aria-hidden="true" className="mt-1 shrink-0" size={15} /><span>{f.address}{distance != null && ` (${formatDistance(distance)} dari lokasi Anda)`}</span></p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onStartRoute}><Navigation aria-hidden="true" size={16} /> Lihat rute</Button>
          <Button variant="secondary" className="lg:hidden" onClick={onShowMap}><MapPin aria-hidden="true" size={16} /> Lihat di peta</Button>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {f.description && <p className="font-sub text-ink-secondary">{f.description}</p>}
        {routeSlot}

        <Section id="match-title" title="Kecocokan dengan kebutuhan Anda">
          {required.length === 0 ? (
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="font-sub text-ink-secondary">Pilih kebutuhan aksesibilitas untuk melihat seberapa cocok tempat ini. Atribut tetap ditampilkan di bawah.</p>
              <Button variant="secondary" className="mt-3" onClick={onEditNeeds}><SlidersHorizontal aria-hidden="true" size={16} /> Pilih kebutuhan</Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-4xl font-extrabold tabular-nums">{f.match_pct}<span className="text-2xl">%</span></p>
                <m.div layoutId={`match-${f.id}`}><MatchBadge level={level} percent={f.match_pct} /></m.div>
              </div>
              <p><strong>{f.needs_met} dari {f.needs_total}</strong> kebutuhan terpenuhi{usingProfile && <span className="font-sub text-ink-secondary"> (berdasarkan profil Anda)</span>}.</p>
              <dl className="space-y-1.5 text-sm">
                {[['Tersedia', parts.met, 'text-success'], ['Tidak tersedia', parts.notAvailable, 'text-danger'], ['Belum diketahui', parts.unknown, 'text-neutral']].map(([label, list, cls]) => list.length > 0 && (
                  <div key={label} className="flex gap-2"><dt className={`w-32 shrink-0 font-semibold ${cls}`}>{label} ({list.length})</dt><dd className="font-sub">{names(list)}</dd></div>
                ))}
              </dl>
              {parts.unknown.length > 0 && <p className="font-sub text-sm text-ink-secondary">Kebutuhan yang belum diketahui tidak dihitung terpenuhi.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={onEditNeeds}><SlidersHorizontal aria-hidden="true" size={14} /> Ubah kebutuhan</Button>
              </div>
              <p className="font-sub flex gap-1.5 text-xs text-ink-secondary"><Info aria-hidden="true" className="mt-0.5 shrink-0" size={13} /> Kecocokan dihitung dari data yang tersedia dan bukan sertifikasi aksesibilitas.</p>
            </div>
          )}
        </Section>

        <Section id="attr-title" title="Atribut aksesibilitas">
          <div className="space-y-4">
            {ATTRIBUTE_GROUPS.map((g) => (
              <div key={g.key}>
                <h4 className="font-sub text-sm font-bold uppercase tracking-wide text-ink-secondary">{g.label}</h4>
                <ul className="divide-y divide-border rounded-card border border-border bg-surface px-3">
                  {g.codes.map((code) => <AttributeRow key={code} code={code} status={byCode[code]?.status ?? 'unknown'} note={byCode[code]?.notes} required={required.includes(code)} />)}
                </ul>
              </div>
            ))}
          </div>
          <FreshnessNote iso={f.last_verified_at} freshness={f.freshness} />
        </Section>

        <Section id="photo-title" title="Foto">
          {f.photos?.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {f.photos.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-card border border-border bg-surface">
                  <img src={p.url} alt={`Foto ${i + 1} dari ${f.photos.length} untuk ${f.name}${p.caption ? `: ${p.caption}` : ''}`} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sub rounded-card border border-dashed border-border-strong bg-surface p-4 text-ink-secondary">Belum ada foto. Anda bisa membantu dengan mengusulkan pembaruan beserta foto.</p>
          )}
        </Section>

        <Section id="review-title" title="Ulasan pengguna">
          <p className="font-sub text-sm text-ink-secondary">Ulasan adalah pengalaman pengguna, terpisah dari data atribut dan nilai kecocokan.</p>
          {f.rating_count > 0 ? <p className="flex items-center gap-2"><Stars value={f.rating_avg} /><strong>{f.rating_avg} dari 5</strong> dari {f.rating_count} ulasan</p> : <p className="font-sub text-ink-secondary">Belum ada ulasan.</p>}
          <ul className="space-y-2">
            {f.reviews?.map((r) => (
              <li key={r.id} className="rounded-card border border-border bg-surface p-3">
                <p className="flex flex-wrap items-center gap-2"><strong>{r.user_name}</strong> <Stars value={r.rating} /> <span className="text-sm">{r.rating} dari 5</span></p>
                <p className="font-sub text-sm text-ink-secondary">{formatDate(r.created_at)}</p>
                {r.content && <p className="mt-1">{r.content}</p>}
                <Button variant="link" size="sm" className="mt-1 min-h-11 text-ink-secondary" onClick={() => { setReportReview(r.id); setReportOpen(true); }}>Laporkan ulasan<span className="sr-only"> dari {r.user_name}</span></Button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setReviewOpen(true)}><MessageSquarePlus aria-hidden="true" size={16} /> Tulis ulasan</Button>
        </Section>

        <Section id="help-title" title="Bantu menjaga data tetap akurat">
          <p className="font-sub text-ink-secondary">Kondisi berubah? Usulkan pembaruan atau laporkan informasi yang tidak sesuai. Admin memeriksanya sebelum data berubah.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/facilities/${f.id}/update`} variant="secondary"><Pencil aria-hidden="true" size={16} /> Usulkan pembaruan</LinkButton>
            <Button variant="ghost" onClick={() => { setReportReview(null); setReportOpen(true); }}><Flag aria-hidden="true" size={16} /> Laporkan informasi</Button>
          </div>
        </Section>

        <p role="note" className="font-sub rounded-card bg-surface-subtle p-3 text-sm text-ink-secondary">{DISCLAIMER}</p>
        <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} facilityId={f.id} />
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} facilityId={f.id} reviewId={reportReview} />
      </div>
    </article>
  );
}
