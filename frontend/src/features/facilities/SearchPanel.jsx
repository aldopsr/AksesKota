import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Search, UserRound, X } from 'lucide-react';
import { ATTRIBUTES, CATEGORIES, COVERAGE_NOTE } from '../accessibility/constants';
import { Alert, Button, inputClass } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export function SearchBar({ q, category, onSubmit }) {
  const [text, setText] = useState(q);
  const [cat, setCat] = useState(category);
  useEffect(() => setText(q), [q]);
  useEffect(() => setCat(category), [category]);

  return (
    <form
      role="search"
      aria-label="Cari fasilitas"
      onSubmit={(e) => { e.preventDefault(); onSubmit(text.trim(), cat); }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="q" className="mb-1 block font-bold">Cari nama, kategori, atau lokasi</label>
        <div className="flex items-center gap-2 rounded-2xl border border-cobalt-200 bg-white p-1.5 pl-4 focus-within:border-cobalt-600">
          <Search aria-hidden="true" className="shrink-0 text-cobalt-600" size={20} />
          <input
            id="q" type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Contoh: rumah sakit Depok"
            className="min-h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-slate-500 focus:outline-none"
          />
          <Button type="submit" className="shrink-0">Cari</Button>
        </div>
      </div>
      <div>
        <label htmlFor="cat" className="mb-1 block font-bold">Kategori</label>
        <select
          id="cat" value={cat}
          onChange={(e) => { setCat(e.target.value); onSubmit(text.trim(), e.target.value); }}
          className={inputClass(false)}
        >
          <option value="">Semua kategori</option>
          {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </div>
    </form>
  );
}

export function FilterPanel({ required, onChange, hasProfile, usingProfile, onToggleProfile }) {
  const { session } = useAuth();
  const toggle = (code) =>
    onChange(required.includes(code) ? required.filter((c) => c !== code) : [...required, code]);

  return (
    <fieldset className="rounded-2xl border border-cobalt-100 bg-white p-4">
      <legend className="px-2 font-display text-lg font-bold">Kebutuhan aksesibilitas Anda</legend>
      <p className="mb-3 text-sm text-slate-700">
        Hasil diurutkan menurut kecocokan dengan kebutuhan yang dipilih, lalu jarak.
      </p>

      {session ? (
        <button
          type="button"
          onClick={onToggleProfile}
          aria-pressed={usingProfile}
          disabled={!hasProfile}
          className={`mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold transition-colors disabled:opacity-60 ${usingProfile ? 'border-cobalt-700 bg-cobalt-50 text-cobalt-900' : 'border-cobalt-200 bg-white hover:bg-cobalt-50'}`}
        >
          <UserRound aria-hidden="true" size={18} />
          {usingProfile ? 'Memakai profil saya' : 'Pakai profil saya'}
        </button>
      ) : (
        <p className="mb-3 text-sm">
          <Link to="/login" className="font-bold text-cobalt-700 underline underline-offset-4">Masuk</Link> untuk menyimpan kebutuhan sebagai profil.
        </p>
      )}
      {session && !hasProfile && (
        <p className="mb-3 text-sm text-slate-700">
          Profil belum diisi. <Link to="/profile/accessibility" className="font-bold text-cobalt-700 underline underline-offset-4">Atur kebutuhan saya</Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {ATTRIBUTES.map((a) => (
          <label
            key={a.code}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-cobalt-200 bg-white px-4 font-bold transition-colors hover:bg-cobalt-50 has-[:checked]:border-cobalt-700 has-[:checked]:bg-cobalt-700 has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt-700"
          >
            <input type="checkbox" checked={required.includes(a.code)} onChange={() => toggle(a.code)} className="sr-only" />
            {required.includes(a.code) && <Check aria-hidden="true" size={16} />}
            {a.label}
          </label>
        ))}
      </div>
      {required.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="mt-3 inline-flex min-h-11 items-center gap-1 font-bold text-cobalt-700 underline underline-offset-4">
          <X aria-hidden="true" size={16} /> Hapus semua pilihan
        </button>
      )}
    </fieldset>
  );
}

export function CoverageNotice() {
  return <Alert tone="info" className="text-sm">{COVERAGE_NOTE}</Alert>;
}
