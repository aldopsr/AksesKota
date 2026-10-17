import { useCallback, useState } from 'react';

// Lokasi hanya disimpan di state (memori). TIDAK ditulis ke localStorage/server (PRD 5 & 19.1).
export function useGeolocation() {
  const [location, setLocation] = useState(null); // { lng, lat }
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [error, setError] = useState('');

  const locate = useCallback(
    () => new Promise((resolve) => {
      if (!navigator.geolocation) {
        setStatus('error');
        setError('Peramban Anda tidak mendukung lokasi.');
        resolve(null);
        return;
      }
      setStatus('loading');
      setError('');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lng: pos.coords.longitude, lon: pos.coords.longitude, lat: pos.coords.latitude };
          setLocation(loc);
          setStatus('ok');
          resolve(loc);
        },
        (err) => {
          setStatus('error');
          setError(
            err.code === 1
              ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan peramban.'
              : 'Lokasi Anda tidak dapat ditemukan.',
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    }),
    [],
  );

  return { location, status, error, locate };
}
