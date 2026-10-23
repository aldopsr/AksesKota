import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Bot, Car, ChevronDown, ChevronUp, GripHorizontal, Info, MapPin, Mic, RotateCcw, Send, SlidersHorizontal, Square, TriangleAlert, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAssistant, useLocationState } from '../../context/AppContexts';
import { IconButton } from '../../components/ui';
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
  return <p className="font-sub text-xs text-ink-secondary">Filter: {bits.join(' · ')}</p>;
}

/**
 * Kartu fasilitas di dalam percakapan memakai komponen yang SAMA dengan daftar hasil
 * di peta. Sebelumnya ada MiniCard tersendiri: isi yang sama ditulis dua kali, dan
 * begitu kartu daftar diringkas, kartu di percakapan tertinggal — nama, alamat, jarak,
 * kecocokan, bintang, dan dua tombol berteks dalam lima baris.
 */

/**
 * Sakelar: tombol role="switch", bukan kotak centang. Keadaan ON/OFF terbaca dari posisi
 * dan warna, dan teks keadaannya tetap tersedia untuk pembaca layar lewat aria-checked.
 * Gerak kenop hanya transisi CSS, jadi ikut dimatikan oleh prefers-reduced-motion.
 */
function Sakelar({ id, label, hint, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p id={`${id}-l`} className="text-sm font-semibold leading-tight">{label}</p>
        {hint && <p id={`${id}-h`} className="font-sub mt-0.5 text-xs text-ink-secondary">{hint}</p>}
      </div>
      <button
        type="button" role="switch" id={id} aria-checked={checked} disabled={disabled}
        aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-brand-700 bg-brand-700' : 'border-border-strong bg-surface'}`}
      >
        <span aria-hidden="true" className={`block size-4 rounded-full transition-transform duration-200 ease-[var(--ease-out)] ${checked ? 'translate-x-6 bg-white' : 'translate-x-1 bg-ink-muted'}`} />
      </button>
    </div>
  );
}

// Asisten percakapan: ketik atau bicara; jawaban bisa dibacakan; mode hands-free mengulang dengar -> jawab -> bicara.
export default function AssistantDock() {
  const { open, closeAssistant, mintaHandsFree, lupakanMintaHandsFree } = useAssistant();
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
  const [opsiOpen, setOpsiOpen] = useState(false);
  const opsiBtnRef = useRef(null);
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
  const kurangiGerak = useReducedMotion();

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
  /**
   * "Tampilkan hasilnya di peta" — dan benar-benar menampilkannya.
   *
   * Di ponsel asisten menempati hampir seluruh layar, jadi berpindah ke /map saja tidak
   * cukup: hasilnya terbuka persis di belakang asisten, dan orang harus menutupnya
   * sendiri dulu untuk melihat apa yang baru saja ia minta. Dikecilkan, bukan ditutup —
   * jawaban terakhirnya tetap terbaca di bilah tipis, dan percakapannya tidak hilang
   * kalau ia ingin bertanya lagi.
   */
  const tampilkanHasil = (search) => {
    navigate(`/map${search}`);
    if (!isDesktop) setMinimized(true);
  };
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
    else if (res.actions?.some((a) => a.type === 'show_results')) tampilkanHasil(buildExplore(paramsFrom(res.applied)));
    say(res.reply, viaVoice);
  }

  async function handleFallback(text, viaVoice) {
    const parsed = parseQuery(text);
    const reply = parsed.understood
      ? 'Baik, saya tampilkan hasilnya di peta.'
      : 'Saya belum paham. Sebutkan jenis tempat atau kebutuhan Anda, misalnya rumah sakit dengan ramp.';
    if (parsed.understood) {
      tampilkanHasil(buildExplore({ category: parsed.category ?? '', needsRaw: parsed.needs.length ? parsed.needs.join(',') : undefined, radius: parsed.radius }));
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

  // Fokus dipinjam saat asisten terbuka, dan DIKEMBALIKAN saat ditutup.
  //
  // Tanpa pengembalian itu, menutup dengan Escape melempar fokus ke <body>: pengguna
  // papan ketik yang tadi menekan "Tanya asisten" harus menelusuri seluruh halaman
  // dari awal hanya untuk kembali ke tempatnya semula. Pola yang sama sudah dipakai
  // menu di components/ui.jsx. Pemicu yang sudah lepas dari DOM dilewati — misalnya
  // saat asisten ditutup karena berpindah halaman.
  const pemicuRef = useRef(null);
  useEffect(() => {
    if (open) {
      pemicuRef.current = document.activeElement;
      setMinimized(false); setOpsiOpen(false); setTimeout(() => inputRef.current?.focus(), 150);
      // Dibuka dengan permintaan hands-free (mis. dari preset tunanetra). Dijalankan
      // lewat toggleHandsFree yang sama dengan sakelarnya, bukan setHandsFree langsung,
      // supaya pengumumannya ikut terdengar: tanpa itu mikrofon menyala diam-diam, dan
      // orang yang tidak melihat layar tidak punya cara tahu bahwa ia sedang didengar.
      if (mintaHandsFree && rec.supported && tts.supported) toggleHandsFree();
      lupakanMintaHandsFree();
    } else {
      if (pemicuRef.current?.isConnected) pemicuRef.current.focus();
      pemicuRef.current = null;
      rec.cancel(); tts.cancel(); setHandsFree(false);
    }
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

  // Satu pesan status saja yang tampil di atas kolom ketik, menurut prioritas. Dulu
  // empat kotak peringatan bisa menumpuk sekaligus dan memakan separuh tinggi panel.
  const banner = handsFree
    ? { tone: 'warning', Ikon: Car, role: 'status', isi: <>Hands-free aktif. Demi keselamatan, jangan melihat layar saat berkendara. Katakan “berhenti” untuk mengakhiri.</> }
    : rec.error
      ? { tone: 'danger', Ikon: TriangleAlert, role: 'alert', isi: rec.error }
      : notice
        ? { tone: 'warning', Ikon: TriangleAlert, role: 'status', isi: notice }
        : !session
          ? { tone: 'info', Ikon: Info, role: 'status', isi: <><Link to="/login" state={{ from: location.pathname + location.search }} className="font-semibold underline underline-offset-4">Masuk</Link> untuk asisten AI penuh. Saat ini memakai pencarian dasar.</> }
          : (statusQ.data && !statusQ.data.enabled)
            ? { tone: 'info', Ikon: Info, role: 'status', isi: 'Asisten AI belum diaktifkan di server. Memakai pencarian dasar.' }
            : null;
  const bannerCls = { warning: 'bg-warning-bg', danger: 'bg-danger-bg', info: 'bg-surface-subtle' };
  const opsiAktif = handsFree || speakAll;
  const sibuk = rec.listening || busy || tts.speaking;

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
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            // Escape menutup lapis terdalam dulu: panel opsi, baru asisten.
            if (opsiOpen) { e.stopPropagation(); setOpsiOpen(false); opsiBtnRef.current?.focus(); } else closeAssistant();
          }}
          style={isDesktop ? { ...kartu.gaya, width: '25rem' } : undefined}
          className={`fixed z-40 flex flex-col overflow-hidden border border-border bg-surface shadow-dialog ${
            isDesktop ? 'left-0 top-0 rounded-panel' : 'inset-x-0 bottom-16 md:bottom-0 max-h-[85dvh] rounded-t-panel'
          }`}
        >
          <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
            {/* Judulnya tetap ada sebagai heading untuk navigasi pembaca layar; yang
                terlihat dipindah ke dalam tombol gagang. */}
            <h2 className="sr-only">Asisten AksesKota</h2>
            {(() => {
              const isi = (
                <>
                  <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-700 text-white"><Bot size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-base font-semibold leading-tight">
                      Asisten AksesKota
                      {isDesktop && <GripHorizontal aria-hidden="true" size={14} className="shrink-0 text-ink-muted" />}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                      <span aria-hidden="true" className={`size-2 rounded-full ${sibuk ? 'ak-denyut bg-brand-600' : 'bg-success'}`} />
                      {status}
                    </span>
                  </span>
                </>
              );
              return isDesktop ? (
                <button
                  type="button"
                  {...kartu.gagang}
                  aria-label="Pindahkan panel asisten. Gunakan tombol panah, tahan Shift untuk melangkah lebih jauh."
                  className="flex min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-2 rounded-control px-1 py-0.5 text-left hover:bg-surface-subtle active:cursor-grabbing"
                >{isi}</button>
              ) : <div className="flex min-w-0 flex-1 items-center gap-2 px-1">{isi}</div>;
            })()}
            {/* Status dibacakan sekali saja: di luar tombol, supaya perubahannya tidak
                membuat pembaca layar mengulang seluruh nama tombol tiap kali. */}
            <p role="status" aria-live="polite" className="sr-only">{status}</p>
            {isDesktop && kartu.dipindah && (
              <IconButton variant="ghost" label="Kembalikan panel ke posisi semula" onClick={kartu.reset}><RotateCcw aria-hidden="true" size={16} /></IconButton>
            )}
            {!minimized && (
              <IconButton
                ref={opsiBtnRef} variant="ghost" label="Opsi suara dan privasi"
                aria-expanded={opsiOpen} aria-controls="asisten-opsi" onClick={() => setOpsiOpen((v) => !v)}
                className={`relative ${opsiOpen ? 'bg-surface-subtle' : ''}`}
              >
                <SlidersHorizontal aria-hidden="true" size={18} />
                {opsiAktif && <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-brand-700 ring-2 ring-surface" />}
              </IconButton>
            )}
            <IconButton variant="ghost" label={minimized ? 'Perbesar asisten' : 'Kecilkan asisten'} aria-expanded={!minimized} onClick={() => setMinimized((v) => !v)}>{minimized ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</IconButton>
            <IconButton variant="ghost" label="Tutup asisten" onClick={closeAssistant}><X aria-hidden="true" /></IconButton>
          </header>

          {!minimized && (
            <>
              {/* Pengaturan suara dilipat ke satu panel. Dulu tombol hands-free, kotak
                  centang, dan catatan privasi selalu tampil di bawah kolom ketik dan
                  bersaing dengan percakapan; sekarang ia muncul hanya bila dicari. */}
              <AnimatePresence initial={false}>
                {opsiOpen && (
                  <m.div
                    id="asisten-opsi" key="opsi" role="group" aria-label="Opsi suara dan privasi"
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: kurangiGerak ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
                    className="shrink-0 overflow-hidden border-b border-border bg-surface-subtle"
                  >
                    <div className="space-y-3.5 p-3.5">
                      {rec.supported && tts.supported && (
                        <Sakelar id="sk-handsfree" label="Mode hands-free" hint="Dengar, jawab, lalu bicara otomatis." checked={handsFree} onChange={toggleHandsFree} />
                      )}
                      {tts.supported && (
                        <Sakelar id="sk-bacakan" label="Bacakan semua jawaban" checked={speakAll} onChange={toggleSpeakAll} />
                      )}
                      <p className="font-sub text-xs leading-relaxed text-ink-secondary">{catatanSuara}</p>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="panel-scroll min-h-40 flex-1 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-semibold leading-snug">Mau cari tempat apa?</p>
                      <p className="font-sub mt-1 text-ink-secondary">Tanya tempat yang cocok, minta rekomendasi, atau minta dibuatkan rute. Boleh mengetik atau bicara.</p>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((sg, i) => (
                        <m.li key={sg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.05 * i, ease: [0.23, 1, 0.32, 1] }}>
                          <button type="button" onClick={() => ask(sg)} className="min-h-11 rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm font-medium leading-snug transition-colors hover:border-brand-400 hover:bg-brand-50">{sg}</button>
                        </m.li>
                      ))}
                    </ul>
                  </div>
                )}
                {messages.map((msg) => (
                  <m.div
                    key={msg.id} data-user={msg.role === 'user' ? '' : undefined}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                    className={msg.role === 'user' ? 'flex justify-end' : ''}
                  >
                    <div className={msg.role === 'user' ? 'max-w-[85%] rounded-panel rounded-br-md bg-brand-700 px-3.5 py-2 text-white' : 'max-w-full space-y-2.5'}>
                      <p className={msg.error ? 'font-semibold text-danger' : ''}><span className="sr-only">{msg.role === 'user' ? 'Anda: ' : 'Asisten: '}</span>{msg.text}</p>
                      {msg.role === 'assistant' && <Interpretation applied={msg.applied} />}
                      {msg.facilities?.length > 0 && (
                        <ul className="space-y-2.5">
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
                  </m.div>
                ))}
                {rec.listening && (
                  <p className="flex items-center gap-2 rounded-control bg-brand-50 p-2.5 text-sm">
                    <span aria-hidden="true" className="ak-denyut size-2.5 shrink-0 rounded-full bg-danger" />
                    <span>Mendengarkan… {rec.interim ? `“${rec.interim}”` : 'silakan bicara.'}</span>
                  </p>
                )}
                {busy && (
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-secondary">
                    <span aria-hidden="true" className="ak-titik inline-flex items-center gap-1"><span /><span /><span /></span>
                    <span className="sr-only">Asisten sedang berpikir</span>
                  </p>
                )}
              </div>

              <div className="shrink-0 space-y-2 border-t border-border p-3">
                {banner && (
                  <p role={banner.role} className={`font-sub flex items-start gap-2 rounded-control px-3 py-2 text-xs leading-snug text-ink ${bannerCls[banner.tone]}`}>
                    <banner.Ikon aria-hidden="true" size={15} className="mt-px shrink-0" />
                    <span className="min-w-0 flex-1">{banner.isi}</span>
                  </p>
                )}
                {(!geo.location || tts.speaking) && (
                  <div className="flex flex-wrap gap-2">
                    {!geo.location && (
                      <button type="button" onClick={geo.locate} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 text-sm font-semibold transition-colors hover:bg-surface-subtle">
                        <MapPin aria-hidden="true" size={15} /> Aktifkan lokasi
                      </button>
                    )}
                    {tts.speaking && (
                      <button type="button" onClick={tts.cancel} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-danger bg-surface px-3.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-bg">
                        <Square aria-hidden="true" size={13} /> Hentikan suara
                      </button>
                    )}
                  </div>
                )}

                {/* Satu wadah untuk kolom ketik, mikrofon, dan kirim. Tiga kotak terpisah
                    dengan tiga bingkai sendiri membuat baris ini terlihat paling ramai
                    di seluruh panel. */}
                <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-1 rounded-[1.25rem] border border-border-strong bg-surface p-1.5 transition-colors focus-within:border-brand-800 focus-within:ring-2 focus-within:ring-brand-200">
                  <label htmlFor="assistant-input" className="sr-only">Pesan untuk asisten</label>
                  <input id="assistant-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="Tanya atau minta rute…" className="min-h-11 min-w-0 flex-1 rounded-control bg-transparent px-3 outline-none focus-visible:outline-none" autoComplete="off" />
                  {rec.supported && (
                    <button type="button" onClick={toggleMic} aria-pressed={rec.listening} aria-label={rec.listening ? 'Selesai bicara' : 'Bicara ke asisten'} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors ${rec.listening ? 'ak-denyut bg-danger text-white' : 'text-ink hover:bg-surface-subtle'}`}>
                      {rec.listening ? <Square aria-hidden="true" size={17} /> : <Mic aria-hidden="true" size={20} />}
                    </button>
                  )}
                  <button type="submit" disabled={!input.trim() || busy} aria-label="Kirim" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-action-primary text-ink-inverse transition-colors hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted">
                    <Send aria-hidden="true" size={18} />
                  </button>
                </form>
              </div>
            </>
          )}
          {minimized && lastAssistant && <p className="font-sub line-clamp-2 px-3 pb-3 text-sm">{lastAssistant.text}</p>}
        </m.section>
      )}
    </AnimatePresence>
  );
}
