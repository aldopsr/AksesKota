import { useCallback, useEffect, useRef, useState } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Rapikan teks agar enak dibacakan (angka satuan, persen, tanda baca markdown)
function speakable(text) {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>•]/g, '')
    .replace(/(\d+)\s*km\b/gi, '$1 kilometer')
    .replace(/(\d+)\s*m\b/g, '$1 meter')
    .replace(/%/g, ' persen')
    .replace(/\s+/g, ' ')
    .trim();
}

// Chrome memotong ucapan panjang; pecah per kalimat (<= ~180 karakter)
function chunk(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const out = [];
  let cur = '';
  sentences.forEach((s) => {
    if ((cur + s).length > 180 && cur) { out.push(cur.trim()); cur = s; } else cur += s;
  });
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Text-to-speech memakai Web Speech API peramban (gratis, tanpa kunci API).
export function useSpeechSynthesis() {
  const supported = !!synth;
  const [speaking, setSpeaking] = useState(false);
  const [voice, setVoice] = useState(null);
  const token = useRef(0);

  useEffect(() => {
    if (!synth) return undefined;
    const pick = () => setVoice(synth.getVoices().find((v) => /^id([-_]|$)/i.test(v.lang)) ?? null);
    pick();
    synth.addEventListener?.('voiceschanged', pick);
    return () => synth.removeEventListener?.('voiceschanged', pick);
  }, []);

  const cancel = useCallback(() => {
    token.current += 1; // batalkan callback onEnd milik ucapan yang sedang berjalan
    synth?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text, { rate = 1, onEnd } = {}) => {
    if (!synth) { onEnd?.(); return; }
    synth.cancel();
    const mine = (token.current += 1);
    const parts = chunk(speakable(text));
    if (!parts.length) { onEnd?.(); return; }
    setSpeaking(true);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = 'id-ID';
      if (voice) u.voice = voice;
      u.rate = rate;
      const done = () => {
        if (i === parts.length - 1 && token.current === mine) { setSpeaking(false); onEnd?.(); }
      };
      u.onend = done;
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') done(); };
      synth.speak(u);
    });
  }, [voice]);

  useEffect(() => () => synth?.cancel(), []);

  return { supported, speaking, speak, cancel, hasIndonesianVoice: !!voice };
}
