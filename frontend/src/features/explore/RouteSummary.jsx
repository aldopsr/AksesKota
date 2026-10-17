import { useState } from 'react';
import { Crosshair, LocateFixed, MapPin, Route as RouteIcon, X } from 'lucide-react';
import { Alert, Button, IconButton, SelectField, Skeleton } from '../../components/ui';
import { formatDistance, formatDuration } from '../../lib/geo';

// Ringkasan rute jalan kaki (IA 5.4). Mewakili 5 keadaan: butuh titik awal, memuat, berhasil, gagal.
// Rute ini DASAR: belum memakai data kondisi jalan, hanya atribut fasilitas tujuan yang diketahui.
export default function RouteSummary({
  route, facilityName, otherFacilities, geoStatus, geoError,
  onUseMyLocation, onStartPick, onChooseFacility, onRetry, onClose, compact = false,
}) {
  const { origin, picking, loading, error, data } = route;
  const [editing, setEditing] = useState(false);
  const chooser = !origin || editing;

  return (
    <section aria-labelledby="route-title" className={`rounded-card border border-border bg-surface ${compact ? 'p-4' : 'border-brand-200 bg-brand-50 p-4'}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 id="route-title" className="flex items-center gap-2 font-semibold">
          <RouteIcon aria-hidden="true" size={18} className="text-brand-800" /> Rute jalan kaki ke {facilityName}
        </h3>
        <IconButton label="Tutup rute" variant="ghost" onClick={onClose} className="-mr-2 -mt-2"><X aria-hidden="true" size={18} /></IconButton>
      </div>

      {chooser && (
        <div className="mt-3 space-y-3">
          <p className="font-sub text-sm text-ink-secondary">{origin ? 'Pilih titik awal yang baru.' : 'Dari mana Anda berangkat?'}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { onUseMyLocation(); setEditing(false); }} loading={geoStatus === 'loading'}><LocateFixed aria-hidden="true" size={16} /> Gunakan lokasi saya</Button>
            <Button variant="secondary" onClick={onStartPick} aria-pressed={picking}><Crosshair aria-hidden="true" size={16} /> {picking ? 'Klik titik di peta…' : 'Pilih di peta'}</Button>
          </div>
          {geoError && <p role="alert" className="text-sm font-semibold text-danger">{geoError}</p>}
          {!compact && otherFacilities.length > 0 && (
            <SelectField label="Atau mulai dari fasilitas lain" defaultValue="" onChange={(e) => { if (e.target.value) { onChooseFacility(e.target.value); setEditing(false); } }}>
              <option value="">Pilih dari hasil pencarian</option>
              {otherFacilities.slice(0, 40).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </SelectField>
          )}
          {origin && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Batal</Button>}
        </div>
      )}

      {!chooser && loading && (
        <div className="mt-3 space-y-2" role="status" aria-label="Menghitung rute">
          <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {!chooser && error && (
        <Alert tone="danger" className="mt-3" actions={<Button size="sm" variant="secondary" onClick={onRetry}>Coba lagi</Button>}>{error}</Alert>
      )}

      {!chooser && data && (
        <div className="mt-3 space-y-3" aria-live="polite">
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="font-sub text-sm text-ink-secondary">Jarak</dt><dd className="text-2xl font-bold tabular-nums">{formatDistance(data.distance_m)}</dd></div>
            <div><dt className="font-sub text-sm text-ink-secondary">Perkiraan waktu</dt><dd className="text-2xl font-bold tabular-nums">{formatDuration(data.duration_s)}</dd></div>
          </dl>
          <p className="font-sub flex items-center gap-1.5 text-sm text-ink-secondary"><MapPin aria-hidden="true" size={14} /> Dari: <strong className="font-semibold text-ink">{origin.label}</strong></p>
          <p className="text-sm">
            Skor aksesibilitas tujuan:{' '}
            <strong>{data.accessibility_score === null ? 'belum ada data' : `${data.accessibility_score}%`}</strong>
            <span className="font-sub text-ink-secondary"> · skor rute {data.route_score} (70% aksesibilitas, 30% jarak)</span>
          </p>
          <p className="font-sub text-sm text-ink-secondary">
            Ini rute jalan kaki dasar. Kondisi trotoar, penyeberangan, dan hambatan di jalan belum tercakup, dan tidak ada jaminan rute bebas hambatan.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Ubah titik awal</Button>
        </div>
      )}
    </section>
  );
}
