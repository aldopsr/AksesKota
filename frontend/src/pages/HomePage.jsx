import { Link } from 'react-router-dom';
import { BadgeCheck, Route as RouteIcon, Search, Users } from 'lucide-react';
import { ATTRIBUTE_LABEL, COVERAGE_NOTE, STATUS } from '../features/accessibility/constants';
import { LEVELS, breakdown } from '../features/accessibility/match';
import { AttributeRow, ContributionBadge, MatchBadge } from '../components/status';
import { Alert, LinkButton } from '../components/ui';
import Reveal from '../components/Reveal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';


// Contoh hasil: skor dihitung dari atribut yang ditampilkan, sehingga selalu konsisten dengan datanya.
const EXAMPLE_NEEDS = ['ramp', 'lift', 'accessible_toilet', 'braille'];
const EXAMPLE_ATTRS = [
  { code: 'ramp', status: 'available', notes: 'Di pintu utama, kemiringan landai.' },
  { code: 'lift', status: 'available' },
  { code: 'accessible_toilet', status: 'not_available' },
  { code: 'braille', status: 'unknown' },
];

function HeroCard() {
  const parts = breakdown(EXAMPLE_ATTRS, EXAMPLE_NEEDS);
  const percent = Math.round((parts.met.length / EXAMPLE_NEEDS.length) * 100);
  const byCode = Object.fromEntries(EXAMPLE_ATTRS.map((a) => [a.code, a]));
  return (
    <article aria-label="Contoh tampilan hasil" className="rounded-panel border border-border bg-surface p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold leading-snug">Klinik Contoh Sehat</p>
          <p className="font-sub text-sm text-ink-secondary">Kesehatan · Jl. Contoh No. 1, Bogor</p>
        </div>
        <span className="shrink-0 rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-bold uppercase text-ink-secondary">Contoh</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <MatchBadge level={LEVELS.partial} percent={percent} />
        <span className="font-sub text-sm text-ink-secondary">
          {parts.met.length} dari {EXAMPLE_NEEDS.length} terpenuhi, {parts.unknown.length} belum diketahui
        </span>
      </div>
      <ul className="mt-3 divide-y divide-border rounded-card border border-border px-3">
        {EXAMPLE_NEEDS.map((c) => <AttributeRow key={c} code={c} status={byCode[c].status} note={byCode[c].notes} required />)}
      </ul>
      <p className="font-sub mt-3 text-sm text-ink-secondary">
        Yang belum kami ketahui ditulis apa adanya sebagai <strong className="font-semibold text-ink">?</strong>, tidak pernah dihitung sebagai tersedia.
      </p>
    </article>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:py-12 lg:grid lg:grid-cols-[1fr_27rem] lg:items-start lg:gap-x-14 lg:py-16">
      <div>
        <h1 className="max-w-[16ch] text-4xl font-extrabold sm:text-5xl lg:text-[3.4rem]">
          Cek akses tempatnya sebelum berangkat.
        </h1>
        <p className="font-sub mt-4 max-w-xl text-lg text-ink-secondary">
          Dicocokkan dengan kebutuhan Anda, bukan satu angka untuk semua orang.
        </p>
        <div className="mt-6">
          <LinkButton to="/" size="lg">Buka peta</LinkButton>
        </div>
      </div>
      <div className="lg:pt-2"><HeroCard /></div>
    </section>
  );
}
/* Tiap langkah memperlihatkan potongan antarmuka aslinya, bukan menjelaskannya dengan
   paragraf. Menunjukkan lebih cepat ditangkap daripada menerangkan. */
const STEPS = [
  {
    Icon: Search,
    title: 'Pilih kebutuhan Anda',
    text: 'Sekali ketuk, bukan satu per satu.',
    contoh: ['ramp', 'lift', 'accessible_toilet'].map((c) => ({ label: ATTRIBUTE_LABEL[c] })),
  },
  {
    Icon: BadgeCheck,
    title: 'Lihat kecocokannya',
    text: 'Termasuk yang belum diketahui.',
    contoh: [['ramp', 'available'], ['lift', 'available'], ['accessible_toilet', 'unknown']]
      .map(([c, st]) => ({ label: ATTRIBUTE_LABEL[c], simbol: STATUS[st].symbol, status: STATUS[st].label })),
  },
  {
    Icon: RouteIcon,
    title: 'Buat rute ke sana',
    text: 'Dengan hambatan yang diketahui.',
    contoh: [{ label: '1,2 km · 15 menit · 2 ruas tangga' }],
  },
];
function HowItWorks() {
  return (
    <section id="cara-kerja" aria-labelledby="how-title" className="mx-auto max-w-7xl px-4 py-6">
      <div className="on-dark rounded-panel bg-brand-900 p-6 text-white sm:p-10">
        <Reveal><h2 id="how-title" className="text-3xl font-bold sm:text-4xl">Cara kerja</h2></Reveal>
        <ol className="mt-7 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ Icon, title, text, contoh }, i) => (
            <Reveal as="li" key={title} delay={i * 0.04}>
              <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-control bg-accent-cyan text-brand-900"><Icon size={22} /></span>
              <h3 className="mt-3 text-xl font-semibold"><span className="mr-1.5 text-accent-cyan">{i + 1}.</span>{title}</h3>
              <p className="font-sub mt-1 text-brand-100">{text}</p>
              <ul className="ak-chips mt-3 flex flex-wrap gap-1.5">
                {contoh.map((c, j) => (
                  <li key={c.label} style={{ '--j': j }} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                    {c.simbol && <span aria-hidden="true">{c.simbol}</span>}{c.label}
                    {c.status && <span className="sr-only">: {c.status}</span>}
                  </li>
                ))}
              </ul>
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
          <p className="font-sub mt-2 text-lg text-ink">Tambahkan fasilitas atau perbarui datanya, dengan foto bukti.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton to="/facilities/new">Tambah fasilitas</LinkButton>
            <LinkButton to="/map?intent=update" variant="secondary">Perbarui data fasilitas</LinkButton>
          </div>
        </Reveal>
        <Reveal delay={0.05} className="rounded-panel border border-border bg-surface p-6 sm:p-8">
          <h3 className="text-xl font-semibold">Setiap kontribusi ditinjau admin</h3>
          <p className="font-sub mt-1 text-ink-secondary">Data resmi baru berubah setelah disetujui admin.</p>
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
      <HowItWorks />
      <Community />
      <section aria-label="Cakupan data" className="mx-auto max-w-7xl px-4 pb-4">
        <Alert tone="info" title="Tentang cakupan data">{COVERAGE_NOTE}</Alert>
      </section>
    </>
  );
}
