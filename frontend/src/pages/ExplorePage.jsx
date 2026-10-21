import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LocateFixed, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAssistant, useLocationState, useToast } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { buildExplore, readExplore } from '../lib/url';
import { levelFor, normalizeFacility } from '../features/accessibility/match';
import { ATTRIBUTE_LABEL, CATEGORIES, COVERAGE_NOTE } from '../features/accessibility/constants';
import MapView from '../features/map/MapView';
import { MapControls } from '../features/map/MapChrome';
import FacilityCard from '../features/explore/FacilityCard';
import FilterSheet from '../features/explore/FilterSheet';
import NeedsPrompt from '../features/accessibility/NeedsPrompt';
import FacilityDetailPanel from '../features/explore/FacilityDetailPanel';
import RouteSummary from '../features/explore/RouteSummary';
import BottomSheet from '../features/explore/BottomSheet';
import PanelJangkauan from '../features/explore/PanelJangkauan';
import FloatingCard from '../features/explore/FloatingCard';
import AjakanMasuk from '../features/explore/AjakanMasuk';
import { LandingSections } from './HomePage';
import { Alert, Button, EmptyState, LinkButton, RemovableChip, Skeleton } from '../components/ui';

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

  // Di "/" peta hanya hero setinggi satu layar dan halaman berlanjut ke bawah.
  // Di /map dan /facilities/:id ia kerangka aplikasi penuh tanpa bagian landing.
  const halamanDepan = location.pathname === '/';
  const heroRef = useRef(null);
  const [heroTerlihat, setHeroTerlihat] = useState(true);
  useEffect(() => {
    if (!halamanDepan || !heroRef.current) { setHeroTerlihat(true); return undefined; }
    // Kartu mengambang memakai position: fixed, jadi tanpa ini ia tetap melayang di
    // atas bagian "Cara kerja" saat halaman digulir — menutupi isi yang tidak ada
    // hubungannya dengan peta.
    //
    // rootMargin, bukan threshold: kartu memanjang sampai dekat dasar layar, jadi yang
    // menentukan bukan "berapa persen hero terlihat" melainkan "apakah hero masih
    // menutupi sampai dasar layar". Ambang persen (0.15) sempat dipakai dan kartunya
    // tetap menimpa isi di bawah, karena 15% hero yang tersisa itu ada di ATAS layar
    // sementara kartunya menjulur ke bawah.
    const io = new IntersectionObserver(
      ([e]) => setHeroTerlihat(e.isIntersecting),
      { rootMargin: '-95% 0px 0px 0px', threshold: 0 },
    );
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, [halamanDepan]);

  useDocumentTitle(id ? null : 'Jelajahi fasilitas');

  const mapRef = useRef(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const sheetRef = useRef(null);
  const [limit, setLimit] = useState(PAGE);
  const [previewId, setPreviewId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loaded, setLoaded] = useState(null); // fasilitas yang sedang dibuka (untuk sheet mobile)
  const [mapProblem, setMapProblem] = useState(false);
  // Pilihan gaya peta diingat: orang yang memilih satelit biasanya memilihnya karena
  // cara mereka mengenali tempat, bukan untuk sekali lihat.
  const [gayaPeta, setGayaPeta] = useState(() => {
    try { return localStorage.getItem('ak_gaya_peta') === 'satelit' ? 'satelit' : 'jalan'; } catch { return 'jalan'; }
  });
  // Lapisan jaringan pejalan kaki. Mati secara bawaan: layar pertama tetap harus
  // menjawab "ada apa di sekitar saya", dan 24 ribu garis sebelum pertanyaan itu
  // terjawab hanya menutupi penanda.
  const [jalurTerlihat, setJalurTerlihat] = useState(() => {
    try { return localStorage.getItem('ak_lapisan_jalur') === '1'; } catch { return false; }
  });
  const [jalurTerlaluJauh, setJalurTerlaluJauh] = useState(false);
  const [ringkasJalur, setRingkasJalur] = useState(null);

  // Mode jangkauan: ketuk satu titik, lalu dua perjalanan dihitung di atas jaringan
  // yang sama — satu tanpa larangan, satu dengan tangga dibuang. Selisihnya yang
  // jadi jawabannya.
  const [modeJangkauan, setModeJangkauan] = useState(false);
  const [menitJangkauan, setMenitJangkauan] = useState(15);
  const [titikJangkauan, setTitikJangkauan] = useState(null);
  const jangkauanQ = useQuery({
    queryKey: ['jangkauan', titikJangkauan?.lng, titikJangkauan?.lat, menitJangkauan],
    queryFn: ({ signal }) => api('/jangkauan', {
      signal,
      params: { lon: titikJangkauan.lng, lat: titikJangkauan.lat, menit: menitJangkauan },
    }),
    enabled: !!titikJangkauan,
  });
  const tutupJangkauan = () => { setModeJangkauan(false); setTitikJangkauan(null); };
  const gantiModeJangkauan = (v) => {
    setModeJangkauan(v);
    if (!v) setTitikJangkauan(null);
    // Panel bawah turun supaya ada peta untuk diketuk — alasan yang sama dengan
    // mode pilih titik awal rute.
    if (v && !isDesktop) sheetRef.current?.mengintip();
  };
  const gantiJalur = (v) => {
    setJalurTerlihat(v);
    try { localStorage.setItem('ak_lapisan_jalur', v ? '1' : '0'); } catch { /* mode privat */ }
  };
  const gantiGayaPeta = (g) => {
    setGayaPeta(g);
    try { localStorage.setItem('ak_gaya_peta', g); } catch { /* mode privat */ }
  };
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
  // Panel kebutuhan bisa dibuka dari navbar lewat URL (?filter=1), pola yang sama
  // dengan asisten. Parameternya langsung dibersihkan supaya tombol Back tidak
  // membukanya lagi.
  useEffect(() => {
    if (!sp.get('filter')) return;
    setFilterOpen(true);
    const bersih = new URLSearchParams(sp);
    bersih.delete('filter');
    navigate({ pathname: location.pathname, search: bersih.toString() ? `?${bersih}` : '' }, { replace: true });
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!isDesktop) sheetRef.current?.minimalSetengah();
    } catch (e) {
      setRoute((r) => ({ ...r, loading: false, error: e.message }));
    }
  }
  async function startRoute(facilityId) {
    navigate({ pathname: `/facilities/${facilityId}`, search: buildExplore({ ...params, route: true }) });
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
  const routeStartPick = () => {
    // Dihitung di luar updater setRoute. Updater dipanggil React pada fase render,
    // dan memanggil mengintip() dari sana berarti mengubah state komponen lain
    // di tengah render komponen ini — React memperingatkannya, dan akibatnya
    // tidak dapat diramalkan.
    const picking = !route.picking;
    if (picking && !isDesktop) sheetRef.current?.mengintip();
    setRoute((r) => ({ ...r, picking, facilityId: String(id) }));
  };
  const routePicked = ({ lng, lat: la }) => buildRoute({ lng, lat: la, label: 'Titik yang dipilih di peta' });
  const routeChooseFacility = (fid) => {
    const f = results.find((x) => String(x.id) === String(fid));
    if (f) buildRoute({ lng: f.lon, lat: f.lat, label: f.name });
  };

  /* ---------- peta ---------- */
  const onMarkerSelect = useCallback((mid) => {
    if (id) { navigate({ pathname: `/facilities/${mid}`, search: location.search }); return; }
    setPreviewId(mid);
    // Di HP kartunya ada di dalam panel bawah: naikkan dulu panelnya, baru gulirkan.
    // Tanpa ini mengetuk marker di layar kecil tidak terlihat melakukan apa pun.
    if (!isDesktop) sheetRef.current?.minimalSetengah();
    requestAnimationFrame(() => {
      document.getElementById(`facility-${mid}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [id, navigate, location.search, isDesktop]);
  const onDetailLoaded = useCallback((f) => { setLoaded(f); setFocus({ lng: f.lon, lat: f.lat, zoom: 15, key: `sel-${f.id}` }); }, []);
  const openDetail = (fid) => { navigate({ pathname: `/facilities/${fid}`, search: location.search }); };

  /* ---------- ringkasan ---------- */
  const catLabel = CATEGORIES.find((c) => c.code === params.category)?.label;
  const sortText = required.length ? (geo.location ? 'kecocokan kebutuhan, lalu jarak' : 'kecocokan kebutuhan, lalu nama') : (geo.location ? 'jarak terdekat' : 'nama');
  const hasFilters = !!(params.q || params.category || required.length || params.radius);

  const filterAktif = (required.length > 0 || params.radius) && (
    <ul aria-label="Filter aktif" className="flex flex-wrap gap-2">
      {usingProfile && <li><RemovableChip label="Profil saya" onRemove={() => goExplore({ needsRaw: 'none' })} /></li>}
      {!usingProfile && required.map((c) => <li key={c}><RemovableChip label={ATTRIBUTE_LABEL[c]} onRemove={() => goExplore(needsPatch(required.filter((x) => x !== c)))} /></li>)}
      {params.radius && <li><RemovableChip label={`Radius ${params.radius >= 1000 ? `${params.radius / 1000} km` : `${params.radius} m`}`} onRemove={() => goExplore({ radius: null })} /></li>}
    </ul>
  );

  const listContent = (
    <div className="space-y-3 p-3">
      <h2 className="sr-only">Hasil pencarian</h2>
      {filterAktif}
      {params.intent === 'update' && (
        <Alert tone="info" title="Perbarui data fasilitas" actions={<Button size="sm" variant="secondary" onClick={() => goExplore({ intent: '' })}>Mengerti</Button>}>
          Pilih fasilitas di daftar, lalu tekan <strong>Usulkan pembaruan</strong> di halaman detailnya.
        </Alert>
      )}
      {/* Pertanyaan kebutuhan didahulukan: tanpa itu kartu tampil tanpa kecocokan
          dan semua marker peta berwarna sama.
          Tapi TIDAK di ponsel saat ada pencarian: di sana panel ini memang hanya muncul
          setelah pengguna mencari sesuatu, dan kartu setinggi 430 px di atas hasil
          pertama berarti orang yang mengetik "bogor" mendapat formulir kebutuhan, bukan
          jawabannya. Di layar sempit pertanyaan itu sudah punya tempatnya sendiri:
          kartu mengambang di atas peta, sebelum ada yang dicari. */}
      {required.length === 0 && !loadingList && (isDesktop || !(params.q || params.category)) && (
        <NeedsPrompt
          onApply={(codes) => { goExplore(needsPatch(codes), { keepDetail: true }); toast.show(`${codes.length} kebutuhan diterapkan.`, 'info'); }}
          onOpenFilter={() => setFilterOpen(true)}
        />
      )}

      {/* Di HP jumlah hasil sudah terbaca di gagang panel bawah; mengulanginya di sini
          hanya menambah satu baris sebelum hasil pertama. */}
      {!facilitiesQ.error && (
      <div className="hidden space-y-0.5 lg:block">
        <p role="status" aria-live="polite" className="font-semibold">
          {loadingList ? 'Memuat fasilitas…' : (
            <>{results.length} fasilitas{params.q && <> untuk “{params.q}”</>}{catLabel && <> · {catLabel}</>}{required.length > 0 && <> · {usingProfile ? 'profil Anda' : `${required.length} kebutuhan`}</>}</>
          )}
        </p>
        {required.length > 0 && <p className="font-sub text-sm text-ink-secondary">Urutan: {sortText}.</p>}
      </div>
      )}
      {/* Catatan privasi dipindah ke dalam tombol sebagai teks bantuan, bukan paragraf
          tersendiri: di HP paragraf itu satu blok penuh yang menyela antara daftar dan
          hasil pertama, padahal isinya penjelasan untuk tombol di sebelahnya. */}
      {!geo.location && (
        <Button
          variant="secondary"
          size="sm"
          onClick={locateMe}
          loading={geo.status === 'loading'}
          aria-describedby="catatan-lokasi"
          className="w-full sm:w-auto"
        >
          <LocateFixed aria-hidden="true" size={15} /> Aktifkan lokasi untuk urutkan jarak
          <span id="catatan-lokasi" className="sr-only">Lokasi hanya disimpan sementara di peramban Anda, tidak dikirim ke server.</span>
        </Button>
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
              {/* Dulu tombol ini memfokuskan #explore-search. Kolom itu pindah ke navbar
                  bersama CommandBar, jadi tombolnya diam saja saat diklik. Diganti aksi
                  yang memang bisa dikerjakan dari sini. */}
              {params.category && <Button variant="secondary" onClick={() => goExplore({ category: '' })}>Lihat semua kategori</Button>}
              <LinkButton to="/facilities/new">Usulkan fasilitas</LinkButton>
            </>
          )}
        >
          {COVERAGE_NOTE}
        </EmptyState>
      )}

      {/* key berganti saat filter berubah supaya animasi masuk terputar ulang —
          tanpa itu ia hanya main sekali seumur halaman. */}
      <ul key={filtersKey} className="ak-stagger space-y-2.5">
        {items.map(({ facility, level, distance }, i) => (
          <li key={facility.id} style={{ '--i': i }}>
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
      geoStatus={geo.status} geoError={geo.error} compact={false}
      onUseMyLocation={routeUseMyLocation} onStartPick={routeStartPick} onChooseFacility={routeChooseFacility}
      onRetry={() => route.origin && buildRoute(route.origin)} onClose={closeRoute}
    />
  ) : null;

  const detail = id && (
    <FacilityDetailPanel
      id={id} required={required} usingProfile={usingProfile}
      distance={results.find((f) => String(f.id) === id)?.distance_m ?? null}
      onBack={() => navigate({ pathname: '/map', search: buildExplore({ ...params, route: false }) })}
      onStartRoute={() => startRoute(id)} onEditNeeds={() => setFilterOpen(true)} onLoaded={onDetailLoaded}
      awal={results.find((x) => String(x.id) === String(id)) ?? loaded ?? null}
      routeSlot={routeSummary}
    />
  );

  // Gerbang panel hasil di ponsel. needsRaw, bukan required: kebutuhan yang datang
  // diam-diam dari profil pengguna yang login bukan tindakan mencari.
  const sheetTerlihat = !!(params.q || params.category || params.needsRaw || id);

  const petaShell = (
    <>
      <MapView
        ref={mapRef} items={items} selectedId={id ?? previewId} onSelect={onMarkerSelect}
        userLocation={geo.location} origin={routeHere ? route.origin : null} routeGeometry={routeHere ? route.data?.geometry ?? null : null} routeSegmen={routeHere ? route.data?.segmen ?? null : null}
        pickingOrigin={routeHere && route.picking} onPickOrigin={routePicked} focus={focus}
        onError={(e) => { if ([401, 403].includes(e?.error?.status)) setMapProblem(true); }}
        gaya={gayaPeta}
        jalurTerlihat={jalurTerlihat} onJalurTerlaluJauh={setJalurTerlaluJauh} onJalurRingkas={setRingkasJalur}
        jangkauan={jangkauanQ.data ?? null} modeJangkauan={modeJangkauan} onPickJangkauan={setTitikJangkauan}
        fitPaddingBottom={isDesktop ? 70 : (sheetTerlihat ? 380 : 90)}
        fitPaddingLeft={isDesktop ? 430 : 60}
      />

      {/* Sejak panel hasil di ponsel baru muncul saat mencari, pertanyaan kebutuhan
          ikut hilang dari layar pertama — padahal tanpa kebutuhan terpilih semua marker
          berwarna sama dan aplikasi ini tidak punya apa pun untuk dikatakan. Jadi di
          ponsel ia naik ke atas peta sebagai kartu mengambang di tepi bawah, bukan
          baris pertama sebuah daftar yang belum ada. */}
      {!isDesktop && !sheetTerlihat && !jalurTerlihat && !modeJangkauan && required.length === 0 && (
        <div className="absolute inset-x-3 bottom-4 z-30">
          <NeedsPrompt
            ringkas
            sisakanTombol={false}
            onApply={(codes) => { goExplore(needsPatch(codes), { keepDetail: true }); toast.show(`${codes.length} kebutuhan diterapkan.`, 'info'); }}
            onOpenFilter={() => setFilterOpen(true)}
          />
        </div>
      )}

      {/* Dipicu oleh bukti ketertarikan, bukan oleh waktu: satu fasilitas dibuka, atau
          kebutuhan dipilih. Tombol masuk di navbar halaman peta sengaja dihapus. */}
      {!session && <AjakanMasuk aktif={(!!id || required.length > 0) && (isDesktop || (!routeHere && !modeJangkauan))} />}

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()} onZoomOut={() => mapRef.current?.zoomOut()}
        onLocate={locateMe} locating={geo.status === 'loading'}
        gaya={gayaPeta} onGantiGaya={gantiGayaPeta}
        jalur={jalurTerlihat} onGantiJalur={gantiJalur} ringkasJalur={ringkasJalur}
        modeJangkauan={modeJangkauan} onGantiJangkauan={gantiModeJangkauan}
      />

      {modeJangkauan && !titikJangkauan && (
        <div role="status" className="absolute left-3 right-[4.25rem] top-[7.5rem] z-30 flex items-center justify-between gap-2 rounded-control bg-ink px-4 py-2 font-semibold text-white shadow-popover lg:left-1/2 lg:right-auto lg:top-32 lg:-translate-x-1/2">
          Ketuk peta untuk menghitung jangkauan
          <button type="button" onClick={() => gantiModeJangkauan(false)} className="min-h-11 px-2 underline">Batal</button>
        </div>
      )}

      {modeJangkauan && titikJangkauan && (
        <PanelJangkauan
          data={jangkauanQ.data}
          memuat={jangkauanQ.isFetching}
          galat={jangkauanQ.error?.message ?? null}
          menit={menitJangkauan}
          onGantiMenit={setMenitJangkauan}
          onTutup={tutupJangkauan}
        />
      )}

      {/* Lapisannya menyala tapi petanya terlalu jauh untuk menggambar apa pun —
          tanpa pesan ini tombolnya tampak rusak. */}
      {jalurTerlihat && jalurTerlaluJauh && (
        <p role="status" className="absolute inset-x-3 bottom-4 z-30 mx-auto max-w-sm rounded-control bg-ink/90 px-3 py-2 text-center text-sm font-semibold text-white lg:bottom-auto lg:left-1/2 lg:top-[7.5rem] lg:w-fit lg:-translate-x-1/2">
          Perbesar peta untuk melihat jalur pejalan kaki
        </p>
      )}

      {mapProblem && (
        <div className="absolute inset-x-3 top-32 z-30 mx-auto max-w-md">
          <Alert tone="danger">Peta tidak dapat dimuat (token tidak valid). Daftar hasil tetap bisa dipakai.</Alert>
        </div>
      )}
      {routeHere && route.picking && (
        <div role="status" className="absolute left-3 right-[4.25rem] top-[7.5rem] z-30 flex items-center justify-between gap-2 rounded-control bg-ink px-4 py-2 font-semibold text-white shadow-popover lg:left-1/2 lg:right-auto lg:top-32 lg:-translate-x-1/2">
          Klik peta untuk menentukan titik awal
          <button type="button" onClick={routeStartPick} className="min-h-11 px-2 underline">Batal</button>
        </div>
      )}

      {/* Layar lebar: kartu mengambang. HP: panel bawah yang bisa ditarik — kartu yang
          bisa digeser-geser tidak masuk akal di layar selebar telapak tangan, dan panel
          bawah sudah jadi pola yang dikenal di sana. Keduanya menampilkan isi yang sama. */}
      {isDesktop ? (
        heroTerlihat && (
          <FloatingCard
            key={id ? 'detail' : 'hasil'}
            id={id ? 'detail' : 'hasil'}
            label={id ? (loaded?.name ?? 'Detail fasilitas') : `${loadingList ? 'Memuat' : results.length} fasilitas${required.length ? ` · ${usingProfile ? 'profil Anda' : `${required.length} kebutuhan`}` : ''}`}
            // 88 px: tepat di bawah navbar. Dulu 184 px karena ada bilah perintah dan
            // baris kategori di atasnya; keduanya sudah pindah ke navbar, jadi angka
            // lama menyisakan satu jalur kosong selebar kartu.
            posisiAwal={{ x: 12, y: 88 }}
            lebar={id ? 25 : 24}
            onClose={id ? () => navigate({ pathname: '/map', search: location.search }) : null}
          >
            {id ? detail : listContent}
          </FloatingCard>
        )
      ) : (
        /* Seperti Gmaps: di ponsel peta yang pertama terlihat, bukan daftarnya. Panel
           hasil baru ada begitu pengguna benar-benar mencari sesuatu — kata kunci,
           kategori, kebutuhan yang dipilih sendiri, atau satu tempat yang dibuka.
           Tanpa gerbang ini panel setengah layar menutupi peta sejak detik pertama,
           dan hero di beranda praktis jadi daftar, bukan peta. */
        sheetTerlihat && (
        <BottomSheet
          ref={sheetRef}
          // Daftar hasil dibuka setengah layar; panel yang hanya mengikuti kebutuhan
          // tersimpan cukup mengintip supaya peta tetap jadi isi utamanya.
          awalIdx={params.q || params.category || id ? 1 : 0}
          label={id ? 'Detail fasilitas' : 'Hasil pencarian'}
          ringkasan={
            <p role="status" className="truncate text-center text-sm font-semibold">
              {id ? (loaded?.name ?? 'Detail fasilitas') : `${results.length} fasilitas${required.length ? ` · ${required.length} kebutuhan` : ''}`}
            </p>
          }
        >
          {id ? detail : listContent}
        </BottomSheet>
        )
      )}
    </>
  );

  const filterSheet = (
    <FilterSheet
      open={filterOpen} onClose={() => setFilterOpen(false)} required={required} session={session} profile={profile}
      onApply={(codes) => { goExplore(needsPatch(codes), { keepDetail: true }); toast.show(codes.length ? `${codes.length} kebutuhan diterapkan.` : 'Filter kebutuhan dihapus.', 'info'); }}
    />
  );

  // /map dan /facilities/:id: kerangka aplikasi penuh, tidak menggulir.
  if (!halamanDepan) {
    return (
      <div className="relative h-full">
        <h1 className="sr-only">Jelajahi fasilitas aksesibel</h1>
        {petaShell}
        {filterSheet}
      </div>
    );
  }

  // "/": peta jadi hero setinggi satu layar, lalu halaman berlanjut ke penjelasannya.
  return (
    <>
      {/* Peta dimasukkan ke dalam kotak bersudut besar dengan margin halaman, persis
          seperti foto hero pada acuan — bukan dibiarkan menempel ke keempat tepi layar.
          Navbar mengambang di atasnya. */}
      <div ref={heroRef} className="h-[100dvh] p-3">
        <div className="relative h-full overflow-hidden rounded-[1.75rem]">
          <h1 className="sr-only">Jelajahi fasilitas aksesibel</h1>
          {petaShell}
        </div>
      </div>

      <LandingSections />
      {filterSheet}
    </>
  );
}
