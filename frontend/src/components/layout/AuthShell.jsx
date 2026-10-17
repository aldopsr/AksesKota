import { m } from 'motion/react';
import { LogoMark } from './Brand';

// Login/daftar: satu kartu di tengah. Judul jelas, alasan login (bila dipicu aksi), tautan silang.
export default function AuthShell({ title, subtitle, notice, children, footer }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center bg-canvas px-4 py-10 sm:items-center sm:py-14">
      <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} className="w-full max-w-md">
        <LogoMark size={44} />
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="font-sub mt-2 text-lg text-ink-secondary">{subtitle}</p>}
        {notice && <div className="mt-4">{notice}</div>}
        <div className="mt-6 rounded-panel border border-border bg-surface p-5 shadow-panel sm:p-6">{children}</div>
        {footer && <p className="mt-5 text-center">{footer}</p>}
      </m.div>
    </div>
  );
}
