import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Flag, MapPin, MessageSquarePlus, Navigation, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { ATTRIBUTE_LABEL, CATEGORY_LABEL } from '../accessibility/constants';
import { breakdown, levelFor, normalizeFacility } from '../accessibility/match';
import LevelBadge, { MatchMeter } from '../../components/LevelBadge';
import Disclaimer from '../../components/Disclaimer';
import { Alert, Button, LinkButton, LoadingBlock } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate } from '../../lib/format';
import { formatDistance } from '../../lib/geo';
import { AttributeList, FreshnessBadge, PhotoGallery, Stars } from './parts';
import { CATEGORY_ICON } from './ResultList';
import { ReportModal, ReviewModal } from './ReviewReport';

const labels = (codes) => codes.map((c) => ATTRIBUTE_LABEL[c]).join(', ');

export default function FacilityDetail({ id, required, distance, onBack, onShowOnMap, onStartRoute, onLoaded, routeSlot }) {
  const needsParam = required.length ? required.join(',') : 'none';
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['facility', id, needsParam],
    queryFn: () => api(`/facilities/${id}`, { params: { needs: needsParam } }),
  });
  const f = useMemo(() => (data ? normalizeFacility(data) : null), [data]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReview, setReportReview] = useState(null);
  useDocumentTitle(f?.name ?? 'Detail fasilitas');
  useEffect(() => { if (f) onLoaded?.(f); }, [f?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const parts = useMemo(() => (f ? breakdown(f.attributes, required) : null), [f, required]);

  if (isLoading) return <LoadingBlock label="Memuat detail fasilitas…" />;
  if (error || !f) {
    return (
      <div className="space-y-3 p-4">
        <Alert tone="error" title="Detail fasilitas tidak dapat dimuat">
          {error?.status === 404 ? 'Fasilitas tidak ditemukan atau sudah dihapus.' : error?.message}
        </Alert>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="light">Kembali ke daftar</Button>
          {error?.status !== 404 && <Button onClick={() => refetch()}>Coba lagi</Button>}
        </div>
      </div>
    );
  }

  const Icon = CATEGORY_ICON[f.category] ?? MapPin;
  const level = levelFor(f);

  return (
    <article aria-labelledby="facility-name">
      <header className="border-b border-cobalt-100 bg-white px-4 pb-5 pt-3">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 font-bold text-cobalt-700 underline underline-offset-4">
          <ArrowLeft aria-hidden="true" size={18} /> Kembali ke daftar
        </button>
        <div className="mt-2 flex items-start gap-3">
          <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-700">
            <Icon size={22} />
          </span>
          <div className="min-w-0">
            <h2 id="facility-name" className="font-display text-2xl font-bold leading-tight">{f.name}</h2>
            <p className="font-bold text-cobalt-700">{CATEGORY_LABEL[f.category] ?? f.category_name}</p>
            <p className="mt-1 flex items-start gap-1 text-slate-700">
              <MapPin aria-hidden="true" className="mt-1 shrink-0" size={16} />
              <span>{f.address}{distance !== null && distance !== undefined && ` (${formatDistance(distance)} dari lokasi Anda)`}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4">
        {f.description && <p>{f.description}</p>}

        <section aria-labelledby="match-title" className="rounded-2xl border border-cobalt-100 bg-white p-4">
          <h3 id="match-title" className="mb-2 font-display text-lg font-bold">Kecocokan dengan kebutuhan Anda</h3>
          {required.length === 0 ? (
            <p className="text-slate-700">Pilih kebutuhan aksesibilitas di filter (atau isi profil Anda) untuk melihat seberapa cocok tempat ini.</p>
          ) : (
            <div className="space-y-2">
              <LevelBadge level={level} percent={f.match_pct} />
              <MatchMeter level={level} percent={f.match_pct} />
              <p><strong>{f.needs_met} dari {f.needs_total}</strong> kebutuhan terpenuhi.</p>
              <ul className="space-y-1 text-sm">
                {parts.met.length > 0 && <li><strong>✓ Tersedia:</strong> {labels(parts.met)}</li>}
                {parts.notAvailable.length > 0 && <li><strong>✗ Tidak tersedia:</strong> {labels(parts.notAvailable)}</li>}
                {parts.unknown.length > 0 && <li><strong>? Belum diketahui:</strong> {labels(parts.unknown)} (tidak dihitung terpenuhi)</li>}
              </ul>
              <p className="text-sm text-slate-600">Ini kecocokan terhadap kebutuhan Anda, bukan jaminan keselamatan atau sertifikasi.</p>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onStartRoute}><Navigation aria-hidden="true" size={18} /> Ke sini</Button>
          <Button variant="light" onClick={onShowOnMap}><MapPin aria-hidden="true" size={18} /> Lihat di peta</Button>
        </div>

        {routeSlot}

        <section aria-labelledby="attr-title" className="space-y-2">
          <h3 id="attr-title" className="font-display text-lg font-bold">Atribut aksesibilitas</h3>
          <AttributeList attributes={f.attributes} required={required} />
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            Terakhir diverifikasi: <strong>{formatDate(f.last_verified_at)}</strong> <FreshnessBadge freshness={f.freshness} />
          </p>
        </section>

        <section aria-labelledby="photo-title" className="space-y-2">
          <h3 id="photo-title" className="font-display text-lg font-bold">Foto</h3>
          <PhotoGallery photos={f.photos} />
        </section>

        <section aria-labelledby="review-title" className="space-y-2">
          <h3 id="review-title" className="font-display text-lg font-bold">Rating dan ulasan</h3>
          {f.rating_count > 0 ? (
            <p className="flex items-center gap-2"><Stars value={f.rating_avg} /><strong>{f.rating_avg} dari 5</strong> dari {f.rating_count} ulasan</p>
          ) : (
            <p className="text-slate-700">Belum ada ulasan.</p>
          )}
          <ul className="space-y-2">
            {f.reviews?.map((r) => (
              <li key={r.id} className="rounded-xl border border-cobalt-100 bg-white p-3">
                <p className="flex flex-wrap items-center gap-2"><strong>{r.user_name}</strong> <Stars value={r.rating} /> <span className="text-sm">{r.rating} dari 5</span></p>
                <p className="text-sm text-slate-600">{formatDate(r.created_at)}</p>
                {r.content && <p className="mt-1">{r.content}</p>}
                <button type="button" onClick={() => { setReportReview(r.id); setReportOpen(true); }} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-slate-600 underline underline-offset-4 hover:text-red-700">
                  Laporkan ulasan<span className="sr-only"> dari {r.user_name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">Rating adalah pengalaman pengguna dan terpisah dari nilai kecocokan.</p>
        </section>

        <section aria-label="Bantu perbarui data" className="flex flex-wrap gap-2">
          <Button variant="light" onClick={() => setReviewOpen(true)}><MessageSquarePlus aria-hidden="true" size={18} /> Tulis ulasan</Button>
          <LinkButton to={`/contribute/${f.id}/update`} variant="light"><Pencil aria-hidden="true" size={18} /> Perbarui data</LinkButton>
          <Button variant="ghost" onClick={() => { setReportReview(null); setReportOpen(true); }}><Flag aria-hidden="true" size={18} /> Laporkan data</Button>
        </section>

        <Disclaimer />
        <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} facilityId={f.id} />
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} facilityId={f.id} reviewId={reportReview} />
      </div>
    </article>
  );
}
