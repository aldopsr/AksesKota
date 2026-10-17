import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (TOKEN) mapboxgl.accessToken = TOKEN;

// Klik peta atau seret pin untuk menentukan titik. Kolom koordinat adalah alternatif keyboard.
export default function LocationPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!TOKEN) return undefined;
    const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/streets-v12', center: [118, -2.5], zoom: 3.6 });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (e) => onChangeRef.current(e.lngLat.lat, e.lngLat.lng));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const la = Number(lat);
    const ln = Number(lng);
    if (!map || lat === '' || lng === '' || Number.isNaN(la) || Number.isNaN(ln)) return;
    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ draggable: true, color: '#4f46e5' }).setLngLat([ln, la]).addTo(map);
      marker.on('dragend', () => { const p = marker.getLngLat(); onChangeRef.current(p.lat, p.lng); });
      markerRef.current = marker;
      map.flyTo({ center: [ln, la], zoom: Math.max(map.getZoom(), 15) });
    } else {
      markerRef.current.setLngLat([ln, la]);
      map.easeTo({ center: [ln, la] });
    }
  }, [lat, lng]);

  if (!TOKEN) {
    return <p className="font-sub rounded-card border border-warning bg-warning-bg p-3 text-sm text-warning">Peta pemilih lokasi memerlukan <code>VITE_MAPBOX_TOKEN</code>. Isi koordinat secara manual di bawah.</p>;
  }
  return <div ref={containerRef} role="region" aria-label="Peta untuk menentukan titik lokasi. Klik peta atau seret pin; alternatifnya isi koordinat." className="h-72 w-full overflow-hidden rounded-card border border-border-strong" />;
}
