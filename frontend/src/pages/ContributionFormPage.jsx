import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LocateFixed } from 'lucide-react';
import { api } from '../lib/api';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABEL, CATEGORIES, CATEGORY_CODES, CATEGORY_LABEL, CORE_CODES, STATUS } from '../features/accessibility/constants';
import { normalizeFacility } from '../features/accessibility/match';
import { summarizePayload } from '../features/contribute/summary';
import { ID_BOUNDS } from '../lib/geo';
import { useLocationState, useToast } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PageShell from '../components/layout/PageShell';
import { AttributeStatus } from '../components/status';
import { Alert, Button, LinkButton, SelectField, Skeleton, Stepper, TextArea, TextField } from '../components/ui';
import LocationPicker from '../features/contribute/LocationPicker';
import PhotoUpload from '../features/contribute/PhotoUpload';
import PlaceSearch from '../features/contribute/PlaceSearch';

const STEPS = ['Informasi', 'Lokasi', 'Atribut', 'Foto dan catatan', 'Tinjau dan kirim'];
const DRAFT_KEY = 'ak_draft_new_facility';

const coord = (label, min, max) => z.string().trim().min(1, `Isi ${label}.`).transform(Number)
  .pipe(z.number({ invalid_type_error: `${label} harus berupa angka.` }).min(min, `${label} di luar wilayah Indonesia.`).max(max, `${label} di luar wilayah Indonesia.`));
const schema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(120, 'Nama maksimal 120 karakter.'),
  category: z.enum(CATEGORY_CODES, { errorMap: () => ({ message: 'Pilih kategori fasilitas.' }) }),
  address: z.string().trim().min(5, 'Alamat minimal 5 karakter.').max(255, 'Alamat maksimal 255 karakter.'),
  description: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter.').optional(),
  lat: coord('Latitude', ID_BOUNDS.latMin, ID_BOUNDS.latMax),
  lng: coord('Longitude', ID_BOUNDS.lngMin, ID_BOUNDS.lngMax),
  attrs: z.record(z.enum(['available', 'not_available', 'unknown'])),
  notes: z.record(z.string().max(300, 'Catatan maksimal 300 karakter.')).optional(),
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter.').optional(),
});
const STEP_FIELDS = [['name', 'category', 'address', 'description'], ['lat', 'lng'], [], ['note'], []];
const ALL_CODES = ATTRIBUTE_GROUPS.flatMap((g) => g.codes);

function defaultsFrom(f) {
  const by = Object.fromEntries((f?.attributes ?? []).map((a) => [a.code, a]));
  return {
    name: f?.name ?? '', category: f?.category ?? '', address: f?.address ?? '', description: f?.description ?? '',
    lat: f ? String(f.lat) : '', lng: f ? String(f.lon) : '',
    attrs: Object.fromEntries(ALL_CODES.map((c) => [c, by[c]?.status ?? 'unknown'])),
    notes: Object.fromEntries(ALL_CODES.map((c) => [c, by[c]?.notes ?? ''])),
    note: '',
  };
}
function loadDraft() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } }

function Wizard({ mode, facility }) {
  const isUpdate = mode === 'update';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const geo = useLocationState();
  const headingRef = useRef(null);
  const draft = !isUpdate ? loadDraft() : null;
  const [restored, setRestored] = useState(!!draft);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const { register, handleSubmit, watch, setValue, getValues, trigger, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema), defaultValues: draft ?? defaultsFrom(facility),
  });
  const values = watch();

  // draf teks tersimpan di sesi (foto tidak ikut tersimpan)
  useEffect(() => { if (!isUpdate && isDirty && !submitted) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch { /* abaikan */ } } }, [values, isDirty, isUpdate, submitted]);
  useEffect(() => {
    const warn = (e) => { if ((isDirty || photos.length) && !submitted) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, photos.length, submitted]);
  useEffect(() => { headingRef.current?.focus(); window.scrollTo({ top: 0 }); }, [step, submitted]);

  const pendingQ = useQuery({ queryKey: ['my-contributions'], queryFn: () => api('/me/contributions'), enabled: isUpdate });
  const hasPending = isUpdate && (pendingQ.data ?? []).some((c) => String(c.facility_id) === String(facility.id) && c.status === 'pending');

  /* ---------- susun payload sesuai kontrak backend ---------- */
  const built = useMemo(() => {
    const v = values;
    const original = Object.fromEntries((facility?.attributes ?? []).map((a) => [a.code, a]));
    const attrs = ALL_CODES.map((code) => ({ code, status: v.attrs?.[code] ?? 'unknown', notes: v.notes?.[code]?.trim() || null }));
    const changedAttrs = isUpdate
      ? attrs.filter((a) => { const o = original[a.code]; return a.status !== (o?.status ?? 'unknown') || a.notes !== (o?.notes ?? null); })
      : attrs.filter((a) => a.status !== 'unknown' || a.notes);
    const info = { name: (v.name ?? '').trim(), category: v.category, address: (v.address ?? '').trim(), description: (v.description ?? '').trim(), lat: Number(v.lat), lon: Number(v.lng) };
    let part = info;
    if (isUpdate) {
      part = {};
      ['name', 'category', 'address'].forEach((k) => { if (info[k] !== facility[k]) part[k] = info[k]; });
      if (info.description !== (facility.description ?? '')) part.description = info.description;
      if (info.lat !== facility.lat || info.lon !== facility.lon) { part.lat = info.lat; part.lon = info.lon; }
    }
    const infoChanged = !isUpdate || Object.keys(part).length > 0;
    const payload = {};
    if (isUpdate) payload.facility_id = facility.id;
    if (infoChanged) payload.facility = part;
    if (changedAttrs.length) payload.attributes = changedAttrs;
    if (v.note?.trim()) payload.note = v.note.trim();
    const needsPhoto = changedAttrs.some((a) => CORE_CODES.has(a.code) && a.status !== 'unknown');
    const noChange = isUpdate && !infoChanged && changedAttrs.length === 0 && photos.length === 0;
    return { payload, changedAttrs, needsPhoto, noChange, original };
  }, [values, facility, isUpdate, photos.length]);

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('payload', JSON.stringify(built.payload));
      photos.forEach((f) => fd.append('photos', f));
      return api('/contributions', { method: 'POST', formData: fd });
    },
    onSuccess: (res) => {
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ }
      qc.invalidateQueries({ queryKey: ['my-contributions'] });
      setSubmitted(res);
    },
  });

  async function next() {
    setFormError('');
    if (STEP_FIELDS[step].length && !(await trigger(STEP_FIELDS[step]))) return;
    if (step === 3 && built.needsPhoto && photos.length === 0) { setFormError('Lampirkan minimal 1 foto sebagai bukti atribut aksesibilitas utama yang Anda isi.'); return; }
    setStep((s) => s + 1);
  }
  function finish() {
    setFormError('');
    if (built.noChange) { setFormError('Belum ada perubahan. Ubah data atau tambahkan foto sebelum mengirim.'); return; }
    if (built.needsPhoto && photos.length === 0) { setFormError('Lampirkan minimal 1 foto bukti.'); setStep(3); return; }
    submit.mutate();
  }
  const setPoint = (la, ln) => { setValue('lat', la.toFixed(6), { shouldValidate: true, shouldDirty: true }); setValue('lng', ln.toFixed(6), { shouldValidate: true, shouldDirty: true }); };
  async function useMyLocation() { const loc = await geo.locate(); if (loc) setPoint(loc.lat, loc.lng); }

  /* ---------- layar sukses ---------- */
  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-panel border border-border bg-surface p-6 text-center shadow-panel sm:p-8">
        <CheckCircle2 aria-hidden="true" className="mx-auto text-success" size={44} />
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-bold outline-none">Kontribusi terkirim</h2>
        <p className="font-sub mt-2 text-ink-secondary">Usulan <strong className="text-ink">#{submitted.id}</strong> berstatus <strong className="text-ink">Menunggu verifikasi</strong>. Admin akan memeriksanya, dan data di peta berubah setelah disetujui.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LinkButton to={`/my-contributions?submitted=${submitted.id}`}>Lihat kontribusi saya</LinkButton>
          <LinkButton to="/map" variant="secondary">Kembali ke peta</LinkButton>
          {!isUpdate && <Button variant="ghost" onClick={() => { reset(defaultsFrom(null)); setPhotos([]); setStep(0); setSubmitted(null); }}>Tambah fasilitas lain</Button>}
        </div>
      </div>
    );
  }

  const lat = values.lat; const lng = values.lng;
  const was = (code) => STATUS[(facility?.attributes ?? []).find((a) => a.code === code)?.status ?? 'unknown'].label;

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={step} />
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">{STEPS[step]}</h2>

      {restored && step === 0 && <Alert tone="info" title="Draf dipulihkan" actions={<Button size="sm" variant="secondary" onClick={() => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ } reset(defaultsFrom(null)); setRestored(false); }}>Hapus draf</Button>}>Isian teks sebelumnya dipulihkan. Foto perlu dipilih ulang.</Alert>}
      {hasPending && step === 0 && <Alert tone="warning" title="Sudah ada usulan yang menunggu">Anda memiliki usulan untuk fasilitas ini yang belum diverifikasi. Anda tetap bisa mengirim usulan baru, tetapi admin akan meninjaunya satu per satu.</Alert>}

      {step === 0 && (
        <div className="space-y-4">
          {isUpdate && <p className="font-sub text-ink-secondary">Ubah hanya bagian yang perlu diperbarui. Data saat ini ditampilkan sebagai petunjuk di bawah tiap kolom.</p>}
          <TextField label="Nama fasilitas" requiredMark hint={isUpdate ? `Saat ini: ${facility.name}` : undefined} error={errors.name?.message} {...register('name')} />
          <SelectField label="Kategori" requiredMark hint={isUpdate ? `Saat ini: ${CATEGORY_LABEL[facility.category]}` : undefined} error={errors.category?.message} {...register('category')}>
            <option value="">Pilih kategori</option>
            {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.hint})</option>)}
          </SelectField>
          <TextField label="Alamat" requiredMark hint={isUpdate ? `Saat ini: ${facility.address}` : undefined} error={errors.address?.message} {...register('address')} />
          <TextArea label="Deskripsi singkat" rows={3} error={errors.description?.message} {...register('description')} />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="font-sub text-ink-secondary">Cari alamat atau nama tempat, atau klik peta untuk menaruh pin tepat di fasilitas.</p>
          <PlaceSearch onPick={(r) => { setPoint(r.lat, r.lon); if (!getValues('address')) setValue('address', r.address, { shouldDirty: true }); }} />
          <LocationPicker lat={lat} lng={lng} onChange={setPoint} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={useMyLocation} loading={geo.status === 'loading'}><LocateFixed aria-hidden="true" size={16} /> Gunakan lokasi saya</Button>
            {lat && lng && !errors.lat && !errors.lng && <p role="status" className="font-sub text-sm text-ink-secondary">Titik terpilih: <strong className="text-ink">{lat}, {lng}</strong></p>}
          </div>
          {geo.error && <p role="alert" className="text-sm font-semibold text-danger">{geo.error}</p>}
          <details open={!!(errors.lat || errors.lng)} className="rounded-card border border-border bg-surface p-3">
            <summary className="cursor-pointer font-semibold">Isi koordinat secara manual</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField label="Latitude" inputMode="decimal" placeholder="-6.595000" requiredMark error={errors.lat?.message} {...register('lat')} />
              <TextField label="Longitude" inputMode="decimal" placeholder="106.799000" requiredMark error={errors.lng?.message} {...register('lng')} />
            </div>
          </details>
          {isUpdate && <p className="font-sub text-sm text-ink-secondary">Lokasi saat ini: {facility.lat}, {facility.lon}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="font-sub text-ink-secondary">Isi hanya yang Anda yakini. Pilih <strong className="text-ink">Belum diketahui</strong> bila tidak yakin; atribut itu tidak akan dihitung tersedia. Atribut utama memerlukan foto bukti.</p>
          {ATTRIBUTE_GROUPS.map((g) => (
            <section key={g.key} aria-label={g.label} className="space-y-2">
              <h3 className="font-semibold">{g.label}</h3>
              {g.codes.map((code) => (
                <fieldset key={code} className="rounded-card border border-border bg-surface p-3">
                  <legend className="px-1 font-semibold">{ATTRIBUTE_LABEL[code]}{CORE_CODES.has(code) && <span className="ml-2 rounded-md bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-900">Butuh foto bukti</span>}</legend>
                  {isUpdate && <p className="font-sub mb-1 text-sm text-ink-secondary">Saat ini: {was(code)}</p>}
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS).map(([value, st]) => (
                      <label key={value} className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-border-strong px-3 font-semibold has-[:checked]:border-brand-700 has-[:checked]:bg-brand-100 has-[:checked]:text-brand-900 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
                        <input type="radio" value={value} className="sr-only" {...register(`attrs.${code}`)} />
                        <span aria-hidden="true">{st.symbol}</span> {st.label}
                      </label>
                    ))}
                  </div>
                  <TextField className="mt-2" label={`Catatan ${ATTRIBUTE_LABEL[code]} (opsional)`} error={errors.notes?.[code]?.message} {...register(`notes.${code}`)} />
                </fieldset>
              ))}
            </section>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-1 font-semibold">Foto bukti</h3>
            <PhotoUpload files={photos} onChange={setPhotos} hint={built.needsPhoto ? 'Wajib minimal 1 foto karena Anda mengisi atribut utama. Foto yang jelas mempercepat verifikasi.' : undefined} />
          </div>
          <TextArea label="Catatan untuk admin (opsional)" hint="Mis. kapan Anda memeriksa, atau alasan perubahan." error={errors.note?.message} {...register('note')} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="font-sub text-ink-secondary">{isUpdate ? 'Periksa perubahan Anda. Hanya bagian yang berubah yang akan dikirim.' : 'Periksa data sebelum mengirim.'}</p>
          {built.noChange ? <Alert tone="warning">Belum ada perubahan dari data saat ini.</Alert> : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full min-w-[26rem] text-left">
                <caption className="sr-only">Ringkasan usulan</caption>
                <thead className="bg-surface-subtle"><tr><th scope="col" className="p-3">Bidang</th>{isUpdate && <th scope="col" className="p-3">Sebelumnya</th>}<th scope="col" className="p-3">Usulan</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {summarizePayload(built.payload).map(([k, v]) => {
                    const prevInfo = { Nama: facility?.name, Kategori: CATEGORY_LABEL[facility?.category], Alamat: facility?.address, Deskripsi: facility?.description, Koordinat: facility && `${facility.lat}, ${facility.lon}` }[k];
                    const code = ALL_CODES.find((c) => ATTRIBUTE_LABEL[c] === k);
                    return (
                      <tr key={k}><th scope="row" className="p-3 font-semibold">{k}</th>{isUpdate && <td className="font-sub p-3 text-ink-secondary">{code ? was(code) : prevInfo || '-'}</td>}<td className="p-3 font-semibold">{v}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm"><strong>Foto:</strong> <span className="font-sub text-ink-secondary">{photos.length} dilampirkan</span>{values.note?.trim() && <> · <strong>Catatan:</strong> <span className="font-sub text-ink-secondary">{values.note.trim()}</span></>}</p>
          <Alert tone="info">Usulan Anda berstatus <strong>Menunggu verifikasi</strong> sampai admin menyetujuinya. Data resmi belum berubah sebelum itu.</Alert>
          <div className="flex flex-wrap gap-2">
            {STEPS.slice(0, 4).map((s, i) => <Button key={s} variant="ghost" size="sm" onClick={() => setStep(i)}>Ubah {s.toLowerCase()}</Button>)}
          </div>
        </div>
      )}

      {(formError || submit.error) && <Alert tone="danger">{formError || submit.error.message}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))}>{step === 0 ? 'Batal' : 'Kembali'}</Button>
        {step < STEPS.length - 1
          ? <Button onClick={next}>Lanjut</Button>
          : <Button onClick={finish} loading={submit.isPending}>{isUpdate ? 'Kirim usulan pembaruan' : 'Kirim fasilitas'}</Button>}
      </div>
    </div>
  );
}

export default function ContributionFormPage({ mode }) {
  const { id } = useParams();
  const isUpdate = mode === 'update';
  const { data: facility, isLoading, error } = useQuery({
    queryKey: ['facility', id, 'edit'], enabled: isUpdate, gcTime: 0,
    queryFn: async () => normalizeFacility(await api(`/facilities/${id}`, { params: { needs: 'none' } })),
  });
  useDocumentTitle(isUpdate ? 'Usulkan pembaruan fasilitas' : 'Tambah fasilitas');

  return (
    <PageShell
      title={isUpdate ? 'Usulkan pembaruan' : 'Tambah fasilitas'}
      subtitle={isUpdate ? (facility ? facility.name : 'Memuat data fasilitas…') : 'Bantu orang lain mengetahui aksesibilitas suatu tempat sebelum mereka berkunjung.'}
      breadcrumb={isUpdate ? [{ label: 'Jelajahi', to: '/map' }, { label: facility?.name ?? 'Fasilitas', to: `/facilities/${id}` }, { label: 'Usulkan pembaruan' }] : [{ label: 'Beranda', to: '/' }, { label: 'Tambah fasilitas' }]}
    >
      {isUpdate && isLoading && <div role="status" aria-label="Memuat data fasilitas" className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-40 w-full" /></div>}
      {isUpdate && error && (
        <div className="space-y-3"><Alert tone="danger">{error.status === 404 ? 'Fasilitas tidak ditemukan.' : error.message}</Alert><Link to="/map" className="font-semibold text-action-secondary underline underline-offset-4">Kembali ke peta</Link></div>
      )}
      {(!isUpdate || facility) && <Wizard key={facility?.id ?? 'new'} mode={mode} facility={facility} />}
    </PageShell>
  );
}
