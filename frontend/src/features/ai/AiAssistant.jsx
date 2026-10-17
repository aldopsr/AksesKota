import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Mic, Send, Square } from 'lucide-react';
import { Alert, Button, Modal, inputClass } from '../../components/ui';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { VOICE_MAX_SECONDS } from '../accessibility/constants';
import { parseQuery } from './parseQuery';

const EXAMPLES = [
  'Cari rumah sakit yang punya ramp dan toilet disabilitas di dekat saya',
  'Cari taman yang memiliki jalur kursi roda',
  'Cari fasilitas publik dengan guiding block dalam radius 2 km',
];

// Alur: suara (Web Speech API) atau teks -> parser aturan -> filter -> GET /api/facilities.
// Semua hasil berasal dari database; tidak ada jawaban yang dikarang.
export default function AiAssistant({ open, onClose, userLocation, onLocate, onResult }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const rounds = useRef(0);
  const previous = useRef('');

  function submit(raw) {
    const combined = [previous.current, raw].filter(Boolean).join(' ').trim();
    if (!combined) return;
    const parsed = parseQuery(combined);
    if (!parsed.understood) {
      rounds.current += 1;
      if (rounds.current > 2) {
        // maksimal 2 pertanyaan klarifikasi (PRD 17.5)
        previous.current = '';
        rounds.current = 0;
        setMessage('Perintah belum cukup jelas. Sebutkan jenis tempat atau fasilitas yang dibutuhkan, misalnya "rumah sakit dengan ramp".');
      } else {
        previous.current = combined;
        setMessage('Tempat apa yang ingin Anda cari? Sebutkan jenis tempat atau fasilitas yang dibutuhkan.');
      }
      setText('');
      return;
    }
    onResult({ transcript: combined, parsed });
    onClose();
  }

  const { supported, listening, interim, error, start, stop, cancel } = useSpeechRecognition({
    maxSeconds: VOICE_MAX_SECONDS,
    onFinal: submit,
  });

  useEffect(() => {
    if (open) { setText(''); setMessage(''); rounds.current = 0; previous.current = ''; } else cancel();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = listening ? `Mendengarkan… ${interim ? `“${interim}”` : 'Ucapkan perintah Anda.'}` : message;

  return (
    <Modal open={open} onClose={onClose} title="Cari dengan suara">
      <div className="space-y-4">
        <p className="text-slate-700">Ucapkan atau ketik apa yang Anda cari. Hasil selalu berasal dari data AksesKota.</p>

        {!userLocation && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-cobalt-50 p-3 text-sm">
            <span>Aktifkan lokasi agar hasil diurutkan dari yang terdekat.</span>
            <Button variant="light" onClick={onLocate}><LocateFixed aria-hidden="true" size={18} /> Gunakan lokasi saya</Button>
          </div>
        )}

        {supported ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={listening ? stop : start}
              aria-pressed={listening}
              className={`inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl text-lg font-bold transition-colors ${listening ? 'bg-red-700 text-white' : 'bg-cobalt-700 text-white hover:bg-cobalt-800'}`}
            >
              {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {listening ? 'Selesai bicara' : 'Mulai bicara'}
            </button>
            <p className="text-xs text-slate-600">Maksimal {VOICE_MAX_SECONDS} detik. Pengenalan suara dijalankan oleh peramban Anda; AksesKota tidak menyimpan rekaman.</p>
          </div>
        ) : (
          <Alert tone="info">Peramban ini belum mendukung pengenalan suara. Gunakan kolom teks di bawah (Chrome, Edge, atau Safari mendukung suara).</Alert>
        )}

        <div aria-live="polite" role="status" className="min-h-6 font-bold">{status}</div>
        {error && <Alert tone="error">{error}</Alert>}

        <form onSubmit={(e) => { e.preventDefault(); submit(text.trim()); }} className="space-y-2">
          <label htmlFor="ai-text" className="block font-bold">Atau ketik perintah</label>
          <div className="flex gap-2">
            <input
              id="ai-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
              placeholder="Contoh: cari mall yang punya lift dan ramp" className={inputClass(false)}
            />
            <Button type="submit" disabled={!text.trim()} aria-label="Kirim"><Send aria-hidden="true" size={18} /></Button>
          </div>
        </form>

        <div>
          <p className="mb-1 text-sm font-bold">Contoh perintah</p>
          <ul className="flex flex-col gap-1">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button type="button" onClick={() => setText(ex)} className="min-h-11 w-full rounded-xl border border-cobalt-100 px-3 py-1 text-left text-sm hover:bg-cobalt-50">{ex}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
