import { useCallback, useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const ERRORS = {
  'not-allowed': 'Akses mikrofon ditolak. Izinkan mikrofon di peramban, atau ketik perintah Anda.',
  'service-not-allowed': 'Akses mikrofon ditolak. Izinkan mikrofon di peramban, atau ketik perintah Anda.',
  'no-speech': 'Tidak ada suara terdengar. Coba lagi, atau ketik perintah Anda.',
  'audio-capture': 'Mikrofon tidak ditemukan.',
  network: 'Pengenalan suara membutuhkan koneksi internet.',
};

// Speech-to-text memakai Web Speech API peramban (keputusan backend: gratis, tanpa kunci API).
// Berhenti otomatis di `maxSeconds` (PRD: maks 30 detik). Hasil akhir dikirim lewat onFinal(teks).
export function useSpeechRecognition({ lang = 'id-ID', maxSeconds = 30, onFinal, onEnd }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const timer = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    finalRef.current = '';
    recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    if (!SR) return;
    setError('');
    setInterim('');
    finalRef.current = '';
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
      setInterim(text);
      if (e.results[e.results.length - 1].isFinal) finalRef.current = text;
    };
    rec.onerror = (e) => { if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Pengenalan suara gagal. Coba lagi.'); };
    rec.onend = () => {
      clearTimeout(timer.current);
      setListening(false);
      const text = finalRef.current || '';
      finalRef.current = '';
      onEndRef.current?.({ text });
      if (text) onFinalRef.current?.(text);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      timer.current = setTimeout(() => rec.stop(), maxSeconds * 1000);
    } catch {
      setError('Pengenalan suara tidak dapat dimulai.');
    }
  }, [lang, maxSeconds]);

  useEffect(() => () => { clearTimeout(timer.current); recRef.current?.abort(); }, []);

  return { supported: !!SR, listening, interim, error, start, stop, cancel };
}
