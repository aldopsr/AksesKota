import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { geocodingAvailable, searchPlaces } from '../../lib/geocode';
import { Alert, Button, inputClass } from '../../components/ui';

// Metode utama menentukan lokasi: cari alamat/nama tempat, lalu pilih hasilnya (IA 5.8)
export default function PlaceSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(e) {
    e.preventDefault();
    if (q.trim().length < 3) { setError('Ketik minimal 3 karakter.'); return; }
    setLoading(true); setError('');
    try { setResults(await searchPlaces(q.trim())); } catch (err) { setError(err.message); setResults(null); } finally { setLoading(false); }
  }

  if (!geocodingAvailable) return null;
  return (
    <div className="space-y-2">
      <form onSubmit={search} role="search" aria-label="Cari alamat atau nama tempat">
        <label htmlFor="place-q" className="mb-1 block font-semibold">Cari alamat atau nama tempat</label>
        <div className="flex gap-2">
          <input id="place-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Contoh: Stasiun Bogor" className={inputClass(false)} autoComplete="off" />
          <Button type="submit" variant="secondary" loading={loading} className="shrink-0">
            <Search aria-hidden="true" size={16} /> Cari<span className="max-sm:sr-only"> lokasi</span>
          </Button>
        </div>
      </form>
      {error && <Alert tone="danger" className="text-sm">{error}</Alert>}
      {results && results.length === 0 && <p role="status" className="font-sub text-sm text-ink-secondary">Tidak ada lokasi yang cocok. Coba kata kunci lain atau klik peta.</p>}
      {results && results.length > 0 && (
        <ul aria-label="Hasil pencarian lokasi" className="divide-y divide-border rounded-card border border-border bg-surface">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => { onPick(r); setResults(null); }} className="flex min-h-12 w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-subtle">
                <MapPin aria-hidden="true" className="mt-1 shrink-0 text-brand-700" size={16} />
                <span><span className="block font-semibold">{r.name}</span><span className="font-sub block text-sm text-ink-secondary">{r.address}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
