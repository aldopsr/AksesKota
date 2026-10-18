import { useState } from 'react';
import { Bus, Crosshair, LocateFixed, MapPin, Route as RouteIcon, X } from 'lucide-react';
import { Alert, Button, IconButton, SelectField, Skeleton } from '../../components/ui';
import { formatDistance, formatDuration } from '../../lib/geo';

// Ringkasan rute jalan kaki (IA 5.4). Mewakili 5 keadaan: butuh titik awal, memuat, berhasil, gagal.
// Rute ini DASAR: belum memakai data kondisi jalan, hanya atribut fasilitas tujuan yang diketahui.
function DaftarTransport({ judul, daftar, radius }) {
  return (
    <div>
      <p className="text-sm font-semibold">{judul}</p>
      {daftar.length === 0 ? (
        <p className="font-sub mt-0.5 text-sm text-ink-secondary">
          Belum ada fasilitas transportasi terdata dalam {Math.round(radius / 1000)} km dari titik ini.
        </p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {daftar.map((t) => (
            <li key={t.id} className="text-sm">
              <span className="font-semibold">{t.name}</span>{' '}
              <span className="font-sub text-ink-secondary tabular-nums">{t.jarak_m} m</span>
              <span className="font-sub block text-ink-secondary">
                {t.tersedia.length
                  ? `✓ ${t.tersedia.join(', ')}`
                  : 'Data aksesibilitas tempat ini belum ada.'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Nama yang dipakai orang, bukan nilai tag OSM. "train" tidak berarti apa-apa
// bagi pengguna; "KRL" langsung dikenali.
const MODA = {
  train: { label: 'KRL', warna: '#ec2329' },
  subway: { label: 'MRT', warna: '#0066b3' },
  light_rail: { label: 'LRT', warna: '#e5462f' },
  bus: { label: 'Transjakarta', warna: '#cf2127' },
};

/** Satu pemberhentian pada diagram lin: titik, nama, jarak jalan kaki, aksesibilitas. */
function Perhentian({ peran, stop, warna }) {
  return (
    <li className="relative pl-6">
      <span
        aria-hidden="true"
        className="absolute left-0 top-1 size-3.5 rounded-full border-[3px] border-surface"
        style={{ backgroundColor: warna, boxShadow: `0 0 0 2px ${warna}` }}
      />
      <p className="text-sm">
        <span className="font-sub text-ink-secondary">{peran} </span>
        <strong className="font-semibold">{stop.nama}</strong>
        <span className="font-sub text-ink-secondary"> · {formatDistance(stop.jarak_m)} jalan kaki</span>
      </p>
      <p className="font-sub text-sm text-ink-secondary">
        {stop.tersedia.length ? (
          <>
            <span aria-hidden="true">✓ </span>
            <span className="sr-only">Tersedia: </span>
            {stop.tersedia.join(', ')}
          </>
        ) : (
          'Data aksesibilitas tempat ini belum ada.'
        )}
      </p>
    </li>
  );
}

/**
 * Satu pilihan perjalanan, digambar sebagai diagram lin: garis vertikal berwarna
 * resmi linnya dengan titik di tiap perhentian. Bentuk ini dipilih karena sudah
 * dikenal dari peta transit mana pun — pengguna tidak perlu membaca untuk mengerti
 * mana yang naik, mana yang turun, dan di mana harus berganti.
 */
function OpsiLin({ opsi, j }) {
  const m = MODA[opsi.moda] ?? { label: opsi.operator ?? 'Transportasi umum' };
  const warna = opsi.warna ?? m.warna ?? 'var(--color-brand-800)';
  const lanjut = opsi.ganti && (MODA[opsi.ganti.moda] ?? {});
  return (
    <li style={{ '--j': j }} className="rounded-card border border-border bg-surface-subtle p-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
        <span
          className="rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: warna }}
        >
          {m.label}
        </span>
        {opsi.lin}
      </p>

      {/* Garis penghubung antar titik: dekoratif, maknanya sudah ada di teks.
          Dipasang di pembungkus, bukan di dalam <ul>, karena <ul> hanya boleh berisi <li>. */}
      <div className="relative mt-2.5">
        <span aria-hidden="true" className="absolute bottom-2 left-[6px] top-2 w-0.5 rounded-full opacity-35" style={{ backgroundColor: warna }} />
        <ul className="space-y-2.5">
        <Perhentian peran="Naik dari" stop={opsi.naik} warna={warna} />
        {opsi.ganti && (
          <li className="relative pl-6">
            <span aria-hidden="true" className="absolute left-0 top-1 flex size-3.5 items-center justify-center rounded-full border-[3px] border-surface bg-ink-secondary" />
            <p className="text-sm">
              <span className="font-sub text-ink-secondary">Ganti di </span>
              <strong className="font-semibold">{opsi.ganti.nama}</strong>
            </p>
            <p className="font-sub text-sm text-ink-secondary">
              Lanjut naik {lanjut.label ? `${lanjut.label} ` : ''}{opsi.ganti.lin}
            </p>
          </li>
        )}
        <Perhentian peran="Turun di" stop={opsi.turun} warna={opsi.ganti ? (opsi.ganti.warna ?? warna) : warna} />
        </ul>
      </div>

      {opsi.jumlah_berhenti > 0 && (
        <p className="font-sub mt-2 text-xs text-ink-secondary tabular-nums">{opsi.jumlah_berhenti} pemberhentian</p>
      )}
    </li>
  );
}

function SaranTransportasi({ saran }) {
  return (
    <section aria-label="Saran transportasi umum" className="rounded-card border border-border bg-surface p-3">
      {/* saran.alasan mengulang jarak dan waktu yang sudah tercetak besar tepat di
          atasnya, dengan pembulatan yang berbeda pula ("55 km" lalu "54.6 km").
          Kalimat itu tetap dikirim backend untuk dipakai asisten AI, yang tidak
          punya konteks di atasnya; di sini cukup alasannya saja. */}
      <p className="flex items-start gap-2 text-sm font-semibold">
        <Bus aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-brand-800" />
        Terlalu jauh untuk berjalan kaki. Pertimbangkan transportasi umum:
      </p>

      {saran.lin?.length > 0 ? (
        <ul className="ak-chips mt-3 space-y-2">
          {saran.lin.map((o, j) => (
            <OpsiLin key={`${o.lin}-${o.naik.nama}-${o.turun.nama}`} opsi={o} j={j} />
          ))}
        </ul>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DaftarTransport judul="Terdekat dari Anda" daftar={saran.dekat_anda ?? []} radius={saran.radius_cari_m} />
          <DaftarTransport judul="Terdekat dari tujuan" daftar={saran.dekat_tujuan ?? []} radius={saran.radius_cari_m} />
        </div>
      )}

      <p className="font-sub mt-3 text-xs text-ink-secondary">{saran.catatan}</p>
    </section>
  );
}

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
          {/* Yang dinilai adalah JALURNYA, bukan fasilitas tujuan. Teks lama menulis
              "skor aksesibilitas tujuan" dan menyatakan kondisi trotoar belum tercakup —
              keduanya tidak lagi benar sejak penilaian memakai data jaringan pejalan kaki. */}
          <p className="text-sm">
            Aksesibilitas jalur:{' '}
            <strong>
              {data.accessibility_score === null
                ? 'data jalur belum cukup untuk dinilai'
                : `${data.accessibility_score}% · skor rute ${data.route_score}`}
            </strong>
            {data.accessibility_score !== null && (
              <span className="font-sub text-ink-secondary"> (70% aksesibilitas jalur, 30% jarak)</span>
            )}
          </p>
          {data.coverage !== undefined && (
            <p className="font-sub text-sm text-ink-secondary">
              Data jalur mencakup {Math.round(data.coverage * 100)}% panjang rute
              {data.hambatan?.ruas_tangga > 0 && (
                <strong className="font-semibold text-danger"> · terdeteksi {data.hambatan.ruas_tangga} ruas tangga</strong>
              )}
            </p>
          )}

          {/* Jarak jauh: rute jalan kaki 8 jam bukan saran yang jujur. Kami tidak
              merencanakan perjalanan transportasi umum — hanya menunjukkan fasilitas
              transportasi terdekat beserta data aksesibilitas yang kami punya. */}
          {data.saran_transportasi && (
            <SaranTransportasi saran={data.saran_transportasi} />
          )}

          <p className="font-sub text-sm text-ink-secondary">
            Kondisi lapangan dapat berubah. Tidak ada jaminan rute sepenuhnya bebas hambatan.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Ubah titik awal</Button>
        </div>
      )}
    </section>
  );
}
