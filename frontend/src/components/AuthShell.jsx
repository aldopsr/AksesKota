import { m } from 'motion/react';
import { LogoMark } from './Layout';

// Halaman login/daftar: satu kartu di tengah, tanpa dekorasi.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-linear-to-b from-cobalt-50 to-white px-4 py-10">
      <m.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <LogoMark size={44} />
        <h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-slate-700">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <p className="mt-5">{footer}</p>}
      </m.div>
    </div>
  );
}
