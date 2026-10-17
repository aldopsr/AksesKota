import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, LocateFixed, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { levelFor, normalizeFacility } from '../features/accessibility/match';
import MapView, { MapLegend } from '../features/map/MapView';
import { CoverageNotice, FilterPanel, SearchBar } from '../features/facilities/SearchPanel';
import ResultList from '../features/facilities/ResultList';
import FacilityDetail from '../features/facilities/FacilityDetail';
import RoutePanel from '../features/facilities/RoutePanel';
import AssistantDock from '../features/ai/AssistantDock';
import Disclaimer from '../components/Disclaimer';
import { Alert, Button, EmptyState, LoadingBlock } from '../components/ui';

const INITIAL_ROUTE = { active: false, facilityId: null, origin: null, picking: false, loading: false, error: null, data: null };
const round4 = (n) => (n === null || n === undefined ? null : Math.round(n * 1e4) / 1e4);

export default function MapPage() {
  useDocumentTitle('Peta fasilitas');
  const params = useParams();
  const selectedId = params['*'] || null;
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const category = sp.get('category') ?? '';
  const { session } = useAuth();
  const geo = useGeolocation();

  const [required, setRequired] = useState([]);
  const [touched, setTouched] = useState(false);
  const [usingProfile, setUsingProfile] = useState(false);
  const [radius, setRadius] = useState(null);
  const [voice, setVoice] = useState(null); // { transcript } (mode dasar)
  const [assistantResults, setAssistantResults] = useState(null); // { facilities, transcript } dari asisten AI
  const [pendingRoute, setPendingRoute] = useState(false);
  const [view, setView] = useState('list'); // mobile: 'list' | 'map'
  const [aiOpen, setAiOpen] = useState(false);
  const [route, setRoute] = useState(INITIAL_ROUTE);
  const [focus, setFocus] = useState(null);

  /* ---- profil kebutuhan (hanya bila login) ---- */
  const profileQ = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api('/me/accessibility-profile'),
    enabled: !!session,
  });
  const profile = profileQ.data?.attributes ?? [];
  const profileReady = !session || !profileQ.isLoading;

  useEffect(() => {
    if (!session) { setUsingProfile(false); return; }
    if (profileQ.data && !touched && profile.length > 0) {
      setRequired(profile);
      setUsingProfile(true);
    }
  }, [session, profileQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- data fasilitas: pencocokan & urutan dihitung backend ---- */
  const lat = round4(geo.location?.lat);
  const lon = round4(geo.location?.lon ?? geo.location?.lng);
  const needsParam = required.length ? required.join(',') : 'none';
  const facilitiesQ = useQuery({
    queryKey: ['facilities', { q, category, needsParam, lat, lon, radius }],
    queryFn: ({ signal }) => api('/facilities', { signal, params: { q, category, needs: needsParam, lat, lon, radius, limit: 100 } }),
    enabled: profileReady,
    placeholderData: keepPreviousData,
  });
  const base = useMemo(
    () => assistantResults?.facilities ?? (facilitiesQ.data?.results ?? []).map(normalizeFacility),
    [assistantResults, facilitiesQ.data],
  );
  const items = useMemo(
    () => base.map((f) => ({ facility: f, level: levelFor(f), distance: f.distance_m ?? null })),
    [base],
  );
  const selectedItem = items.find((i) => String(i.facility.id) === selectedId);

  /* ---- filter ---- */
  const changeRequired = (codes) => { setAssistantResults(null); setRequired(codes); setTouched(true); setUsingProfile(false); };
  const toggleProfile = () => {
    setAssistantResults(null);
    setTouched(true);
    if (usingProfile) { setRequired([]); setUsingProfile(false); } else { setRequired(profile); setUsingProfile(true); }
  };
  const submitSearch = (text, cat) => {
    setAssistantResults(null);
    setVoice(null);
    setRadius(null);
    const next = {};
    if (text) next.q = text;
    if (cat) next.category = cat;
    setSp(next);
    if (selectedId) navigate({ pathname: '/map', search: new URLSearchParams(next).toString() });
  };
  const clearVoice = () => { setVoice(null); setRadius(null); setAssistantResults(null); };

  /* ---- pilih fasilitas ---- */
  const onSelect = useCallback((id) => {
    navigate({ pathname: `/map/${id}`, search: location.search });
    setView('list');
  }, [navigate, location.search]);
  const backToList = () => navigate({ pathname: '/map', search: location.search });
  const onDetailLoaded = useCallback((f) => {
    setFocus({ lng: f.lon, lat: f.lat, zoom: 15, key: `sel-${f.id}` });
  }, []);

  /* ---- lokasi ---- */
  async function locateMe() {
    const loc = await geo.locate();
    if (loc) setFocus({ ...loc, zoom: 13, key: `me-${Date.now()}` });
    return loc;
  }

  /* ---- rute (dihitung backend: Mapbox Directions + skor 70/30) ---- */
  async function buildRoute(facilityId, origin) {
    setRoute((r) => ({ ...r, loading: true, error: null, data: null }));
    try {
      const known = base.find((x) => String(x.id) === String(facilityId));
      const fac = known ?? normalizeFacility(await api(`/facilities/${facilityId}`));
      const [dLng, dLat] = fac.location.coordinates;
      const data = await api('/routes/walking', {
        params: { from: `${origin.lng},${origin.lat}`, to: `${dLng},${dLat}`, facility_id: facilityId },
      });
      setRoute((r) => ({ ...r, loading: false, data }));
    } catch (e) {
      setRoute((r) => ({ ...r, loading: false, error: e.message }));
    }
  }
  async function startRoute(facilityId, autoOrigin = null) {
    setRoute({ ...INITIAL_ROUTE, active: true, facilityId: String(facilityId), origin: autoOrigin });
    if (autoOrigin) await buildRoute(facilityId, autoOrigin);
  }
  async function routeUseMyLocation() {
    const loc = await locateMe();
    if (loc) setRoute((r) => ({ ...r, origin: { ...loc, label: 'Lokasi saya' }, picking: false, data: null, error: null }));
  }
  function routeStartPick() {
    setRoute((r) => ({ ...r, picking: !r.picking }));
    setView('map');
  }
  function routePicked({ lng, lat: la }) {
    setRoute((r) => ({ ...r, origin: { lng, lat: la, label: 'Titik yang dipilih di peta' }, picking: false, data: null, error: null }));
    setView('list');
  }
  function routeChooseFacility(fid) {
    const f = base.find((x) => String(x.id) === String(fid));
    if (!f) return;
    const [lng, la] = f.location.coordinates;
    setRoute((r) => ({ ...r, origin: { lng, lat: la, label: f.name }, picking: false, data: null, error: null }));
  }
  const routeHere = route.active && route.facilityId === selectedId;

  /* ---- perintah suara / teks ---- */
  async function handleVoice({ transcript, parsed }) {
    setVoice({ transcript });
    const needs = parsed.needs.length ? parsed.needs : profile;
    setRequired(needs);
    setTouched(true);
    setUsingProfile(!parsed.needs.length && needs.length > 0);
    setRadius(parsed.radius);
    setSp(parsed.category ? { category: parsed.category } : {});
    if (selectedId) navigate('/map');
    setView('list');
    if ((parsed.nearby || parsed.wantsRoute) && !geo.location) await locateMe();
    if (parsed.wantsRoute) setPendingRoute(true);
  }

  // "rute ke ...": tunggu hasil terbaru, lalu buka fasilitas teratas dengan rute dari lokasi pengguna
  useEffect(() => {
    if (!pendingRoute || facilitiesQ.isFetching || facilitiesQ.isPlaceholderData) return;
    setPendingRoute(false);
    const first = items[0]?.facility;
    if (!first) return;
    navigate(`/map/${first.id}`);
    startRoute(first.id, geo.location ? { ...geo.location, label: 'Lokasi saya' } : null);
  }, [pendingRoute, facilitiesQ.isFetching, facilitiesQ.isPlaceholderData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- asisten AI: hasil + rute lewat percakapan ---- */
  function handleAssistantResults({ facilities, applied, transcript }) {
    setAssistantResults({ facilities, transcript });
    setRequired(applied?.needs ?? []);
    setTouched(true);
    setUsingProfile(!!applied?.used_profile);
    setRadius(null);
    setVoice(null);
    setSp({});
    if (selectedId) navigate('/map');
    setView('list');
  }
  async function assistantRoute(facilityId) {
    navigate(`/map/${facilityId}`);
    setView('map');
    const loc = geo.location ?? (await locateMe());
    await startRoute(facilityId, loc ? { ...loc, label: 'Lokasi saya' } : null);
  }
  function assistantOpenFacility(facilityId) {
    navigate(`/map/${facilityId}`);
    setView('list');
  }

  const otherFacilities = base.filter((f) => String(f.id) !== selectedId);
  const loadingList = !assistantResults && (facilitiesQ.isLoading || !profileReady);

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      <h1 className="sr-only">Peta fasilitas aksesibel</h1>

      <div className="flex gap-1 border-b border-cobalt-100 bg-white p-2 lg:hidden">
        {[['list', 'Daftar'], ['map', 'Peta']].map(([key, label]) => (
          <button
            key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
            className={`min-h-11 flex-1 rounded-xl font-bold transition-colors ${view === key ? 'bg-cobalt-700 text-white' : 'bg-cobalt-50 text-cobalt-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Panel kiri: daftar / detail (setara dengan peta untuk pengguna keyboard & pembaca layar) */}
      <section
        aria-label={selectedId ? 'Detail fasilitas' : 'Pencarian dan hasil'}
        className={`${view === 'list' ? 'flex' : 'hidden'} panel-scroll min-h-0 flex-1 flex-col overflow-y-auto bg-cobalt-50/60 lg:flex lg:w-[26rem] lg:flex-none lg:border-r lg:border-cobalt-100 xl:w-[30rem]`}
      >
        {selectedId ? (
          <FacilityDetail
            id={selectedId}
            required={required}
            distance={selectedItem?.distance ?? null}
            onBack={backToList}
            onShowOnMap={() => setView('map')}
            onStartRoute={() => startRoute(selectedId)}
            onLoaded={onDetailLoaded}
            routeSlot={routeHere ? (
              <RoutePanel
                route={route}
                facilityName={selectedItem?.facility.name ?? 'fasilitas ini'}
                otherFacilities={otherFacilities}
                geoStatus={geo.status}
                geoError={geo.error}
                onUseMyLocation={routeUseMyLocation}
                onStartPick={routeStartPick}
                onChooseFacility={routeChooseFacility}
                onBuild={() => buildRoute(selectedId, route.origin)}
                onClear={() => setRoute(INITIAL_ROUTE)}
              />
            ) : null}
          />
        ) : (
          <div className="space-y-4 p-4">
            <SearchBar q={q} category={category} onSubmit={submitSearch} />
            <FilterPanel
              required={required} onChange={changeRequired}
              hasProfile={profile.length > 0} usingProfile={usingProfile} onToggleProfile={toggleProfile}
            />

            {assistantResults && (
              <Alert tone="info" title="Hasil dari asisten">
                <p>“{assistantResults.transcript}”</p>
                <button type="button" onClick={clearVoice} className="mt-1 inline-flex min-h-11 items-center gap-1 font-bold text-cobalt-700 underline underline-offset-4">
                  <X aria-hidden="true" size={16} /> Kembali ke pencarian biasa
                </button>
              </Alert>
            )}

            {voice && (
              <Alert tone="info" title="Hasil pencarian suara">
                <p>“{voice.transcript}”</p>
                {radius && <p className="text-sm">Radius {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}{geo.location ? '' : ' (aktifkan lokasi agar radius dipakai)'}</p>}
                <button type="button" onClick={clearVoice} className="mt-1 inline-flex min-h-11 items-center gap-1 font-bold text-cobalt-700 underline underline-offset-4">
                  <X aria-hidden="true" size={16} /> Hapus hasil suara
                </button>
              </Alert>
            )}

            {!geo.location && (
              <div className="space-y-1">
                <Button variant="light" onClick={locateMe} loading={geo.status === 'loading'}>
                  <LocateFixed aria-hidden="true" size={18} /> Gunakan lokasi saya
                </Button>
                <p className="text-sm text-slate-600">Lokasi dipakai untuk jarak dan hanya disimpan sementara di peramban Anda.</p>
                {geo.error && <p role="alert" className="text-sm font-bold text-red-700">{geo.error}</p>}
              </div>
            )}

            <CoverageNotice />

            <p role="status" aria-live="polite" className="font-bold">
              {loadingList ? 'Memuat fasilitas…' : `${items.length} fasilitas ditemukan`}
            </p>

            {loadingList && <LoadingBlock />}
            {facilitiesQ.error && (
              <Alert tone="error" title="Data fasilitas tidak dapat dimuat">
                {facilitiesQ.error.message}
                <div className="mt-2"><Button onClick={() => facilitiesQ.refetch()}>Coba lagi</Button></div>
              </Alert>
            )}
            {!loadingList && items.length === 0 && !facilitiesQ.error && (
              <EmptyState title="Tidak ditemukan data yang sesuai">
                Belum ada fasilitas dengan kriteria ini di data AksesKota. Ubah kata kunci, kategori, atau kebutuhan, atau bantu dengan menambahkan data.
              </EmptyState>
            )}
            <ResultList items={items} selectedId={selectedId} />
            <Disclaimer />
          </div>
        )}
      </section>

      {/* Peta */}
      <div className={`${view === 'map' ? 'block' : 'hidden'} relative min-h-0 flex-1 lg:block`}>
        <MapView
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          userLocation={geo.location}
          origin={routeHere ? route.origin : null}
          routeGeometry={routeHere ? route.data?.geometry ?? null : null}
          pickingOrigin={routeHere && route.picking}
          onPickOrigin={routePicked}
          focus={focus}
        />
        <details className="absolute bottom-3 left-3 z-10">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-xl border border-cobalt-100 bg-white px-4 font-bold shadow-md">Legenda</summary>
          <div className="mt-1"><MapLegend /></div>
        </details>
        {routeHere && route.picking && (
          <div role="status" className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-2 font-bold text-white shadow-lg">
            Klik peta untuk menentukan titik asal
            <button type="button" onClick={routeStartPick} className="min-h-11 rounded px-2 underline">Batal</button>
          </div>
        )}
      </div>

      {!aiOpen && (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          aria-haspopup="dialog"
          className="fixed bottom-5 right-5 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-cobalt-700 px-5 text-base font-bold text-white shadow-lg transition-colors hover:bg-cobalt-800"
        >
          <Bot aria-hidden="true" /> Tanya asisten
        </button>
      )}

      <AssistantDock
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        userLocation={geo.location}
        onLocate={locateMe}
        currentFacilityId={selectedId}
        onApplyResults={handleAssistantResults}
        onRoute={assistantRoute}
        onOpenFacility={assistantOpenFacility}
        onFallback={handleVoice}
      />
    </div>
  );
}
