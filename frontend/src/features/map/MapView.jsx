import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { KeyRound } from 'lucide-react';
import { clearRoute, drawRoute } from './route';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (TOKEN) mapboxgl.accessToken = TOKEN;
export const mapAvailable = !!TOKEN;

function NoToken() {
  return (
    <div className="flex size-full items-center justify-center bg-surface-subtle p-6">
      <div className="max-w-md rounded-panel border border-border bg-surface p-5 shadow-panel">
        <p className="flex items-center gap-2 text-lg font-semibold"><KeyRound aria-hidden="true" size={20} /> Peta belum dapat ditampilkan</p>
        <p className="font-sub mt-2 text-ink-secondary">
          Token Mapbox belum diisi (<code className="rounded bg-surface-subtle px-1">VITE_MAPBOX_TOKEN</code> di <code className="rounded bg-surface-subtle px-1">.env.local</code>). Daftar hasil di samping tetap bisa dipakai.
        </p>
      </div>
    </div>
  );
}

function markerElement(facility, level, onSelect) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ak-marker';
  el.dataset.level = level.key; // bentuk marker ditentukan CSS per tingkat, bukan warna saja
  el.style.background = level.bg;
  el.setAttribute('aria-label', level.key === 'neutral' ? facility.name : `${facility.name}. ${level.label}`);
  const sym = document.createElement('span');
  sym.setAttribute('aria-hidden', 'true');
  sym.textContent = level.symbol;
  const label = document.createElement('span');
  label.className = 'ak-marker-label';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = level.key === 'neutral' ? facility.name : `${facility.name} - ${level.label}`;
  el.append(sym, label);
  el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(facility.id); });
  return el;
}

const MapCanvas = forwardRef(function MapCanvas({
  items, selectedId, onSelect, userLocation, origin, routeGeometry, pickingOrigin, onPickOrigin, focus, onError, fitPaddingBottom = 70,
}, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarker = useRef(null);
  const originMarker = useRef(null);
  const [ready, setReady] = useState(false);

  const live = useRef({});
  live.current = { onSelect, onPickOrigin, pickingOrigin, selectedId, onError };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 200 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 200 }),
    flyTo: ({ lng, lat, zoom = 14 }) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700 }),
  }));

  useEffect(() => {
    const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/streets-v12', center: [118, -2.5], zoom: 3.6 });
    map.on('load', () => setReady(true));
    map.on('error', (e) => live.current.onError?.(e));
    map.on('click', (e) => { if (live.current.pickingOrigin) live.current.onPickOrigin?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }); });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    mapRef.current = map;
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; markersRef.current = []; setReady(false); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((x) => x.marker.remove());
    markersRef.current = items.map(({ facility, level }) => {
      const el = markerElement(facility, level, (id) => live.current.onSelect(id));
      el.dataset.selected = String(String(facility.id) === String(live.current.selectedId));
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([facility.lon, facility.lat]).addTo(map);
      return { id: facility.id, el, marker };
    });
  }, [items]);

  useEffect(() => {
    markersRef.current.forEach((x) => {
      const terpilih = String(x.id) === String(selectedId);
      const baruTerpilih = terpilih && x.el.dataset.selected !== 'true';
      x.el.dataset.selected = String(terpilih);
      // Pantul sekali hanya pada transisi menjadi-terpilih, bukan di setiap render.
      //
      // Lepas-reflow-pasang, bukan menunggu `animationend`: kalau event itu tidak sempat
      // menyala (tab tersembunyi, halaman berhenti menggambar), kelasnya tertinggal dan
      // marker yang sama tidak akan pernah memantul lagi. Cara ini selalu memutar ulang.
      if (baruTerpilih) {
        x.el.classList.remove('ak-marker--pop');
        void x.el.offsetWidth; // paksa reflow supaya animasinya dihitung dari awal
        x.el.classList.add('ak-marker--pop');
      }
    });
  }, [selectedId, items]);

  const fitKey = items.map((i) => i.facility.id).join(',');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !items.length || live.current.selectedId) return;
    const b = new mapboxgl.LngLatBounds();
    items.forEach((i) => b.extend([i.facility.lon, i.facility.lat]));
    map.fitBounds(b, { padding: { top: 70, left: 60, right: 60, bottom: fitPaddingBottom }, maxZoom: 13, duration: 500 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'ak-user-dot';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Lokasi Anda');
      userMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    originMarker.current?.remove();
    originMarker.current = null;
    if (origin) {
      const el = document.createElement('div');
      el.className = 'ak-origin';
      el.textContent = 'A';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Titik awal rute');
      originMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map);
    }
  }, [origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!routeGeometry) { clearRoute(map); return; }
    drawRoute(map, routeGeometry);
    const b = new mapboxgl.LngLatBounds();
    routeGeometry.coordinates.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: { top: 80, left: 60, right: 60, bottom: 140 }, duration: 600 });
  }, [routeGeometry, ready]);

  useEffect(() => { const map = mapRef.current; if (map) map.getCanvas().style.cursor = pickingOrigin ? 'crosshair' : ''; }, [pickingOrigin]);
  useEffect(() => { const map = mapRef.current; if (map && focus) map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 14, duration: 600 }); }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} role="region" aria-label="Peta fasilitas. Daftar hasil menyediakan informasi yang sama untuk pengguna keyboard dan pembaca layar." className="size-full" />;
});

const MapView = forwardRef(function MapView(props, ref) {
  if (!TOKEN) return <NoToken />;
  return <MapCanvas ref={ref} {...props} />;
});
export default MapView;
