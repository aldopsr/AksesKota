import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'motion/react';
import { Accessibility, Check, Eye, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_HINT, ATTRIBUTE_LABEL, NEEDS_PRESETS } from '../features/accessibility/constants';
import { belumBisaDinilai, levelFor } from '../features/accessibility/match';
import { MatchBadge } from '../components/status';
import { useToast } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/layout/PageShell';
import { Alert, Button, LinkButton, Skeleton } from '../components/ui';

/**
 * Profil aksesibilitas.
 *
 * Versi sebelumnya sepuluh kotak centang dalam tiga kelompok, lalu tombol Simpan.
 * Benar secara fungsi, tapi tidak pernah menunjukkan AKIBAT dari pilihan itu —
 * pengguna mencentang empat kotak dan tidak punya alasan untuk percaya ada yang
 * berubah. Halaman ini sekarang menjawabnya langsung: preset satu ketukan di atas,
 * dan pratinjau hasil nyata dari database yang ikut berubah setiap kali pilihan
 * diubah. Itu juga yang membuat aturan "belum diketahui tidak pernah dihitung
 * tersedia" terlihat, bukan sekadar dijanjikan lewat paragraf.
 */

const IKON_PRESET = { kursi_roda: Accessibility, netra: Eye };
const sama = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Satu kebutuhan: kartu yang bisa diketuk. Checkbox aslinya tetap ada untuk pembaca layar. */
function KartuKebutuhan({ code, dipilih, onToggle, j }) {
  return (
    <label
      style={{ '--j': j }}
      className="flex min-h-14 cursor-pointer items-start gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:border-brand-400 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
    >
      <input type="checkbox" checked={dipilih} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-control border-2 transition-colors ${
          dipilih ? 'border-brand-700 bg-brand-700 text-white' : 'border-border-strong'
        }`}
      >
        {dipilih && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{ATTRIBUTE_LABEL[code]}</span>
        <span className="font-sub mt-0.5 block text-sm text-ink-secondary">{ATTRIBUTE_HINT[code]}</span>
      </span>
    </label>
  );
}

/**
 * Pratinjau: hasil sungguhan dari database, bukan contoh karangan.
 *
 * Permintaan ditunda sejenak setelah ketukan terakhir — tanpa itu, memilih empat
 * kebutuhan berarti empat permintaan yang tiga di antaranya langsung basi.
 */
function Pratinjau({ codes }) {
  const [tertunda, setTertunda] = useState(codes);
  useEffect(() => {
    const t = setTimeout(() => setTertunda(codes), 350);
    return () => clearTimeout(t);
  }, [codes]);

  const kunci = tertunda.join(',');
  const { data, isFetching } = useQuery({
    queryKey: ['preview-profile', kunci],
    queryFn: () => api('/facilities', { params: { needs: kunci, limit: 3 } }),
    enabled: tertunda.length > 0,
    placeholderData: (sebelumnya) => sebelumnya,
  });

  return (
    <section aria-labelledby="pratinjau-judul" className="rounded-panel border border-border bg-surface-subtle p-4">
      <h2 id="pratinjau-judul" className="text-sm font-bold uppercase tracking-wide text-ink-secondary">
        Pratinjau hasil
      </h2>
      {codes.length === 0 ? (
        <p className="font-sub mt-2 text-sm text-ink-secondary">
          Pilih kebutuhan untuk melihat bagaimana fasilitas dinilai untuk Anda.
        </p>
      ) : (
        <>
          <p className="font-sub mt-1 text-sm text-ink-secondary">
            Tiga fasilitas paling cocok dengan {codes.length} kebutuhan ini.
          </p>
          <ul className="mt-3 space-y-2" aria-busy={isFetching}>
            {(data?.results ?? []).map((f) => (
              <li key={f.id} className="rounded-card border border-border bg-surface p-3">
                <p className="truncate font-semibold leading-snug">{f.name}</p>
                <div className="mt-1.5">
                  <MatchBadge level={levelFor(f)} percent={belumBisaDinilai(f) ? null : f.match_pct} />
                </div>
              </li>
            ))}
            {data && data.results.length === 0 && (
              <li className="font-sub text-sm text-ink-secondary">
                Belum ada fasilitas terdata yang cocok dengan kombinasi ini.
              </li>
            )}
            {!data && isFetching && [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-20 w-full" /></li>)}
          </ul>
          <p className="font-sub mt-3 text-xs text-ink-secondary">
            Atribut yang belum diketahui tidak pernah dihitung tersedia, jadi angka di atas tidak
            akan pernah lebih tinggi daripada yang benar-benar terdata.
          </p>
        </>
      )}
    </section>
  );
}

export default function ProfilePage() {
  useDocumentTitle('Profil aksesibilitas');
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ['my-profile'], queryFn: () => api('/me/accessibility-profile') });
  const saved = data?.attributes ?? [];
  const [selected, setSelected] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => { if (data) setSelected(data.attributes); }, [data]);

  const dirty = !sama(selected, saved);
  const save = useMutation({
    mutationFn: () => api('/me/accessibility-profile', { method: 'PUT', body: { attributes: selected } }),
    onSuccess: (res) => { qc.setQueryData(['my-profile'], res); setJustSaved(true); toast.show('Profil aksesibilitas tersimpan.'); },
  });
  const ubah = (next) => { setJustSaved(false); setSelected(next); };
  const toggle = (c) => ubah(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);

  return (
    <PageShell
      title="Profil aksesibilitas"
      subtitle="Pilih yang Anda butuhkan sekali. Setelah itu hasil pencarian, kartu, dan warna penanda peta dinilai dari kebutuhan Anda, bukan dari rata-rata semua orang."
      breadcrumb={[{ label: 'Beranda', to: '/' }, { label: 'Profil aksesibilitas' }]}
    >
      {isLoading && <div className="space-y-3" aria-label="Memuat profil" role="status"><Skeleton className="h-40 w-full" /><Skeleton className="h-28 w-full" /></div>}
      {error && <Alert tone="danger">{error.message}</Alert>}

        {/* Tiga anak grid, bukan satu kolom kiri yang utuh: urutannya harus BERBEDA di
            dua lebar layar. Di ponsel pratinjau duduk tepat di bawah preset — itu satu-
            satunya tempat ia masih terlihat sedetik setelah pilihan diketuk, dan alasan
            pratinjau ini ada memang untuk menunjukkan akibatnya. Mulai lg ia pindah ke
            kolom kanan dan menempel, sementara preset dan daftar atribut kembali menyatu
            di kolom kiri. Dibuat dengan penempatan baris/kolom, bukan dengan merender
            komponennya dua kali: salinan kedua berarti permintaan kedua ke server. */}
      {data && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-8">
          <div className="lg:col-start-1 lg:row-start-1">
            {/* Jalur umum dulu: sebagian besar orang terwakili salah satu dari dua preset
                ini, dan menyusunnya sendiri butuh empat ketukan. */}
            <section aria-labelledby="preset-judul">
              <h2 id="preset-judul" className="mb-2 text-lg font-semibold">Mulai cepat</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {NEEDS_PRESETS.map(({ key, label, icon, codes }) => {
                  const Icon = IKON_PRESET[icon];
                  const aktif = sama(selected, codes);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => ubah(aktif ? [] : codes)}
                      aria-pressed={aktif}
                      className={`flex min-h-14 items-center gap-3 rounded-card border p-3 text-left transition-colors ${
                        aktif ? 'border-brand-700 bg-brand-50' : 'border-border bg-surface hover:border-brand-400'
                      }`}
                    >
                      <Icon aria-hidden="true" size={22} className="shrink-0 text-brand-700" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug">{label}</span>
                        <span className="font-sub mt-0.5 block text-xs text-ink-muted">
                          {codes.map((c) => ATTRIBUTE_LABEL[c]).join(', ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Di ponsel: tepat setelah preset. Mulai lg: kolom kanan, menempel, menjangkau
              dua baris kiri supaya ia ikut terlihat selama daftar atribut digulir. */}
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-20 lg:self-start">
            <Pratinjau codes={selected} />
          </div>

          <div className="space-y-6 lg:col-start-1 lg:row-start-2">
            {ATTRIBUTE_GROUPS.map((g) => (
              <fieldset key={g.key}>
                <legend className="mb-2 text-lg font-semibold">{g.label}</legend>
                <div className="ak-chips grid gap-2 sm:grid-cols-2">
                  {g.codes.map((code, j) => (
                    <KartuKebutuhan key={code} code={code} j={j} dipilih={selected.includes(code)} onToggle={() => toggle(code)} />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="sticky bottom-16 z-10 md:bottom-0 -mx-4 lg:row-start-3 border-t border-border bg-canvas/95 px-4 py-3 backdrop-blur lg:col-span-2 lg:mx-0 lg:rounded-card lg:border">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p role="status" className="font-sub text-sm text-ink-secondary">
                <strong className="font-semibold text-ink">{selected.length}</strong> kebutuhan dipilih
                {dirty && <span className="font-semibold text-warning"> · belum disimpan</span>}
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {dirty && (
                  <Button variant="ghost" size="sm" onClick={() => ubah(saved)}>
                    <RotateCcw aria-hidden="true" size={15} /> Urungkan
                  </Button>
                )}
                <Button type="submit" loading={save.isPending} disabled={!dirty}>Simpan</Button>
              </div>
            </div>
            {save.error && <Alert tone="danger" className="mt-2">{save.error.message}</Alert>}
            {justSaved && !dirty && (
              <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} className="mt-3">
                <LinkButton to="/map" variant="secondary">Jelajahi peta dengan profil ini</LinkButton>
              </m.div>
            )}
          </div>
        </form>
      )}
    </PageShell>
  );
}
