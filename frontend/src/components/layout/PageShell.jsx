import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Kerangka halaman dalam: breadcrumb (opsional) + judul + konten. Tanpa dekorasi.
export default function PageShell({ title, subtitle, actions, breadcrumb, width = 'max-w-3xl', children }) {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className={`mx-auto px-4 py-6 sm:py-8 ${width}`}>
          {breadcrumb && (
            <nav aria-label="Breadcrumb" className="mb-3">
              <ol className="flex flex-wrap items-center gap-1 text-sm font-semibold text-ink-secondary">
                {breadcrumb.map((b, i) => (
                  <li key={b.label} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight aria-hidden="true" size={14} />}
                    {b.to ? <Link to={b.to} className="underline-offset-4 hover:text-brand-800 hover:underline">{b.label}</Link> : <span aria-current="page" className="text-ink">{b.label}</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
              {subtitle && <p className="font-sub mt-2 text-lg text-ink-secondary">{subtitle}</p>}
            </div>
            {actions}
          </div>
        </div>
      </div>
      <div className={`mx-auto px-4 py-6 sm:py-8 ${width}`}>{children}</div>
    </>
  );
}
