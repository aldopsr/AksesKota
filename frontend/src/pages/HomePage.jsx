import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, BadgeCheck, Route as RouteIcon, Search, Users } from 'lucide-react';
import { ATTRIBUTE_LABEL, COVERAGE_NOTE } from '../features/accessibility/constants';
import { LEVELS, breakdown } from '../features/accessibility/match';
import { AttributeRow, ContributionBadge, MatchBadge } from '../components/status';
import { Alert, Button, LinkButton, SearchInput } from '../components/ui';
import Reveal from '../components/Reveal';
import { useAssistant } from '../context/AppContexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const QUICK_NEEDS = ['ramp', 'lift', 'accessible_toilet', 'guiding_block', 'wheelchair_path', 'accessible_parking'];

// Contoh hasil: skor dihitung dari atribut yang ditampilkan, sehingga selalu konsisten dengan datanya.
const EXAMPLE_NEEDS = ['ramp', 'lift', 'accessible_toilet', 'braille'];
const EXAMPLE_ATTRS = [
  { code: 'ramp', status: 'available', notes: 'Di pintu utama, kemiringan landai.' },
  { code: 'lift', status: 'available' },
  { code: 'accessible_toilet', status: 'not_available' },
  { code: 'braille', status: 'unknown' },
];

function MapIllustration() {
  return (
    <svg viewBox="0 0 520 420" role="img" aria-label="Ilustrasi peta dengan penanda fasilitas dan garis rute" className="h-auto w-full">
      <rect width="520" height="420" rx="28" fill="#e8e9ff" />
      {/* blok kota (datar, tanpa gradasi) */}
      <rect x="28" y="30" width="150" height="110" rx="16" fill="#d2d4ff" />
      <rect x="210" y="30" width="110" height="78" rx="16" fill="#a8dfe8" />
      <rect x="352" y="30" width="140" height="130" rx="16" fill="#d2d4ff" />
      <rect x="28" y="172" width="104" height="104" rx="16" fill="#fff" />
      <rect x="164" y="140" width="160" height="136" rx="16" fill="#fff" />
      <rect x="356" y="192" width="136" height="84" rx="16" fill="#a8dfe8" />
      <rect x="28" y="308" width="196" height="84" rx="16" fill="#d2d4ff" />
      <rect x="256" y="308" width="236" height="84" rx="16" fill="#fff" />
      {/* rute */}
      <path d="M70 292 C 70 250, 150 290, 190 250 S 280 200, 330 226 S 410 170, 432 120" fill="none" stroke="#4338ca" strokeWidth="7" strokeLinecap="round" strokeDasharray="1 14" />
      {/* titik pengguna */}
      <circle cx="70" cy="292" r="20" fill="#2563eb" opacity=".22" />
      <circle cx="70" cy="292" r="9" fill="#2563eb" stroke="#fff" strokeWidth="3" />
      {/* penanda: sangat sesuai, sebagian, data terbatas */}
      <g stroke="#fff" strokeWidth="4">
        <circle cx="190" cy="250" r="17" fill="#92400e" />
        <circle cx="330" cy="226" r="17" fill="#334155" />
        <circle cx="262" cy="86" r="17" fill="#166534" />
      </g>
      <g fill="#fff" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="17" textAnchor="middle">
        <text x="190" y="256">◐</text><text x="330" y="232">?</text><text x="262" y="92">●</text>
      </g>
      {/* tujuan */}
      <path d="M432 76c-22 0-38 16-38 37 0 28 38 56 38 56s38-28 38-56c0-21-16-37-38-37z" fill="#4f46e5" stroke="#fff" strokeWidth="4" />
      <circle cx="432" cy="113" r="13" fill="#fff" />
    </svg>
  );
}

function Hero() {
  const navigate = useNavigate();
  const assistant = useAssistant();
  const [q, setQ] = useState('');
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-1.5 text-sm font-semibold text-brand-900">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand-700" /> Peta aksesibilitas fasilitas publik
        </p>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-[3.5rem]">
          Cek akses tempatnya <span className="text-brand-700">sebelum berangkat.</span>
        </h1>
        <p className="font-sub mt-4 max-w-xl text-lg text-ink-secondary sm:text-xl">
          Lihat ramp, lift, toilet, guiding block, dan fasilitas lain di rumah sakit, sekolah, kantor layanan, dan tempat umum, dicocokkan dengan kebutuhan Anda.
        </p>

        <SearchInput
          id="home-search" label="Cari fasilitas" className="mt-7 max-w-xl" value={q} onChange={setQ}
          placeholder="Rumah sakit di Bogor…" submitLabel="Jelajahi fasilitas"
          onSubmit={(v) => navigate(v.trim() ? `/map?q=${encodeURIComponent(v.trim())}` : '/map')}
        />
        <div className="mt-3">
          <Button variant="secondary" onClick={assistant.openAssistant}><Bot aria-hidden="true" size={18} /> Cari dengan asisten</Button>
        </div>

        <div className="mt-7">
          <p className="mb-2 font-semibold">Mulai dari kebutuhan Anda</p>
          <ul className="flex flex-wrap gap-2">
            {QUICK_NEEDS.map((c) => (
              <li key={c}><Link to={`/map?needs=${c}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-3.5 text-sm font-semibold hover:bg-surface-subtle">{ATTRIBUTE_LABEL[c]}</Link></li>
            ))}
          </ul>
          <p className="font-sub mt-2 text-sm text-ink-secondary">Anda bisa mengubah atau menambah kebutuhan kapan saja di halaman peta.</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-xl"><MapIllustration /></div>
    </section>
  );
}

function ExampleResult() {
  const parts = breakdown(EXAMPLE_ATTRS, EXAMPLE_NEEDS);
  const total = EXAMPLE_NEEDS.length;
  const percent = Math.round((parts.met.length / total) * 100);
  const byCode = Object.fromEntries(EXAMPLE_ATTRS.map((a) => [a.code, a]));
  return (
    <section aria-labelledby="example-title" className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <Reveal>
          <h2 id="example-title" className="text-3xl font-bold sm:text-4xl">Informasi yang jelas, bukan sekadar angka</h2>
          <p className="font-sub mt-3 text-lg text-ink-secondary">Setiap tempat menampilkan seberapa cocok ia dengan kebutuhan Anda, dan atribut mana yang tersedia, tidak tersedia, atau belum diketahui.</p>
          <ul className="font-sub mt-5 space-y-3 text-ink-secondary">
            {['Tersedia, tidak tersedia, dan belum diketahui dibedakan dengan ikon dan teks.', 'Data yang belum diketahui tidak pernah dihitung sebagai tersedia.', 'Waktu verifikasi terakhir selalu ditampilkan.'].map((t) => (
              <li key={t} className="flex gap-2.5"><BadgeCheck aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700" size={20} />{t}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.05}>
          <article aria-label="Contoh hasil fasilitas" className="rounded-panel border border-border bg-surface p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xl font-bold">Klinik Contoh Sehat</p>
                <p className="font-sub text-ink-secondary">Kesehatan, Jl. Contoh No. 1, Bogor</p>
              </div>
              <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-secondary">Contoh</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <MatchBadge level={LEVELS.partial} percent={percent} />
              <span className="font-sub text-sm text-ink-secondary">{parts.met.length} dari {total} kebutuhan terpenuhi, {parts.unknown.length} belum diketahui</span>
            </div>
            <ul className="mt-3 divide-y divide-border rounded-card border border-border px-3">
              {EXAMPLE_NEEDS.map((c) => <AttributeRow key={c} code={c} status={byCode[c].status} note={byCode[c].notes} required />)}
            </ul>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  { Icon: Search, title: 'Cari dan pilih kebutuhan', text: 'Cari tempat atau jenisnya, lalu pilih fasilitas yang Anda butuhkan. Anda juga bisa menyimpannya sebagai profil.' },
  { Icon: BadgeCheck, title: 'Periksa kecocokan', text: 'Lihat nilai kecocokan, rincian atribut, foto, dan kapan data terakhir diverifikasi.' },
  { Icon: RouteIcon, title: 'Rencanakan rute', text: 'Buat rute jalan kaki dasar ke tujuan. Kondisi di lapangan dapat berubah, jadi tetap berhati-hati.' },
];
function HowItWorks() {
  return (
    <section id="cara-kerja" aria-labelledby="how-title" className="mx-auto max-w-7xl px-4 py-6">
      <div className="on-dark rounded-panel bg-brand-900 p-6 text-white sm:p-10">
        <Reveal><h2 id="how-title" className="text-3xl font-bold sm:text-4xl">Cara kerja</h2></Reveal>
        <ol className="mt-7 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 0.04}>
              <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-control bg-accent-cyan text-brand-900"><Icon size={22} /></span>
              <h3 className="mt-3 text-xl font-semibold"><span className="mr-1.5 text-accent-cyan">{i + 1}.</span>{title}</h3>
              <p className="font-sub mt-1 text-brand-100">{text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Community() {
  return (
    <section aria-labelledby="community-title" className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="rounded-panel bg-accent-cyan p-6 sm:p-8">
          <Users aria-hidden="true" className="text-brand-900" size={28} />
          <h2 id="community-title" className="mt-3 text-3xl font-bold">Data belum ada atau sudah berubah? Bantu perbarui.</h2>
          <p className="font-sub mt-2 text-lg text-ink">Anda bisa menambah fasilitas baru atau mengusulkan pembaruan beserta foto bukti.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton to="/facilities/new">Tambah fasilitas</LinkButton>
            <LinkButton to="/map?intent=update" variant="secondary">Perbarui data fasilitas</LinkButton>
          </div>
        </Reveal>
        <Reveal delay={0.05} className="rounded-panel border border-border bg-surface p-6 sm:p-8">
          <h3 className="text-xl font-semibold">Setiap kontribusi ditinjau admin</h3>
          <p className="font-sub mt-1 text-ink-secondary">Data resmi baru berubah setelah disetujui, sehingga yang Anda lihat dapat dipercaya.</p>
          <ol className="mt-4 space-y-3">
            <li className="flex items-center gap-3"><span className="w-28 shrink-0 text-sm font-semibold text-ink-secondary">1. Anda kirim</span><span className="font-sub text-ink-secondary">Data dan foto bukti</span></li>
            <li className="flex items-center gap-3"><span className="w-28 shrink-0 text-sm font-semibold text-ink-secondary">2. Ditinjau</span><ContributionBadge status="pending" label="Menunggu verifikasi" cls="bg-warning-bg text-warning" /></li>
            <li className="flex flex-wrap items-center gap-3"><span className="w-28 shrink-0 text-sm font-semibold text-ink-secondary">3. Keputusan</span><ContributionBadge status="approved" label="Disetujui" cls="bg-success-bg text-success" /><ContributionBadge status="rejected" label="Ditolak" cls="bg-danger-bg text-danger" /></li>
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export default function HomePage() {
  useDocumentTitle('Cek akses fasilitas sebelum berkunjung');
  return (
    <>
      <Hero />
      <ExampleResult />
      <HowItWorks />
      <Community />
      <section aria-label="Cakupan data" className="mx-auto max-w-7xl px-4 pb-4">
        <Alert tone="info" title="Tentang cakupan data">{COVERAGE_NOTE}</Alert>
      </section>
    </>
  );
}
