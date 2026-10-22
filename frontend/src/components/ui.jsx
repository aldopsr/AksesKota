import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'motion/react';
import { ChevronDown, Check, Eye, EyeOff, Info, Link2, Loader2, Search, TriangleAlert, X, XCircle, CheckCircle2 } from 'lucide-react';

/* ============ Button ============ */
const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-[var(--motion-fast)] active:scale-[.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-ink-secondary';
const sizes = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-4 text-base', lg: 'min-h-12 px-5 text-base' };
const variants = {
  primary: 'bg-action-primary text-ink-inverse hover:bg-action-primary-hover',
  secondary: 'border border-border-strong bg-surface text-ink hover:bg-surface-subtle',
  ghost: 'text-ink hover:bg-surface-subtle',
  danger: 'bg-danger text-ink-inverse hover:bg-[#7f1d1d]',
  link: 'min-h-0 px-0 text-action-secondary underline underline-offset-4 hover:text-brand-900 active:scale-100',
};
export const buttonClass = (variant = 'primary', size = 'md', extra = '') => `${base} ${variant === 'link' ? '' : sizes[size]} ${variants[variant]} ${extra}`;

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 aria-hidden="true" className={`animate-spin ${className}`} size={size} />;
}

/**
 * Menyalin alamat halaman saat ini.
 *
 * Alamat itu sendiri yang membawa hasilnya — titik jangkauan, menit, titik awal rute,
 * gaya peta, lapisan — jadi yang dibagikan bukan "aplikasinya", melainkan temuan ini.
 * Tanpa tombol ini fiturnya tetap ada tapi tak terlihat: tidak ada yang menyalin URL
 * dari bilah alamat di ponsel.
 *
 * execCommand sudah usang tapi tetap dipasang: navigator.clipboard hanya hidup di
 * konteks aman, dan menguji di ponsel lewat alamat IP jaringan lokal (http://192.168…)
 * bukan konteks aman. Tombol salin yang diam-diam tidak melakukan apa pun lebih buruk
 * daripada satu API usang.
 */
export function SalinTautan({ className = '', variant = 'secondary', size = 'md' }) {
  const [tersalin, setTersalin] = useState(false);
  useEffect(() => {
    if (!tersalin) return undefined;
    const t = setTimeout(() => setTersalin(false), 2200);
    return () => clearTimeout(t);
  }, [tersalin]);

  async function salin() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setTersalin(true);
      return;
    } catch { /* konteks tidak aman atau izin ditolak — coba cara lama */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setTersalin(true);
    } catch { /* menyerah tanpa berpura-pura berhasil */ }
  }

  return (
    <Button variant={variant} size={size} onClick={salin} className={className}>
      {tersalin ? <Check aria-hidden="true" size={16} /> : <Link2 aria-hidden="true" size={16} />}
      {tersalin ? 'Tautan tersalin' : 'Salin tautan'}
      {/* Perubahan label saja tidak terdengar pembaca layar kalau fokus tetap di tombol. */}
      <span role="status" className="sr-only">{tersalin ? 'Tautan hasil tersalin ke papan klip.' : ''}</span>
    </Button>
  );
}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', loading = false, children, disabled, ...rest }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', size = 'md', className = '', children, ...rest }) {
  return <Link to={to} className={buttonClass(variant, size, className)} {...rest}>{children}</Link>;
}

// Tombol ikon: wajib punya nama aksesibel (label), target 44x44
export const IconButton = forwardRef(function IconButton({ label, children, className = '', variant = 'secondary', ...rest }, ref) {
  const v = variant === 'ghost' ? 'text-ink hover:bg-surface-subtle' : 'border border-border-strong bg-surface text-ink hover:bg-surface-subtle';
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-control transition-colors ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
});

/* ============ Chip ============ */
export function Chip({ pressed = false, onClick, children, className = '' }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={pressed}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${pressed ? 'border-brand-700 bg-brand-700 text-ink-inverse' : 'border-border-strong bg-surface text-ink hover:bg-surface-subtle'} ${className}`}
    >
      {pressed && <Check aria-hidden="true" size={14} />}
      {children}
    </button>
  );
}

// min-h-11 pada chip dan size-11 pada tombol silangnya: keduanya dulu 36 dan 32 px,
// di bawah ambang 44 px yang dipakai seluruh aplikasi ini. Silang kecil di dalam chip
// kecil adalah sasaran tersulit di seluruh antarmuka — dan ini aplikasi aksesibilitas.
export function RemovableChip({ label, onRemove }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-0.5 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-3.5 pr-0.5 text-sm font-semibold text-brand-900">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Hapus filter ${label}`} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-brand-100">
        <X aria-hidden="true" size={15} />
      </button>
    </span>
  );
}

/* ============ Feedback ============ */
const tones = {
  info: { cls: 'border-info bg-info-bg text-info', Icon: Info },
  success: { cls: 'border-success bg-success-bg text-success', Icon: CheckCircle2 },
  warning: { cls: 'border-warning bg-warning-bg text-warning', Icon: TriangleAlert },
  danger: { cls: 'border-danger bg-danger-bg text-danger', Icon: XCircle },
};
export function Alert({ tone = 'info', title, children, className = '', actions }) {
  const { cls, Icon } = tones[tone === 'error' ? 'danger' : tone];
  return (
    <div role={tone === 'danger' || tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-card border-l-4 p-3.5 ${cls} ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
      <div className="min-w-0 flex-1 text-ink">
        {title && <p className="font-semibold">{title}</p>}
        <div className="font-sub">{children}</div>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Badge({ className = '', children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${className}`}>{children}</span>;
}

export function LoadingBlock({ label = 'Memuat…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-8 font-semibold text-ink-secondary">
      <Spinner size={20} /> {label}
    </div>
  );
}

export const Skeleton = ({ className = '' }) => <div aria-hidden="true" className={`animate-pulse rounded-control bg-surface-subtle ${className}`} />;

export function EmptyState({ title, children, actions, icon: Icon }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong bg-surface p-6 text-center">
      {Icon && <Icon aria-hidden="true" className="mx-auto mb-2 text-brand-700" size={28} />}
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="font-sub mx-auto mt-1 max-w-md text-ink-secondary">{children}</div>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/* ============ Form ============ */
const inputBase = 'block w-full min-h-11 rounded-control border bg-surface px-3.5 py-2 text-base text-ink placeholder:text-ink-muted transition-colors';
export const inputClass = (error) => `${inputBase} ${error ? 'border-danger' : 'border-border-strong hover:border-brand-400 focus:border-brand-800'}`;

function Shell({ id, label, hint, error, requiredMark, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
        {requiredMark && <><span aria-hidden="true" className="text-danger"> *</span><span className="sr-only"> (wajib diisi)</span></>}
      </label>
      {hint && <p id={`${id}-h`} className="font-sub mb-1 text-sm text-ink-secondary">{hint}</p>}
      {children}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
const describe = (id, hint, error) => [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;

export const TextField = forwardRef(function TextField({ label, hint, error, requiredMark, className, ...rest }, ref) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} requiredMark={requiredMark} className={className}>
      <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={describe(id, hint, error)} className={inputClass(error)} {...rest} />
    </Shell>
  );
});

export const PasswordField = forwardRef(function PasswordField({ label, hint, error, requiredMark, className, ...rest }, ref) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Shell id={id} label={label} hint={hint} error={error} requiredMark={requiredMark} className={className}>
      <div className="relative">
        <input ref={ref} id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={describe(id, hint, error)} className={`${inputClass(error)} pr-12`} {...rest} />
        <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-subtle">
          {show ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </div>
    </Shell>
  );
});

export const TextArea = forwardRef(function TextArea({ label, hint, error, requiredMark, className, rows = 4, ...rest }, ref) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} requiredMark={requiredMark} className={className}>
      <textarea ref={ref} id={id} rows={rows} aria-invalid={!!error} aria-describedby={describe(id, hint, error)} className={inputClass(error)} {...rest} />
    </Shell>
  );
});

export const SelectField = forwardRef(function SelectField({ label, hint, error, requiredMark, className, children, ...rest }, ref) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} requiredMark={requiredMark} className={className}>
      <select ref={ref} id={id} aria-invalid={!!error} aria-describedby={describe(id, hint, error)} className={inputClass(error)} {...rest}>{children}</select>
    </Shell>
  );
});

// Kolom pencarian: label permanen (boleh disembunyikan secara visual), tombol hapus, Enter untuk kirim
export function SearchInput({ id, label = 'Cari fasilitas', value, onChange, onSubmit, onClear, placeholder, submitLabel, className = '' }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <form role="search" aria-label={label} onSubmit={(e) => { e.preventDefault(); onSubmit?.(value); }} className={className}>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <div className="flex items-center gap-1 rounded-control border border-border-strong bg-surface pl-3 focus-within:border-brand-800 focus-within:ring-2 focus-within:ring-brand-200">
        <Search aria-hidden="true" className="shrink-0 text-ink-secondary" size={20} />
        <input
          id={inputId} type="text" inputMode="search" enterKeyHint="search" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} autoComplete="off"
          className="min-h-11 min-w-0 flex-1 bg-transparent px-1.5 text-base text-ink placeholder:text-ink-muted focus:outline-none"
        />
        {value && (
          <button type="button" onClick={() => { onChange(''); onClear?.(); }} aria-label="Hapus pencarian" className="inline-flex size-10 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-subtle">
            <X aria-hidden="true" size={18} />
          </button>
        )}
        {submitLabel && <button type="submit" className={buttonClass('primary', 'md', 'm-0.5 shrink-0')}>{submitLabel}</button>}
      </div>
    </form>
  );
}

/* ============ Dialog / Bottom sheet (elemen <dialog> native: fokus dikelola browser) ============ */
export function Modal({ open, onClose, title, children, footer, variant = 'dialog', size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const width = size === 'lg' ? 'sm:max-w-2xl' : '';
  return (
    <dialog
      ref={ref} aria-labelledby={titleId} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`${variant === 'sheet' ? 'ak-sheet' : ''} m-auto overflow-hidden rounded-panel border-0 bg-surface p-0 text-ink shadow-dialog ${width}`}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
            <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
            <IconButton label="Tutup dialog" variant="ghost" onClick={onClose} className="-mr-2 -mt-1"><X aria-hidden="true" size={20} /></IconButton>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/* ============ Tabs (pola WAI-ARIA, navigasi panah) ============ */
export const tabId = (group, key) => `${group}-tab-${key}`;
export const panelId = (group, key) => `${group}-panel-${key}`;
export function Tabs({ group, label, tabs, value, onChange, className = '' }) {
  const refs = useRef({});
  function onKeyDown(e, i) {
    const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = tabs[(keys[e.key] + tabs.length) % tabs.length];
    onChange(next.key);
    refs.current[next.key]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className={`flex flex-wrap gap-1 border-b border-border no-scrollbar sm:flex-nowrap sm:overflow-x-auto ${className}`}>
      {tabs.map((t, i) => {
        const on = t.key === value;
        return (
          <button
            key={t.key} ref={(el) => { refs.current[t.key] = el; }} type="button" role="tab" id={tabId(group, t.key)}
            aria-selected={on} aria-controls={panelId(group, t.key)} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)} onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 font-semibold transition-colors ${on ? 'border-brand-700 text-brand-900' : 'border-transparent text-ink-secondary hover:text-ink'}`}
          >
            {t.label}
            {t.count !== undefined && <span className={`rounded-full px-2 text-sm ${on ? 'bg-brand-100 text-brand-900' : 'bg-surface-subtle text-ink-secondary'}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ============ Menu popover (disclosure) ============ */
// chevron: popup pencarian memakai mesin yang sama (klik di luar, Escape, fokus balik)
// tapi tidak boleh memakai panah bawah — pada pil pencarian itu membacanya seperti
// daftar pilihan, bukan kolom isian.
export function Menu({ label, icon: Icon, children, align = 'right', buttonClassName = '', chevron = true, lebar = 'min-w-56' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btn = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button ref={btn} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className={buttonClassName || buttonClass('ghost')}>
        {Icon && <Icon aria-hidden="true" size={18} />}{label}
        {chevron && <ChevronDown aria-hidden="true" size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <m.div
          id={id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14 }}
          onClick={(e) => { if (e.target.closest('a,[data-close]')) setOpen(false); }}
          className={`absolute z-40 mt-1 rounded-card border border-border bg-surface p-1.5 shadow-popover ${lebar} ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </m.div>
      )}
    </div>
  );
}
export const menuItemClass = 'flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left font-medium text-ink hover:bg-surface-subtle';

/* ============ Stepper ============ */
export function Stepper({ steps, current }) {
  return (
    <nav aria-label="Langkah pengisian">
      <p className="font-sub mb-2 text-sm text-ink-secondary" aria-live="polite">Langkah {current + 1} dari {steps.length}: <strong className="font-semibold text-ink">{steps[current]}</strong></p>
      <ol className="flex gap-1.5">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? 'step' : undefined} className={`h-1.5 flex-1 rounded-full ${i < current ? 'bg-brand-700' : i === current ? 'bg-brand-500' : 'bg-border'}`}>
            <span className="sr-only">{s}{i < current ? ' (selesai)' : i === current ? ' (sedang diisi)' : ''}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const cardClass = 'rounded-card border border-border bg-surface';
