import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bot, List, LocateFixed, Map as MapIcon, SlidersHorizontal, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAssistant, useLocationState, useToast } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { buildExplore, readExplore } from '../lib/url';
import { levelFor, normalizeFacility } from '../features/accessibility/match';
import { ATTRIBUTE_LABEL, CATEGORIES, COVERAGE_NOTE } from '../features/accessibility/constants';
import MapView from '../features/map/MapView';
import { AssistantFab, MapControls, MapLegend } from '../features/map/MapChrome';
import FacilityCard from '../features/explore/FacilityCard';
import FilterSheet from '../features/explore/FilterSheet';
import FacilityDetailPanel from '../features/explore/FacilityDetailPanel';
import RouteSummary from '../features/explore/RouteSummary';
import MapSheet from '../features/explore/MapSheet';
import { Alert, Button, Chip, EmptyState, IconButton, LinkButton, RemovableChip, SearchInput, Skeleton } from '../components/ui';

const PAGE = 20;
const INITIAL_ROUTE = { facilityId: null, origin: null, picking: false, loading: false, error: null, data: null };
const round4 = (n) => (n === null || n === undefined ? null : Math.round(n * 1e4) / 1e4);

export default function ExplorePage() {
  const { id: rawId } = useParams();
  const id = rawId ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const params = readExplore(sp);
  const { session } = useAuth();
  const geo = useLocationState();
  const assistant = useAssistant();
  const toast = useToast();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  useDocumentTitle(id ? null : 'Jelajahi fasilitas');

  const mapRef = useRef(null);
  const [view, setView] = useState('list'); // mobile: 'list' | 'map'
  const [filterOpen, setFilterOpen] = useState(false);
  const [qInput, setQInput] = useState(params.q);
  const [limit, setLimit] = useState(PAGE);
  const [previewId, setPreviewId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loaded, setLoaded] = useState(null); // fasilitas yang sedang dibuka (untuk sheet mobile)
  const [mapProblem, setMapProblem] = useState(false);
  const [route, setRoute] = useState(INITIAL_ROUTE);
  const autoTried = useRef(null);

  /* ---------- kebutuhan: URL > profil (bila login) > kosong ---------- */
  const profileQ = useQuery({ queryKey: ['my-profile'], queryFn: () => api('/me/accessibility-profile'), enabled: !!session });
  const profile = profileQ.data?.attributes ?? [];
  const profileReady = !session || !profileQ.isLoading;
  const required = params.needsRaw === null ? (session ? profile : []) : params.needs;
  const usingProfile = params.needsRaw === null && !!session && profile.length > 0;
  const needsParam = required.length ? required.join(',') : 'none';

  /* ---------- navigasi parameter ---------- */
  const goExplore = useCallback((patch, { keepDetail = false } = {}) => {
    navigate({
      pathname: keepDetail && id ? location.pathname : '/map',
      search: buildExplore({ ...params, route: keepDetail ? params.route : false, ...patch }),
    });
  }, [navigate, params, id, location.pathname]);
  const needsPatch = (codes) => ({ needsRaw: codes.length ? codes.join(',') : 'none' });

  useEffect(() => { setQInput(params.q); }, [params.q]);
  useEffect(() => { if (params.assistant) { assistant.openAssistant(); navigate({ pathname: location.pathname, search: buildExplore({ ...params }) }, { replace: true }); } }, [params.assistant]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- data: pencocokan dan urutan dihitung backend ---------- */
  const lat = round4(geo.location?.lat);
  const lon = round4(geo.location?.lon);
  const filtersKey = `${params.q}|${params.category}|${needsParam}|${params.radius}`;
  useEffect(() => { setLimit(PAGE); }, [filtersKey]);
  const facilitiesQ = useQuery({
    queryKey: ['facilities', { q: params.q, category: params.category, needsParam, lat, lon, radius: params.radius, limit }],
    queryFn: ({ signal }) => api('/facilities', { signal, params: { q: params.q, category: params.category, needs: needsParam, lat, lon, radius: params.radius, limit } }),
    enabled: profileReady,
    placeholderData: keepPreviousData,
  });
  const results = useMemo(() => (facilitiesQ.data?.results ?? []).map(normalizeFacility), [facilitiesQ.data]);
  const items = useMemo(() => results.map((f) => ({ facility: f, level: levelFor(f), distance: f.distance_m ?? null })), [results]);
  const loadingList = facilitiesQ.isLoading || !profileReady;

  /* ---------- lokasi ---------- */
  async function locateMe() {
    const loc = await geo.locate();
    if (loc) { setFocus({ ...loc, zoom: 13, key: `me-${Date.now()}` }); mapRef.current?.flyTo({ lng: loc.lng, lat: loc.lat, zoom: 13 }); }
    return loc;
  }

  /* ---------- rute (dihitung backend: Mapbox Directions + skor 70/30) ---------- */
  const routeHere = params.route && !!id;
  useEffect(() => { setRoute((r) => (routeHere && r.facilityId === id ? r : INITIAL_ROUTE)); }, [routeHere, id]);

  async function buildRoute(origin, facilityId = id) {
    setRoute((r) => ({ ...r, facilityId: String(facilityId), origin, picking: false, loading: true, error: null, data: null }));
    try {
      const known = results.find((x) => String(x.id) === String(facilityId));
      const fac = known ?? normalizeFacility(await api(`/facilities/${facilityId}`, { params: { needs: 'none' } }));
      const data = await api('/routes/walking', { params: { from: `${origin.lng},${origin.lat}`, to: `${fac.lon},${fac.lat}`, facility_id: facilityId } });
      setRoute((r) => ({ ...r, loading: false, data }));
    } catch (e) {
      setRoute((r) => ({ ...r, loading: false, error: e.message }));
    }
  }
  async function startRoute(facilityId) {
    navigate({ pathname: `/facilities/${facilityId}`, search: buildExplore({ ...params, route: true }) });
    if (!isDesktop) setView('map');
    const loc = geo.location ?? (await locateMe());
    if (loc) await buildRoute({ lng: loc.lng, lat: loc.lat, label: 'Lokasi saya' }, facilityId);
    else setRoute({ ...INITIAL_ROUTE, facilityId: String(facilityId) });
  }
  // Rute dimulai lewat URL (mis. dari asisten) dan lokasi sudah ada
  useEffect(() => {
    if (routeHere && !route.origin && !route.loading && !route.data && geo.location && autoTried.current !== id) {
      autoTried.current = id;
      buildRoute({ lng: geo.location.lng, lat: geo.location.lat, label: 'Lokasi saya' });
    }
  }, [routeHere, geo.location, route.origin, route.loading, route.data, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeRoute = () => navigate({ pathname: location.pathname, search: buildExplore({ ...params, route: false }) });
  const routeUseMyLocation = async () => { const loc = geo.location ?? (await locateMe()); if (loc) buildRoute({ lng: loc.lng, lat: loc.lat, label: 'Lokasi saya' }); };
  const routeStartPick = () => { setRoute((r) => ({ ...r, picking: !r.picking, facilityId: String(id) })); if (!isDesktop) setView('map'); };
  const routePicked = ({ lng, lat: la }) => buildRoute({ lng, lat: la, label: 'Titik yang dipilih di peta' });
  const routeChooseFacility = (fid) => {
    const f = results.find((x) => String(x.id) === String(fid));
    if (f) buildRoute({ lng: f.lon, lat: f.lat, label: f.name });
  };

  /* ---------- peta ---------- */
  const onMarkerSelect = useCallback((mid) => {
    if (id) { navigate({ pathname: `/facilities/${mid}`, search: location.search }); return; }
    setPreviewId(mid);
    if (isDesktop) document.getElementById(`facility-${mid}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [id, navigate, location.search, isDesktop]);
  const onDetailLoaded = useCallback((f) => { setLoaded(f); setFocus({ lng: f.lon, lat: f.lat, zoom: 15, key: `sel-${f.id}` }); }, []);
  const openDetail = (fid) => { navigate({ pathname: `/facilities/${fid}`, search: location.search }); setView('list'); };
  const previewFacility = results.find((f) => String(f.id) === String(previewId)) ?? null;

  /* ---------- ringkasan ---------- */
  const catLabel = CATEGORIES.find((c) => c.code === params.category)?.label;
  const sortText = required.length ? (geo.location ? 'kecocokan kebutuhan, lalu jarak' : 'kecocokan kebutuhan, lalu nama') : (geo.location ? 'jarak terdekat' : 'nama');
  const hasFilters = !!(params.q || params.category || required.length || params.radius);

  const topBar = (
    <div className="space-y-2.5 border-b border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <SearchInput
          className="min-w-0 flex-1" id="explore-search" value={qInput} onChange={setQInput} placeholder="Cari nama, kategori, atau lokasi"
          onSubmit={(v) => goExplore({ q: v.trim() })} onClear={() => params.q && goExplore({ q: '' })}
        />
        <IconButton label={`Filter kebutuhan${required.length ? `, ${required.length} aktif` : ''}`} onClick={() => setFilterOpen(true)} className="relative">
          <SlidersHorizontal aria-hidden="true" size={20} />
          {required.length > 0 && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{required.length}</span>}
        </IconButton>
        <IconButton label="Tanya asisten" onClick={assistant.openAssistant} className="lg:hidden"><Bot aria-hidden="true" size={20} /></IconButton>
      </div>
      <div role="group" aria-label="Kategori" className={`no-scrollbar -mx-3 gap-2 overflow-x-auto px-3 pb-0.5 ${view === 'map' ? 'hidden lg:flex' : 'flex'}`}>
        <Chip pressed={!params.category} onClick={() => goExplore({ category: '' })}>Semua</Chip>
        {CATEGORIES.map((c) => <Chip key={c.code} pressed={params.category === c.code} onClick={() => goExplore({ category: c.code })}>{c.label}</Chip>)}
      </div>
      {(required.length > 0 || params.radius) && (
        <ul aria-label="Filter aktif" className="flex flex-wrap gap-2">
          {usingProfile && <li><RemovableChip label="Profil saya" onRemove={() => goExplore({ needsRaw: 'none' })} /></li>}
          {!usingProfile && required.map((c) => <li key={c}><RemovableChip label={ATTRIBUTE_LABEL[c]} onRemove={() => goExplore(needsPatch(required.filter((x) => x !== c)))} /></li>)}
          {params.radius && <li><RemovableChip label={`Radius ${params.radius >= 1000 ? `${params.radius / 1000} km` : `${params.radius} m`}`} onRemove={() => goExplore({ radius: null })} /></li>}
        </ul>
      )}
    </div>
  );

  const listContent = (
    <div className="space-y-3 p-3">
      <h2 className="sr-only">Hasil pencarian</h2>
      {params.intent === 'update' && (
        <Alert tone="info" title="Perbarui data fasilitas" actions={<Button size="sm" variant="secondary" onClick={() => goExplore({ intent: '' })}>Mengerti</Button>}>
          Pilih fasilitas di daftar, lalu tekan <strong>Usulkan pembaruan</strong> di halaman detailnya.
        </Alert>
      )}
      {!facilitiesQ.error && (
      <div className="space-y-0.5">
        <p role="status" aria-live="polite" className="font-semibold">
          {loadingList ? 'Memuat fasilitas…' : (
            <>{results.length} fasilitas{results.length >= limit && limit < 200 ? ' (dibatasi)' : ''}{params.q && <> untuk “{params.q}”</>}{catLabel && <> · {catLabel}</>}{required.length > 0 && <> · {usingProfile ? 'profil Anda' : `${required.length} kebutuhan`}</>}</>
          )}
        </p>
        <p className="font-sub text-sm text-ink-secondary">Urutan: {sortText}.</p>
      </div>
      )}
      {!geo.location && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={locateMe} loading={geo.status === 'loading'}><LocateFixed aria-hidden="true" size={15} /> Aktifkan lokasi untuk jarak</Button>
          <span className="font-sub text-xs text-ink-secondary">Lokasi hanya disimpan sementara di peramban Anda.</span>
        </div>
      )}
      {geo.error && <p role="alert" className="text-sm font-semibold text-danger">{geo.error}</p>}
      {params.radius && !geo.location && <p className="font-sub text-sm text-ink-secondary">Radius hanya dipakai setelah lokasi aktif.</p>}

      {loadingList && <div className="space-y-2" aria-hidden="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>}
      {facilitiesQ.error && !loadingList && (
        <Alert tone="danger" title="Data fasilitas tidak dapat dimuat" actions={<Button size="sm" variant="secondary" onClick={() => facilitiesQ.refetch()}>Coba lagi</Button>}>{facilitiesQ.error.message}</Alert>
      )}
      {!loadingList && !facilitiesQ.error && results.length === 0 && (
        <EmptyState
          icon={SearchX} title="Tidak ada hasil untuk parameter ini"
          actions={(
            <>
              {hasFilters && <Button variant="secondary" onClick={() => navigate('/map')}>Hapus semua filter</Button>}
              <Button variant="secondary" onClick={() => document.getElementById('explore-search')?.focus()}>Ubah pencarian</Button>
              <LinkButton to="/facilities/new">Usulkan fasilitas</LinkButton>
            </>
          )}
        >
          {COVERAGE_NOTE}
        </EmptyState>
      )}

      <ul className="space-y-2.5">
        {items.map(({ facility, level, distance }) => (
          <li key={facility.id}>
            <FacilityCard
              facility={facility} level={level} distance={distance} selected={String(facility.id) === String(previewId)}
              to={`/facilities/${facility.id}${location.search}`} onRoute={() => startRoute(facility.id)}
            />
          </li>
        ))}
      </ul>

      {!loadingList && results.length >= limit && limit < 200 && (
        <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => Math.min(200, l + PAGE))} loading={facilitiesQ.isFetching}>Muat lebih banyak</Button>
      )}
      {!loadingList && results.length > 0 && <p className="font-sub text-xs text-ink-secondary">{COVERAGE_NOTE}</p>}
    </div>
  );

  const routeSummary = routeHere && route.facilityId === id ? (
    <RouteSummary
      route={route} facilityName={loaded?.name ?? 'fasilitas ini'} otherFacilities={results.filter((f) => String(f.id) !== id)}
      geoStatus={geo.status} geoError={geo.error} compact={!isDesktop && view === 'map'}
      onUseMyLocation={routeUseMyLocation} onStartPick={routeStartPick} onChooseFacility={routeChooseFacility}
      onRetry={() => route.origin && buildRoute(route.origin)} onClose={closeRoute}
    />
  ) : null;

  const detail = id && (
    <FacilityDetailPanel
      id={id} required={required} usingProfile={usingProfile}
      distance={results.find((f) => String(f.id) === id)?.distance_m ?? null}
      onBack={() => navigate({ pathname: '/map', search: buildExplore({ ...params, route: false }) })}
      onStartRoute={() => startRoute(id)} onShowMap={() => setView('map')} onEditNeeds={() => setFilterOpen(true)} onLoaded={onDetailLoaded}
      routeSlot={isDesktop || view === 'list' ? routeSummary : null}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      <h1 className="sr-only">Jelajahi fasilitas aksesibel</h1>

      <div className={`flex min-h-0 flex-col bg-surface lg:w-[24rem] lg:flex-none lg:border-r lg:border-border xl:w-[25rem] ${view === 'list' ? 'flex-1' : ''}`}>
        {!id && topBar}
        <div className="border-b border-border bg-surface p-2 lg:hidden">
          <div role="group" aria-label="Tampilan" className="grid grid-cols-2 gap-1 rounded-control bg-surface-subtle p-1">
            {[['list', id ? 'Detail' : 'Daftar', List], ['map', 'Peta', MapIcon]].map(([k, label, Ic]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control font-semibold transition-colors ${view === k ? 'bg-surface text-brand-900 shadow-panel' : 'text-ink-secondary'}`}>
                <Ic aria-hidden="true" size={17} /> {label}
              </button>
            ))}
          </div>
        </div>
        <section aria-label={id ? 'Detail fasilitas' : 'Hasil pencarian'} className={`panel-scroll min-h-0 flex-1 overflow-y-auto bg-canvas ${view === 'list' ? '' : 'hidden lg:block'}`}>
          {id ? detail : listContent}
        </section>
      </div>

      <div className={`relative min-h-0 flex-1 ${view === 'map' ? 'block' : 'hidden'} lg:block`}>
        <MapView
          ref={mapRef} items={items} selectedId={id ?? previewId} onSelect={onMarkerSelect}
          userLocation={geo.location} origin={routeHere ? route.origin : null} routeGeometry={routeHere ? route.data?.geometry ?? null : null}
          pickingOrigin={routeHere && route.picking} onPickOrigin={routePicked} focus={focus}
          onError={(e) => { if ([401, 403].includes(e?.error?.status)) setMapProblem(true); }}
          fitPaddingBottom={isDesktop ? 70 : 150}
        />
        <MapLegend />
        <MapControls onZoomIn={() => mapRef.current?.zoomIn()} onZoomOut={() => mapRef.current?.zoomOut()} onLocate={locateMe} locating={geo.status === 'loading'} />
        <AssistantFab onClick={assistant.openAssistant} />
        {mapProblem && <div className="absolute inset-x-3 top-20 z-30 mx-auto max-w-md"><Alert tone="danger">Peta tidak dapat dimuat (token tidak valid). Daftar hasil tetap bisa dipakai.</Alert></div>}
        {routeHere && route.picking && (
          <div role="status" className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-control bg-ink px-4 py-2 font-semibold text-white shadow-popover">
            Klik peta untuk menentukan titik awal
            <button type="button" onClick={routeStartPick} className="min-h-11 px-2 underline">Batal</button>
          </div>
        )}

        {!isDesktop && view === 'map' && (
          routeHere && route.facilityId === id ? <MapSheet>{routeSummary}</MapSheet>
            : id ? <MapSheet preview={loaded} onOpen={() => setView('list')} onRoute={() => startRoute(id)} />
              : <MapSheet count={results.length} preview={previewFacility} onShowList={() => setView('list')} onOpen={openDetail} onRoute={startRoute} />
        )}
      </div>

      <FilterSheet
        open={filterOpen} onClose={() => setFilterOpen(false)} required={required} session={session} profile={profile}
        onApply={(codes) => { goExplore(needsPatch(codes), { keepDetail: true }); toast.show(codes.length ? `${codes.length} kebutuhan diterapkan.` : 'Filter kebutuhan dihapus.', 'info'); }}
      />
    </div>
  );
}

