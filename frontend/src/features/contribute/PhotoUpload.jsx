import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { PHOTO_RULES } from '../accessibility/constants';
import { validatePhoto } from '../../lib/format';

export default function PhotoUpload({ files, onChange, hint }) {
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function onPick(e) {
    const picked = [...e.target.files];
    e.target.value = '';
    const errors = [];
    const ok = [];
    picked.forEach((f) => { const err = validatePhoto(f, PHOTO_RULES); if (err) errors.push(err); else ok.push(f); });
    if (files.length + ok.length > PHOTO_RULES.maxFiles) errors.push(`Maksimal ${PHOTO_RULES.maxFiles} foto.`);
    setError(errors.join(' '));
    onChange([...files, ...ok].slice(0, PHOTO_RULES.maxFiles));
  }

  return (
    <div>
      <p id="photo-hint" className="font-sub mb-2 text-sm text-ink-secondary">{hint ?? `JPG, PNG, atau WebP, maksimal ${PHOTO_RULES.maxMB} MB per foto, sampai ${PHOTO_RULES.maxFiles} foto.`}</p>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-surface px-4 font-semibold hover:bg-surface-subtle has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
        <ImagePlus aria-hidden="true" size={18} /> Pilih foto
        <input type="file" multiple accept={PHOTO_RULES.types.join(',')} onChange={onPick} aria-describedby="photo-hint" className="sr-only" />
      </label>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="overflow-hidden rounded-card border border-border bg-surface">
              <img src={previews[i]} alt={`Pratinjau foto ${i + 1}: ${f.name}`} className="aspect-[4/3] w-full object-cover" />
              <button type="button" onClick={() => onChange(files.filter((_, k) => k !== i))} className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold text-danger hover:bg-danger-bg">
                <Trash2 aria-hidden="true" size={15} /> Hapus foto {i + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
