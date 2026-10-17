import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';

/* ---------- Lokasi pengguna (hanya di memori, tidak disimpan permanen) ---------- */
const LocationCtx = createContext(null);
export const useLocationState = () => useContext(LocationCtx);
export function LocationProvider({ children }) {
  const geo = useGeolocation();
  return <LocationCtx.Provider value={geo}>{children}</LocationCtx.Provider>;
}

/* ---------- Asisten (dock global) ---------- */
const AssistantCtx = createContext(null);
export const useAssistant = () => useContext(AssistantCtx);
export function AssistantProvider({ children }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen, openAssistant: () => setOpen(true), closeAssistant: () => setOpen(false) }), [open]);
  return <AssistantCtx.Provider value={value}>{children}</AssistantCtx.Provider>;
}

/* ---------- Toast aksesibel (live region) ---------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);
const TONES = {
  success: { cls: 'border-success bg-success-bg text-success', Icon: CheckCircle2 },
  info: { cls: 'border-info bg-info-bg text-info', Icon: Info },
  warning: { cls: 'border-warning bg-warning-bg text-warning', Icon: TriangleAlert },
  danger: { cls: 'border-danger bg-danger-bg text-danger', Icon: XCircle },
};
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback((i) => setItems((p) => p.filter((t) => t.id !== i)), []);
  const show = useCallback((message, tone = 'success') => {
    const t = { id: (id.current += 1), message, tone };
    setItems((p) => [...p, t]);
    setTimeout(() => dismiss(t.id), 7000); // cukup lama untuk dibaca
  }, [dismiss]);
  const value = useMemo(() => ({ show }), [show]);
  useEffect(() => () => setItems([]), []);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map(({ id: tid, message, tone }) => {
            const { cls, Icon } = TONES[tone];
            return (
              <m.div
                key={tid} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-card border bg-surface px-4 py-3 shadow-popover ${cls}`}
              >
                <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                <p className="font-medium">{message}</p>
                <button type="button" onClick={() => dismiss(tid)} aria-label="Tutup pesan" className="-mr-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control hover:bg-black/5"><X aria-hidden="true" size={16} /></button>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
