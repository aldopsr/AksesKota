import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_HINT, ATTRIBUTE_LABEL } from '../accessibility/constants';
import { Button, Modal } from '../../components/ui';

// Filter kebutuhan: dikelompokkan, dengan Terapkan dan Reset (IA 5.2). Perubahan baru berlaku setelah Terapkan.
export default function FilterSheet({ open, onClose, required, onApply, session, profile }) {
  const [draft, setDraft] = useState(required);
  useEffect(() => { if (open) setDraft(required); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (code) => setDraft((d) => (d.includes(code) ? d.filter((c) => c !== code) : [...d, code]));

  return (
    <Modal
      open={open} onClose={onClose} variant="sheet" title="Filter kebutuhan aksesibilitas"
      footer={(
        <>
          <Button variant="ghost" onClick={() => setDraft([])} disabled={draft.length === 0}>Reset</Button>
          <Button onClick={() => { onApply(draft); onClose(); }}>Terapkan{draft.length > 0 ? ` (${draft.length})` : ''}</Button>
        </>
      )}
    >
      <p className="font-sub mb-4 text-ink-secondary">
        Pilih fasilitas yang Anda butuhkan. Hasil diurutkan menurut kecocokan dengan pilihan ini. Data yang belum diketahui tidak dihitung tersedia.
      </p>

      {session ? (
        profile.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card bg-brand-50 p-3">
            <p className="font-sub flex-1 text-sm">Profil Anda berisi {profile.length} kebutuhan.</p>
            <Button variant="secondary" size="sm" onClick={() => setDraft(profile)}>Pakai profil saya</Button>
          </div>
        ) : (
          <p className="font-sub mb-4 text-sm text-ink-secondary">Profil belum diisi. <Link to="/accessibility-profile" className="font-semibold text-action-secondary underline underline-offset-4">Atur kebutuhan saya</Link> agar terisi otomatis.</p>
        )
      ) : (
        <p className="font-sub mb-4 text-sm text-ink-secondary"><Link to="/login" className="font-semibold text-action-secondary underline underline-offset-4">Masuk</Link> untuk menyimpan kebutuhan sebagai profil.</p>
      )}

      <div className="space-y-5">
        {ATTRIBUTE_GROUPS.map((g) => (
          <fieldset key={g.key}>
            <legend className="mb-1 font-semibold">{g.label}</legend>
            <div className="divide-y divide-border rounded-card border border-border">
              {g.codes.map((code) => (
                <label key={code} className="flex min-h-12 cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-surface-subtle">
                  <input type="checkbox" checked={draft.includes(code)} onChange={() => toggle(code)} className="mt-0.5 size-5 shrink-0 accent-brand-700" />
                  <span>
                    <span className="block font-semibold">{ATTRIBUTE_LABEL[code]}</span>
                    <span className="font-sub block text-sm text-ink-secondary">{ATTRIBUTE_HINT[code]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}
