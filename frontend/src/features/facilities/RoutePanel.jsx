import { Crosshair, LocateFixed, Route as RouteIcon, X } from 'lucide-react';
import { Alert, Button, inputClass } from '../../components/ui';
import { formatDistance, formatDuration } from '../../lib/geo';
import Disclaimer from '../../components/Disclaimer';

// Panel presentasional; logikanya ada di MapPage.
export default function RoutePanel({
  route, facilityName, otherFacilities, geoStatus, geoError,
  onUseMyLocation, onStartPick, onChooseFacility, onBuild, onClear,
}) {
  const { origin, picking, loading, error, data } = route;

  return (
    <section aria-labelledby="route-title" className="space-y-3 rounded-2xl border border-cobalt-200 bg-cobalt-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 id="route-title" className="flex items-center gap-2 text-lg font-bold text-cobalt-900">
          <RouteIcon aria-hidden="true" size={20} /> Rute jalan kaki ke {facilityName}
        </h3>
        <button type="button" onClick={onClear} aria-label="Tutup panel rute" className="-mr-1 inline-flex size-11 items-center justify-center rounded-xl hover:bg-cobalt-100">
          <X aria-hidden="true" />
        </button>
      </div>

      <div>
        <p className="mb-1 font-bold">Titik asal</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="light" onClick={onUseMyLocation} loading={geoStatus === 'loading'}>
            <LocateFixed aria-hidden="true" size={18} /> Lokasi saya
          </Button>
          <Button variant={picking ? 'accent' : 'secondary'} onClick={onStartPick} aria-pressed={picking}>
            <Crosshair aria-hidden="true" size={18} /> {picking ? 'Klik titik di peta…' : 'Pilih di peta'}
          </Button>
        </div>
        {geoError && <p role="alert" className="mt-1 text-sm font-bold text-red-700">{geoError}</p>}

        <label htmlFor="origin-facility" className="mb-1 mt-3 block font-bold">Atau mulai dari fasilitas lain</label>
        <select id="origin-facility" className={inputClass(false)} defaultValue="" onChange={(e) => e.target.value && onChooseFacility(e.target.value)}>
          <option value="">Pilih dari hasil pencarian</option>
          {otherFacilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <p className="mt-2 text-sm" aria-live="polite">
          {origin
            ? <>Asal: <strong>{origin.label}</strong></>
            : 'Belum ada titik asal.'}
        </p>
      </div>

      <Button onClick={onBuild} disabled={!origin} loading={loading} className="w-full">Buat rute</Button>

      {error && <Alert tone="error">{error}</Alert>}

      {data && (
        <div className="space-y-2" aria-live="polite">
          <dl className="grid grid-cols-2 gap-2 rounded-2xl border border-cobalt-100 bg-white p-3 text-sm">
            <div><dt className="text-slate-700">Jarak</dt><dd className="text-lg font-bold">{formatDistance(data.distance_m)}</dd></div>
            <div><dt className="text-slate-700">Perkiraan waktu</dt><dd className="text-lg font-bold">{formatDuration(data.duration_s)}</dd></div>
            <div>
              <dt className="text-slate-700">Skor aksesibilitas rute</dt>
              <dd className="text-lg font-bold">{data.accessibility_score === null ? 'Belum ada data' : `${data.accessibility_score}%`}</dd>
            </div>
            <div><dt className="text-slate-700">Skor rute (70% akses, 30% jarak)</dt><dd className="text-lg font-bold">{data.route_score}</dd></div>
          </dl>
          <p className="text-sm text-slate-800">
            Skor hanya memakai data aksesibilitas yang diketahui sistem. Data yang belum diketahui tidak dianggap tersedia maupun tidak tersedia.
          </p>
          <Disclaimer />
        </div>
      )}
    </section>
  );
}
