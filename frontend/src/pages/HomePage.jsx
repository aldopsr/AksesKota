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
  const navigate = useNavigate();
  const assistant = useAssistant();
  const [q, setQ] = useState('');
  // Di HP urutannya judul -> kartu bukti -> tombol kebutuhan, supaya keluaran produk
  // terlihat tanpa menggulir. Di layar lebar kartu pindah ke kolom kanan dan teks
  // tetap mengalir dari atas ke bawah.
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:py-12 lg:grid lg:grid-cols-[1fr_27rem] lg:items-start lg:gap-x-14 lg:gap-y-8 lg:py-16">
      <div className="lg:col-start-1 lg:row-start-1">
        {/* Tanpa pil kecil di atas judul dan tanpa baris kedua berwarna: dua pola itu
            muncul di hampir setiap halaman buatan generator, dan warna di tengah kalimat
            memotong judul jadi dua benda. Satu warna, satu kalimat. */}
        <h1 className="max-w-[16ch] text-4xl font-extrabold sm:text-5xl lg:text-[3.4rem]">
          Cek akses tempatnya sebelum berangkat.
        </h1>
        <p className="font-sub mt-4 max-w-xl text-lg text-ink-secondary">
          Ramp, lift, toilet, guiding block, dan jalur kursi roda di rumah sakit, sekolah,
          kantor layanan, dan tempat umum — dicocokkan dengan kebutuhan Anda.
        </p>

      </div>

      {/* Barang aslinya, bukan ilustrasi peta dekoratif: komponen yang sama persis
          dengan yang dilihat pengguna nanti. Hero menyatakan tesis dengan menunjukkannya,
          bukan menceritakannya. */}
      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-2"><HeroCard /></div>

      {/* Kebutuhan didahulukan, sama seperti di halaman peta: tanpa itu hasilnya
          tidak bisa dinilai cocok atau tidak. Pencarian teks jadi jalur kedua. */}
      <div className="lg:col-start-1 lg:row-start-2">
        <div>
          <p className="mb-2 font-semibold">Mulai dari kebutuhan Anda</p>
          <ul className="flex flex-wrap gap-2">
            {QUICK_NEEDS.map((c) => (
              <li key={c}><Link to={`/map?needs=${c}`} className="inline-flex min-h-11 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle">{ATTRIBUTE_LABEL[c]}</Link></li>
            ))}
          </ul>
        </div>

        <SearchInput
          id="home-search" label="Atau cari nama tempat" className="mt-6 max-w-xl" value={q} onChange={setQ}
          placeholder="Rumah sakit di Bogor…" submitLabel="Jelajahi fasilitas"
          onSubmit={(v) => navigate(v.trim() ? `/map?q=${encodeURIComponent(v.trim())}` : '/map')}
        />
        <div className="mt-3">
          <Button variant="secondary" onClick={assistant.openAssistant}><Bot aria-hidden="true" size={18} /> Cari dengan asisten</Button>
        </div>
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
      <HowItWorks />
      <Community />
      <section aria-label="Cakupan data" className="mx-auto max-w-7xl px-4 pb-4">
        <Alert tone="info" title="Tentang cakupan data">{COVERAGE_NOTE}</Alert>
      </section>
    </>
  );
}
