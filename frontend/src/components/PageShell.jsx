// Kerangka halaman dalam: judul sederhana + konten.
export default function PageShell({ title, subtitle, actions, width = 'max-w-3xl', children }) {
  return (
    <>
      <div className="border-b border-cobalt-100 bg-linear-to-b from-cobalt-50 to-white">
        <div className={`mx-auto flex flex-wrap items-end justify-between gap-4 px-4 py-8 sm:py-10 ${width}`}>
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 text-lg text-slate-700">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </div>
      <div className={`mx-auto px-4 py-8 sm:py-10 ${width}`}>{children}</div>
    </>
  );
}
