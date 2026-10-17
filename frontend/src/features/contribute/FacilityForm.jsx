import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LocateFixed } from 'lucide-react';
import { ATTRIBUTES, CATEGORIES, CATEGORY_CODES, CORE_CODES, STATUS } from '../accessibility/constants';
import { ID_BOUNDS } from '../../lib/geo';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Alert, Button, SelectField, TextArea, TextField } from '../../components/ui';
import LocationPicker from './LocationPicker';
import PhotoUpload from './PhotoUpload';

const coord = (label, min, max) =>
  z.string().trim().min(1, `Isi ${label}.`)
    .transform(Number)
    .pipe(z.number({ invalid_type_error: `${label} harus berupa angka.` })
      .min(min, `${label} di luar wilayah Indonesia.`).max(max, `${label} di luar wilayah Indonesia.`));

const schema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(120, 'Nama maksimal 120 karakter.'),
  category: z.enum(CATEGORY_CODES, { errorMap: () => ({ message: 'Pilih kategori fasilitas.' }) }),
  address: z.string().trim().min(5, 'Alamat minimal 5 karakter.').max(255, 'Alamat maksimal 255 karakter.'),
  description: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter.').optional(),
  lat: coord('Latitude', ID_BOUNDS.latMin, ID_BOUNDS.latMax),
  lng: coord('Longitude', ID_BOUNDS.lngMin, ID_BOUNDS.lngMax),
  attrs: z.record(z.enum(['available', 'not_available', 'unknown'])),
  notes: z.record(z.string().max(300, 'Catatan maksimal 300 karakter.')).optional(),
});

function defaultsFrom(facility) {
  const byCode = Object.fromEntries((facility?.attributes ?? []).map((a) => [a.code, a]));
  return {
    name: facility?.name ?? '',
    category: facility?.category ?? '',
    address: facility?.address ?? '',
    description: facility?.description ?? '',
    lat: facility ? String(facility.lat) : '',
    lng: facility ? String(facility.lon) : '',
    attrs: Object.fromEntries(ATTRIBUTES.map((a) => [a.code, byCode[a.code]?.status ?? 'unknown'])),
    notes: Object.fromEntries(ATTRIBUTES.map((a) => [a.code, byCode[a.code]?.notes ?? ''])),
  };
}

// mode: 'create' | 'update'. onSubmit menerima FormData siap kirim ke POST /contributions.
export default function FacilityForm({ mode, facility, onSubmit, submitting, serverError }) {
  const isUpdate = mode === 'update';
  const [photos, setPhotos] = useState([]);
  const [formError, setFormError] = useState('');
  const geo = useGeolocation();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultsFrom(facility),
  });

  const setPoint = (lat, lng) => {
    setValue('lat', lat.toFixed(6), { shouldValidate: true });
    setValue('lng', lng.toFixed(6), { shouldValidate: true });
  };
  async function useMyLocation() {
    const loc = await geo.locate();
    if (loc) setPoint(loc.lat, loc.lng);
  }

  // Susun payload sesuai kontrak backend: POST /api/contributions (multipart: payload + photos)
  function build(values) {
    setFormError('');
    const original = Object.fromEntries((facility?.attributes ?? []).map((a) => [a.code, a]));
    const attrs = ATTRIBUTES.map((a) => ({
      code: a.code,
      status: values.attrs[a.code] ?? 'unknown',
      notes: values.notes?.[a.code]?.trim() || null,
    }));
    const changedAttrs = isUpdate
      ? attrs.filter((a) => {
        const o = original[a.code];
        return a.status !== (o?.status ?? 'unknown') || a.notes !== (o?.notes ?? null);
      })
      : attrs.filter((a) => a.status !== 'unknown' || a.notes);

    const info = {
      name: values.name.trim(),
      category: values.category,
      address: values.address.trim(),
      description: (values.description ?? '').trim(),
      lat: values.lat,
      lon: values.lng,
    };
    let facilityPart = info;
    if (isUpdate) {
      facilityPart = {};
      ['name', 'category', 'address'].forEach((k) => { if (info[k] !== facility[k]) facilityPart[k] = info[k]; });
      if (info.description !== (facility.description ?? '')) facilityPart.description = info.description;
      if (info.lat !== facility.lat || info.lon !== facility.lon) { facilityPart.lat = info.lat; facilityPart.lon = info.lon; }
    }
    const infoChanged = !isUpdate || Object.keys(facilityPart).length > 0;

    if (isUpdate && !infoChanged && changedAttrs.length === 0 && photos.length === 0) {
      setFormError('Belum ada perubahan. Ubah data atau tambahkan foto sebelum mengirim.');
      return;
    }
    // FR-08: foto bukti wajib bila mengisi/mengubah atribut utama
    if (changedAttrs.some((a) => CORE_CODES.has(a.code) && a.status !== 'unknown') && photos.length === 0) {
      setFormError('Lampirkan minimal 1 foto sebagai bukti atribut aksesibilitas utama yang Anda isi.');
      return;
    }

    const payload = {};
    if (isUpdate) payload.facility_id = facility.id;
    if (infoChanged) payload.facility = facilityPart;
    if (changedAttrs.length) payload.attributes = changedAttrs;

    const fd = new FormData();
    fd.append('payload', JSON.stringify(payload));
    photos.forEach((f) => fd.append('photos', f));
    onSubmit(fd);
  }

  const lat = watch('lat');
  const lng = watch('lng');

  return (
    <form onSubmit={handleSubmit(build)} noValidate className="space-y-8">
      {isUpdate && (
        <Alert tone="info">Hanya perubahan yang Anda buat yang akan dikirim. Admin akan memverifikasinya sebelum tampil di peta.</Alert>
      )}

      <section aria-labelledby="sec-info" className="space-y-4 rounded-2xl border border-cobalt-100 bg-white p-5">
        <h2 id="sec-info" className="text-xl font-bold">Informasi fasilitas</h2>
        <TextField label="Nama fasilitas" requiredMark error={errors.name?.message} {...register('name')} />
        <SelectField label="Kategori" requiredMark error={errors.category?.message} {...register('category')}>
          <option value="">Pilih kategori</option>
          {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.hint})</option>)}
        </SelectField>
        <TextField label="Alamat" requiredMark error={errors.address?.message} {...register('address')} />
        <TextArea label="Deskripsi singkat" rows={3} error={errors.description?.message} {...register('description')} />
      </section>

      <section aria-labelledby="sec-loc" className="space-y-4 rounded-2xl border border-cobalt-100 bg-white p-5">
        <h2 id="sec-loc" className="text-xl font-bold">Lokasi</h2>
        <p className="text-slate-700">Klik peta atau seret pin untuk menentukan titik. Anda juga dapat mengisi koordinat secara manual atau memakai lokasi Anda saat ini.</p>
        <LocationPicker lat={lat} lng={lng} onChange={setPoint} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Latitude" inputMode="decimal" placeholder="-6.402500" requiredMark error={errors.lat?.message} {...register('lat')} />
          <TextField label="Longitude" inputMode="decimal" placeholder="106.818600" requiredMark error={errors.lng?.message} {...register('lng')} />
        </div>
        <div>
          <Button variant="light" onClick={useMyLocation} loading={geo.status === 'loading'}>
            <LocateFixed aria-hidden="true" size={18} /> Gunakan lokasi saya
          </Button>
          {geo.error && <p role="alert" className="mt-1 text-sm font-bold text-red-700">{geo.error}</p>}
        </div>
      </section>

      <section aria-labelledby="sec-acc" className="space-y-4 rounded-2xl border border-cobalt-100 bg-white p-5">
        <h2 id="sec-acc" className="text-xl font-bold">Atribut aksesibilitas</h2>
        <p className="text-slate-700">
          Isi hanya yang Anda yakini. Pilih <strong>Belum diketahui</strong> bila tidak yakin; atribut tersebut tidak akan dihitung tersedia.
        </p>
        <div className="space-y-3">
          {ATTRIBUTES.map((a) => (
            <fieldset key={a.code} className="rounded-2xl border border-cobalt-100 p-3">
              <legend className="px-1 font-bold">{a.label}</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS).map(([value, st]) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-cobalt-200 px-3 has-[:checked]:border-cobalt-700 has-[:checked]:bg-cobalt-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt-700"
                  >
                    <input type="radio" value={value} className="sr-only" {...register(`attrs.${a.code}`)} />
                    <span aria-hidden="true" className="font-bold">{st.symbol}</span> {st.label}
                  </label>
                ))}
              </div>
              <TextField
                className="mt-2" label={`Catatan ${a.label} (opsional)`}
                error={errors.notes?.[a.code]?.message} {...register(`notes.${a.code}`)}
              />
            </fieldset>
          ))}
        </div>
      </section>

      <section aria-labelledby="sec-photo" className="space-y-3 rounded-2xl border border-cobalt-100 bg-white p-5">
        <h2 id="sec-photo" className="text-xl font-bold">Foto</h2>
        <PhotoUpload
          files={photos} onChange={setPhotos} label="Foto bukti"
          hint="Wajib minimal 1 foto bila Anda mengisi atribut aksesibilitas. Foto yang jelas mempercepat verifikasi."
        />
      </section>

      {(formError || serverError) && <Alert tone="error">{formError || serverError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>{isUpdate ? 'Kirim perubahan' : 'Kirim fasilitas'}</Button>
      </div>
      <p className="text-sm text-slate-700">Kontribusi berstatus <strong>Menunggu verifikasi</strong> sampai admin menyetujuinya.</p>
    </form>
  );
}
