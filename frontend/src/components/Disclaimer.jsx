import { Info } from 'lucide-react';
import { DISCLAIMER } from '../features/accessibility/constants';

export default function Disclaimer({ className = '' }) {
  return (
    <p role="note" className={`flex gap-2.5 rounded-xl border border-cobalt-100 bg-white p-3.5 text-sm text-slate-700 ${className}`}>
      <Info aria-hidden="true" className="mt-0.5 shrink-0 text-cobalt-600" size={18} />
      <span>{DISCLAIMER}</span>
    </p>
  );
}
