import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, m } from 'motion/react';
import { Bot, Car, ChevronDown, ChevronUp, GripHorizontal, Mic, RotateCcw, Send, Square, Volume2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAssistant, useLocationState } from '../../context/AppContexts';
import { Alert, Button, IconButton, buttonClass, inputClass } from '../../components/ui';
import { levelFor, normalizeFacility } from '../accessibility/match';
import FacilityCard from '../explore/FacilityCard';
import { ATTRIBUTE_LABEL, CATEGORY_LABEL, VOICE_MAX_SECONDS } from '../accessibility/constants';
import { buildExplore } from '../../lib/url';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useKartuApung } from '../../hooks/useKartuApung';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { parseQuery } from './parseQuery';

const SUGGESTIONS = [
  'Rekomendasikan rumah sakit yang cocok untuk kursi roda',
  'Buatkan rute ke stasiun terdekat',
  'Cari taman dengan jalur kursi roda dekat saya',
  'Tempat mana yang paling cocok dengan kebutuhan saya?',
];
const STOP_WORDS = /^(stop|berhenti|selesai|keluar|tutup|cukup)[.!]?$/i;

// Ringkasan interpretasi agar parameter yang dipakai AI tidak tersembunyi (IA 5.5)
function Interpretation({ applied }) {
  if (!applied) return null;
  const bits = [
    applied.query && `kata kunci “${applied.query}”`,
    applied.category && `kategori ${CATEGORY_LABEL[applied.category]}`,
    applied.needs?.length && `${applied.used_profile ? 'profil Anda' : 'kebutuhan'}: ${applied.needs.map((c) => ATTRIBUTE_LABEL[c]).join(', ')}`,
    applied.radius_m && `radius ${applied.radius_m >= 1000 ? `${applied.radius_m / 1000} km` : `${applied.radius_m} m`}`,
  ].filter(Boolean);
  if (!bits.length) return null;
  return <p className="font-sub rounded-control bg-surface-subtle px-2.5 py-1.5 text-xs text-ink-secondary">Filter yang dipakai: {bits.join(' · ')}. Anda bisa mengubahnya di panel filter.</p>;
}

/**
 * Kartu fasilitas di dalam percakapan memakai komponen yang SAMA dengan daftar hasil
 * di peta. Sebelumnya ada MiniCard tersendiri: isi yang sama ditulis dua kali, dan
 * begitu kartu daftar diringkas, kartu di percakapan tertinggal — nama, alamat, jarak,
 * kecocokan, bintang, dan dua tombol berteks dalam lima baris.
 */

// Asisten percakapan: ketik atau bicara; jawaban bisa dibacakan; mode hands-free mengulang dengar -> jawab -> bicara.
export default function AssistantDock() {
  const { open, closeAssistant } = useAssistant();
  const { session } = useAuth();
  const geo = useLocationState();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const currentFacilityId = matchPath('/facilities/:id', location.pathname)?.params.id;
  const facilityId = currentFacilityId && currentFacilityId !== 'new' ? currentFacilityId : null;

  const statusQ = useQuery({ queryKey: ['ai-status', !!session], queryFn: () => api('/ai/status'), enabled: open, staleTime: 60_000 });
  const aiReady = !!session && !!statusQ.data?.enabled;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [speakAll, setSpeakAll] = useState(() => { try { return localStorage.getItem('ak_tts_all') === '1'; } catch { return false; } });
  const [notice, setNotice] = useState('');
  const [usage, setUsage] = useState(null);
  const idleCount = useRef(0);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const handsFreeRef = useRef(false);
  const speakAllRef = useRef(speakAll);
  handsFreeRef.current = handsFree;
  speakAllRef.current = speakAll;
  const tts = useSpeechSynthesis();

  const push = (msg) => setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, ...msg }]);
  const say = useCallback((text, viaVoice) => { if (viaVoice || speakAllRef.current || handsFreeRef.current) tts.speak(text); }, [tts]);
  const stopHandsFree = useCallback((why) => { setHandsFree(false); if (why) setNotice(why); }, []);

  /* ---------- menerapkan hasil ke URL (parameter terlihat, bisa dibagikan) ---------- */
  function paramsFrom(applied) {
    const needs = applied?.needs ?? [];
    return {
      q: applied?.query ?? '', category: applied?.category ?? '',
      needsRaw: needs.length ? needs.join(',') : (applied?.used_profile ? undefined : 'none'),
      radius: applied?.radius_m ?? null,
    };
  }
  const openFacility = (fid) => { navigate(`/facilities/${fid}`); if (!isDesktop) closeAssistant(); };
  const routeTo = (fid, applied) => {
    navigate({ pathname: `/facilities/${fid}`, search: buildExplore({ ...paramsFrom(applied), route: true }) });
    if (!isDesktop) closeAssistant();
  };

  async function handleAi(res, viaVoice) {
    const facilities = (res.facilities ?? []).map(normalizeFacility);
    push({ role: 'assistant', text: res.reply, facilities, recommendedIds: res.recommended_ids ?? [], applied: res.applied });
    if (res.usage) setUsage(res.usage);
    const route = res.actions?.find((a) => a.type === 'route');
    if (route) routeTo(route.facility_id, res.applied);
    else if (res.actions?.some((a) => a.type === 'show_results')) navigate(`/map${buildExplore(paramsFrom(res.applied))}`);
    say(res.reply, viaVoice);
  }

  async function handleFallback(text, viaVoice) {
    const parsed = parseQuery(text);
    const reply = parsed.understood
      ? 'Baik, saya tampilkan hasilnya di peta.'
      : 'Saya belum paham. Sebutkan jenis tempat atau kebutuhan Anda, misalnya rumah sakit dengan ramp.';
    if (parsed.understood) {
      navigate(`/map${buildExplore({ category: parsed.category ?? '', needsRaw: parsed.needs.length ? parsed.needs.join(',') : undefined, radius: parsed.radius })}`);
    }
    push({ role: 'assistant', text: reply });
    say(reply, viaVoice);
  }

  async function ask(raw, viaVoice = false) {
    const text = raw.trim();
    if (!text || busy) return;
    if (STOP_WORDS.test(text)) { tts.cancel(); stopHandsFree('Mode hands-free dimatikan.'); return; }
    tts.cancel();
    setInput('');
    setNotice('');
    const history = messages.filter((x) => !x.error).slice(-6).map((x) => ({ role: x.role, text: x.text }));
    push({ role: 'user', text });
    setBusy(true);
    try {
      if (aiReady) {
        const res = await api('/ai/chat', {
          method: 'POST',
          body: { message: text, history, origin: geo.location ? { lat: geo.location.lat, lon: geo.location.lng } : null, facility_id: facilityId ? Number(facilityId) : undefined },
        });
        await handleAi(res, viaVoice);
      } else {
        await handleFallback(text, viaVoice);
      }
    } catch (e) {
      if (e.data?.fallback) {
        setNotice('Asisten AI sedang tidak tersedia. Memakai pencarian dasar.');
        await handleFallback(text, viaVoice);
      } else {
        push({ role: 'assistant', text: e.message, error: true });
        say(e.message, viaVoice);
      }
    } finally {
      setBusy(false);
    }
  }

  /* ---------- suara ---------- */
  const rec = useSpeechRecognition({
    maxSeconds: VOICE_MAX_SECONDS,
    onFinal: (t) => { idleCount.current = 0; ask(t, true); },
    onEnd: ({ text }) => {
      if (!text && handsFreeRef.current) {
        idleCount.current += 1;
        if (idleCount.current >= 2) stopHandsFree('Mode hands-free dimatikan karena tidak ada suara.');
      }
    },
  });

  useEffect(() => {
    if (!open || !handsFree || busy || tts.speaking || rec.listening) return undefined;
    const t = setTimeout(() => rec.start(), 500);
    return () => clearTimeout(t);
  }, [open, handsFree, busy, tts.speaking, rec.listening]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rec.error && handsFree) stopHandsFree(rec.error); }, [rec.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = () => { if (rec.listening) { rec.stop(); return; } tts.cancel(); rec.start(); };
  function toggleHandsFree() {
    if (handsFree) { stopHandsFree(); rec.cancel(); tts.cancel(); return; }
    idleCount.current = 0;
    setNotice('');
    setHandsFree(true);
    tts.speak('Mode hands-free aktif. Silakan bicara. Katakan berhenti untuk selesai.');
  }
  function toggleSpeakAll(v) {
    setSpeakAll(v);
    try { localStorage.setItem('ak_tts_all', v ? '1' : '0'); } catch { /* abaikan */ }
    if (!v) tts.cancel();
  }

  useEffect(() => {
    if (open) { setMinimized(false); setTimeout(() => inputRef.current?.focus(), 150); } else { rec.cancel(); tts.cancel(); setHandsFree(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const lastUser = [...log.querySelectorAll('[data-user]')].pop();
    log.scrollTo({ top: lastUser ? lastUser.offsetTop - log.offsetTop - 8 : log.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, minimized]);

  const status = rec.listening ? 'Mendengarkan' : busy ? 'Berpikir' : tts.speaking ? 'Berbicara' : handsFree ? 'Siap mendengar' : 'Siap';
  const lastAssistant = [...messages].reverse().find((x) => x.role === 'assistant');

  // Panel asisten jadi kartu mengambang di layar lebar, sejalan dengan kartu hasil dan
  // detail. Di HP ia tetap panel bawah selebar layar: memindahkan panel di layar
  // selebar telapak tangan tidak menghasilkan apa pun selain menutupi hal lain.
  const kartu = useKartuApung({
    id: 'asisten',
    aktif: isDesktop,
    // Pojok kanan bawah, tempat ia selama ini berada — posisi bawaan harus langsung
    // benar supaya tidak ada yang perlu menggesernya.
    posisiAwal: () => ({
      x: Math.max(12, window.innerWidth - 416),
      y: Math.max(96, window.innerHeight - 620),
    }),
  });

  // Satu sumber teks untuk dua bentuk di bawah (paragraf di layar lebar, lipatan di
  // ponsel) supaya keduanya tidak pernah menyimpang.
  const catatanSuara = (
    <>
      {!rec.supported && 'Peramban ini belum mendukung input suara; gunakan teks. '}
      {tts.supported && !tts.hasIndonesianVoice && 'Suara bahasa Indonesia belum terpasang di perangkat ini, jadi pelafalan bisa kurang pas. '}
      Pengenalan suara dijalankan peramban Anda; AksesKota tidak menyimpan rekaman.
      {usage && ` Sisa ${Math.max(0, usage.limit - usage.used)} dari ${usage.limit} pertanyaan hari ini.`}
    </>
  );

  return (
    <AnimatePresence>
      {open && (
        <m.section
          key="dock" role="dialog" aria-modal="false" aria-label="Asisten AksesKota"
          ref={isDesktop ? kartu.kartuRef : undefined}
          // Saat mengambang, posisi kartunya dipegang transform dari JavaScript, jadi
          // kemunculannya hanya boleh menganimasikan opacity — menganimasikan y di sini
          // akan bertabrakan dengan koordinat kartunya dan membuatnya melompat. Di HP
          // ia tetap naik dari bawah, arah yang sama dengan tempatnya muncul dan ditutup.
          initial={isDesktop ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={isDesktop ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={isDesktop ? { opacity: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeAssistant(); }}
          style={isDesktop ? { ...kartu.gaya, width: '25rem' } : undefined}
          className={`fixed z-40 flex flex-col border border-border bg-surface shadow-dialog ${
            isDesktop ? 'left-0 top-0 rounded-panel' : 'inset-x-0 bottom-16 md:bottom-0 max-h-[85dvh] rounded-t-panel'
          }`}
        >
          <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
            {/* Judulnya tetap ada sebagai heading untuk navigasi pembaca layar; yang
                terlihat dipindah ke dalam tombol gagang. */}
            <h2 className="sr-only">Asisten AksesKota</h2>
            {isDesktop ? (
              <button
                type="button"
                {...kartu.gagang}
                aria-label="Pindahkan panel asisten. Gunakan tombol panah, tahan Shift untuk melangkah lebih jauh."
                className="flex min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-2 rounded-control px-1 py-0.5 text-left hover:bg-surface-subtle active:cursor-grabbing"
              >
                <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-700 text-white"><Bot size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-base font-semibold leading-tight">
                    Asisten AksesKota
                    <GripHorizontal aria-hidden="true" size={14} className="shrink-0 text-ink-muted" />
                  </span>
                  <span className="block text-xs font-semibold text-brand-800">{status}</span>
                </span>
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
                <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-700 text-white"><Bot size={20} /></span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-tight">Asisten AksesKota</span>
                  <span className="block text-xs font-semibold text-brand-800">{status}</span>
                </span>
              </div>
            )}
            {/* Status dibacakan sekali saja: di luar tombol, supaya perubahannya tidak
                membuat pembaca layar mengulang seluruh nama tombol tiap kali. */}
            <p role="status" aria-live="polite" className="sr-only">{status}</p>
            {isDesktop && kartu.dipindah && (
              <IconButton variant="ghost" label="Kembalikan panel ke posisi semula" onClick={kartu.reset}><RotateCcw aria-hidden="true" size={16} /></IconButton>
            )}
            <IconButton variant="ghost" label={minimized ? 'Perbesar asisten' : 'Kecilkan asisten'} aria-expanded={!minimized} onClick={() => setMinimized((v) => !v)}>{minimized ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</IconButton>
            <IconButton variant="ghost" label="Tutup asisten" onClick={closeAssistant}><X aria-hidden="true" /></IconButton>
          </header>

          {!minimized && (
            <>
              <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="panel-scroll min-h-40 flex-1 space-y-3 overflow-y-auto p-3">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="font-sub text-ink-secondary">Halo! Tanyakan tempat yang cocok dengan kebutuhan Anda, minta rekomendasi, atau minta dibuatkan rute. Anda bisa mengetik atau bicara.</p>
                    <ul className="flex flex-col gap-1.5">
                      {SUGGESTIONS.map((s) => <li key={s}><button type="button" onClick={() => ask(s)} className="min-h-11 w-full rounded-control border border-border px-3 py-1.5 text-left text-sm font-medium hover:bg-surface-subtle">{s}</button></li>)}
                    </ul>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} data-user={msg.role === 'user' ? '' : undefined} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                    <div className={msg.role === 'user' ? 'max-w-[85%] rounded-panel rounded-br-md bg-brand-700 px-3.5 py-2 text-white' : 'max-w-full space-y-2'}>
                      <p className={msg.error ? 'font-semibold text-danger' : ''}><span className="sr-only">{msg.role === 'user' ? 'Anda: ' : 'Asisten: '}</span>{msg.text}</p>
                      {msg.role === 'assistant' && <Interpretation applied={msg.applied} />}
                      {msg.facilities?.length > 0 && (
                        <ul className="space-y-2">
                          {[...msg.facilities].sort((a, b) => (msg.recommendedIds.includes(b.id) ? 1 : 0) - (msg.recommendedIds.includes(a.id) ? 1 : 0)).slice(0, 3).map((f) => (
                            <li key={f.id}>
                              {msg.recommendedIds.includes(f.id) && (
                                <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-900">
                                  Direkomendasikan asisten
                                </p>
                              )}
                              <FacilityCard
                                facility={f} level={levelFor(f)} distance={f.distance_m ?? null}
                                to={`/facilities/${f.id}`} onOpen={() => { if (!isDesktop) closeAssistant(); }}
                                onRoute={() => routeTo(f.id, msg.applied)}
                              />
                            </li>
                          ))}
                          {msg.facilities.length > 3 && <li className="font-sub text-sm text-ink-secondary">{msg.facilities.length - 3} tempat lainnya ada di daftar hasil.</li>}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
                {rec.listening && <p className="rounded-control bg-brand-50 p-2.5 text-sm">Mendengarkan… {rec.interim ? `“${rec.interim}”` : 'silakan bicara.'}</p>}
                {busy && <p className="text-sm font-semibold text-brand-800">Asisten sedang berpikir…</p>}
              </div>

              <div className="space-y-2 border-t border-border p-3">
                {!session && <Alert tone="info" className="text-sm"><Link to="/login" state={{ from: location.pathname + location.search }} className="font-semibold underline underline-offset-4">Masuk</Link> untuk memakai asisten AI penuh (rekomendasi dan rute lewat percakapan). Saat ini memakai pencarian dasar.</Alert>}
                {session && statusQ.data && !statusQ.data.enabled && <Alert tone="info" className="text-sm">Asisten AI belum diaktifkan di server. Memakai pencarian dasar.</Alert>}
                {notice && <Alert tone="warning" className="text-sm">{notice}</Alert>}
                {rec.error && !handsFree && <Alert tone="danger" className="text-sm">{rec.error}</Alert>}
                {!geo.location && <Button variant="link" className="min-h-11 text-sm" onClick={geo.locate}>Aktifkan lokasi agar jarak dan rute bisa dibuat</Button>}
                {handsFree && <p className="font-sub flex items-start gap-2 rounded-control bg-warning-bg p-2.5 text-sm text-warning"><Car aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> Demi keselamatan, jangan melihat layar saat berkendara. Katakan “berhenti” untuk mengakhiri.</p>}

                <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2">
                  <label htmlFor="assistant-input" className="sr-only">Pesan untuk asisten</label>
                  <input id="assistant-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="Tanya atau minta rute…" className={inputClass(false)} autoComplete="off" />
                  <button type="submit" disabled={!input.trim() || busy} aria-label="Kirim" className={buttonClass('primary', 'md', 'size-11 shrink-0 px-0')}><Send aria-hidden="true" size={18} /></button>
                  {rec.supported && (
                    <button type="button" onClick={toggleMic} aria-pressed={rec.listening} aria-label={rec.listening ? 'Selesai bicara' : 'Bicara ke asisten'} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-control text-white transition-colors ${rec.listening ? 'bg-danger' : 'bg-brand-800 hover:bg-brand-900'}`}>
                      {rec.listening ? <Square aria-hidden="true" size={18} /> : <Mic aria-hidden="true" size={20} />}
                    </button>
                  )}
                </form>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {rec.supported && tts.supported && (
                    <button type="button" onClick={toggleHandsFree} aria-pressed={handsFree} className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-sm font-semibold ${handsFree ? 'border-brand-700 bg-brand-700 text-white' : 'border-border-strong bg-surface hover:bg-surface-subtle'}`}>
                      <Car aria-hidden="true" size={16} /> Mode hands-free
                    </button>
                  )}
                  {tts.supported && (
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={speakAll} onChange={(e) => toggleSpeakAll(e.target.checked)} className="size-5 accent-brand-700" />
                      <Volume2 aria-hidden="true" size={16} /> Bacakan semua jawaban
                    </label>
                  )}
                  {tts.speaking && <Button variant="link" className="min-h-11 text-sm text-danger" onClick={tts.cancel}>Hentikan suara</Button>}
                </div>
                {/* Catatan yang sama, dua bentuk. Di ponsel ia dilipat: utuh, teksnya
                    empat baris — dan di layar 375 px perabot di bawah kolom isian sudah
                    menyisakan 190 px saja untuk percakapannya sendiri, kira-kira dua
                    gelembung. Dilipat, bukan dipotong: ini pernyataan privasi, jadi
                    kalimatnya harus tetap bisa dibaca utuh oleh yang mencarinya. */}
                <p className="font-sub text-xs text-ink-secondary max-sm:hidden">{catatanSuara}</p>
                <details className="sm:hidden">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-ink-secondary">
                    Tentang suara dan privasi
                  </summary>
                  <p className="font-sub pb-1 text-xs text-ink-secondary">{catatanSuara}</p>
                </details>
              </div>
            </>
          )}
          {minimized && lastAssistant && <p className="font-sub line-clamp-2 px-3 pb-3 text-sm">{lastAssistant.text}</p>}
        </m.section>
      )}
    </AnimatePresence>
  );
}
