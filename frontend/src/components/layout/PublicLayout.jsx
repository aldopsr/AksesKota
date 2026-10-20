import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import { useState } from 'react';
import { ArrowUpRight, BookOpen, Compass, LogOut, Mic, PlusCircle, Search, ShieldCheck, Sparkles, Square, UserRound, ClipboardList, CircleUserRound, ListChecks } from 'lucide-react';
import { CATEGORIES } from '../../features/accessibility/constants';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useAuth } from '../../context/AuthContext';
import { AssistantProvider, LocationProvider, ToastProvider, useAssistant } from '../../context/AppContexts';
import AssistantDock from '../../features/ai/AssistantDock';
import { BrandLink, LogoMark, Wordmark } from './Brand';
import { LinkButton, Menu, buttonClass, menuItemClass } from '../ui';

function RouteAnnouncer() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = setTimeout(() => { const el = document.getElementById('route-announcer'); if (el) el.textContent = document.title; }, 250);
    return () => clearTimeout(t);
  }, [pathname]);
  return <div id="route-announcer" role="status" aria-live="polite" className="sr-only" />;
}

/**
 * Menggulir ke sebuah bagian, dan tetap bekerja ketika URL-nya SUDAH hash itu.
 *
 * Dulu tautannya hanya mengandalkan perubahan lokasi: begitu alamatnya sudah
 * "/#cara-kerja", mengklik tautan yang sama tidak mengubah apa pun, React Router tidak
 * melihat perubahan, dan efek yang menggulir tidak pernah berjalan lagi. Jadi setelah
 * menggulir naik ke peta, tombol "Cara kerja" berhenti berfungsi.
 */
function gulirKeBagian(id) {
  const el = document.getElementById(id);
  if (!el) return false; // bagian itu tidak ada di halaman ini: biarkan Link menavigasi
  const halus = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: halus ? 'smooth' : 'auto' });
  window.history.replaceState(null, '', `#${id}`);
  return true;
}

const navCls = (on) => `inline-flex min-h-11 items-center rounded-control px-3.5 font-semibold transition-colors ${on ? 'bg-brand-100 text-brand-900' : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'}`;

function AccountMenu() {
  const { me, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (me?.name ?? 'A').trim().charAt(0).toUpperCase();
  return (
    <Menu
      label={<span className="max-sm:sr-only sm:max-w-40 sm:truncate">{me?.name ?? 'Akun'}</span>}
      buttonClassName={`${buttonClass('secondary')} pl-1.5 max-sm:px-1.5`}
      icon={() => <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{initial}</span>}
    >
      <Link to="/accessibility-profile" className={menuItemClass}><UserRound aria-hidden="true" size={18} /> Profil aksesibilitas</Link>
      <Link to="/my-contributions" className={menuItemClass}><ListChecks aria-hidden="true" size={18} /> Kontribusi saya</Link>
      {isAdmin && <Link to="/admin" className={menuItemClass}><ShieldCheck aria-hidden="true" size={18} /> Dasbor admin</Link>}
      <div className="my-1 border-t border-border" />
      <button type="button" data-close className={menuItemClass} onClick={() => { signOut(); navigate('/'); }}><LogOut aria-hidden="true" size={18} /> Keluar</button>
    </Menu>
  );
}

/**
 * Header: logo di TENGAH, navigasi di kiri, akun di kanan.
 *
 * Bentuk ini diminta mengikuti acuan, dan kebetulan memecahkan satu masalah nyata:
 * dengan logo di kiri, navigasi dan tombol akun sama-sama berebut sisi kanan dan di
 * layar sedang keduanya saling mendorong. Logo di tengah membagi ruang jadi dua sisi
 * yang masing-masing punya tugas jelas.
 *
 * Di layar sempit tautan navigasinya runtuh jadi satu tombol yang membuka popup —
 * "lebih sederhana, baru muncul saat diklik".
 */
/**
 * Tautan navigasi: teks polos, bukan pil berbingkai.
 *
 * Sebelumnya tiap tautan adalah kapsul beroutline. Tiga kapsul berjajar membuat bilahnya
 * ramai dan — justru — terbaca sebagai halaman generik: outline pil pada navigasi adalah
 * salah satu penanda paling kuat dari tata letak bawaan. Bilah yang terbaca mahal itu
 * justru bilah tanpa perabot: nama, beberapa tautan polos, satu aksi.
 *
 * Keadaan aktif ditandai bobot dan warna tinta, bukan kotak — ditambah garis pendek di
 * bawah supaya tidak hanya mengandalkan warna.
 */
function TautanNav({ to, aktif, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={aktif ? 'page' : undefined}
      className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${
        aktif ? 'border-ink bg-ink text-white' : 'border-border-strong bg-surface text-ink hover:bg-surface-subtle'
      }`}
      style={{ transition: 'color 160ms ease' }}
    >
      {children}
    </Link>
  );
}

/**
 * CTA utama di kanan navbar, meniru tombol gelap berpanah bundar pada acuan.
 *
 * Dulu ia tombol mengambang di atas peta. Dinaikkan ke sini karena roda mouse kini
 * dipakai peta untuk zoom: area peta harus menyisakan sesedikit mungkin hal yang
 * menumpang di atasnya, dan satu-satunya ajakan utama lebih tepat tinggal di navigasi
 * yang selalu terlihat.
 */
function CtaAsisten() {
  const { openAssistant } = useAssistant();
  return (
    <button
      type="button"
      onClick={openAssistant}
      aria-haspopup="dialog"
      className="ak-pil inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-ink py-1 pl-4 pr-1 text-sm font-semibold text-white hover:bg-brand-900"
    >
      <Sparkles aria-hidden="true" size={16} className="sm:hidden" />
      <span className="max-sm:sr-only">Tanya asisten</span>
      <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-white text-ink">
        <ArrowUpRight size={15} />
      </span>

    </button>
  );
}

/**
 * Pencarian di navbar: pil tenang yang baru membuka isinya saat diklik.
 *
 * Sebelumnya ia bilah penuh yang mengambang permanen di atas peta bersama baris
 * kategori — dua baris yang selalu menutupi peta padahal sebagian besar waktu tidak
 * dipakai. Sekarang peta bersih, dan seluruh isian pencarian muncul hanya ketika
 * diminta. Hasilnya tetap lewat URL, jadi tidak ada state yang perlu dibagi dengan
 * halaman peta.
 */
function PencarianNavbar() {
  const navigate = useNavigate();
  const [teks, setTeks] = useState('');
  const suara = useSpeechRecognition({ onFinal: (t) => { setTeks(t); navigate(`/?q=${encodeURIComponent(t)}`); } });
  const cari = (q, kategori) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (kategori) sp.set('category', kategori);
    navigate(`/?${sp.toString()}`);
  };

  return (
    <Menu
      chevron={false}
      align="right"
      lebar="w-[min(22rem,calc(100vw-1.5rem))] max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[4.25rem] max-sm:w-auto"
      buttonClassName="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-ink-secondary hover:bg-surface-subtle"
      icon={() => <Search aria-hidden="true" size={16} />}
      label={<span className="max-sm:sr-only">Cari tempat</span>}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); cari(teks.trim(), ''); }}
        className="p-1.5"
      >
        <label htmlFor="cari-navbar" className="sr-only">Cari nama, kategori, atau lokasi</label>
        <div className="flex items-center gap-1 rounded-control border border-border bg-surface pl-3 pr-1">
          <Search aria-hidden="true" size={16} className="shrink-0 text-ink-secondary" />
          <input
            id="cari-navbar" type="search" autoFocus value={suara.listening && suara.interim ? suara.interim : teks}
            onChange={(e) => setTeks(e.target.value)} placeholder="Cari tempat…"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted"
          />
          {suara.supported && (
            <button
              type="button" onClick={() => (suara.listening ? suara.stop() : suara.start())}
              aria-pressed={suara.listening} aria-label={suara.listening ? 'Selesai bicara' : 'Cari dengan suara'}
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-control ${suara.listening ? 'bg-danger text-white' : 'text-brand-800 hover:bg-brand-100'}`}
            >
              {suara.listening ? <Square aria-hidden="true" size={14} /> : <Mic aria-hidden="true" size={17} />}
            </button>
          )}
        </div>
        {suara.error && <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">{suara.error}</p>}

        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-secondary">Kategori</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.code} type="button" data-close onClick={() => cari(teks.trim(), c.code)}
              className="inline-flex min-h-9 items-center rounded-full border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-subtle"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Lewat URL, bukan state bersama: halaman peta sudah membuka panel kebutuhan
            sendiri ketika melihat parameter ini — pola yang sama dipakai asisten. */}
        <Link to="/?filter=1" className={`${menuItemClass} mt-3 justify-center border border-border`}>
          Atur kebutuhan aksesibilitas
        </Link>
      </form>
    </Menu>
  );
}

function Header() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  // Di "/" peta hanya mengisi layar pertama; begitu pengguna menggulir ke bawah ia
  // sedang membaca halaman biasa, dan di sanalah tombol masuk masuk akal. Jadi sisi
  // kanan bilah ini mengikuti APA YANG SEDANG DILIHAT, bukan sekadar alamatnya.
  const [diHero, setDiHero] = useState(true);
  useEffect(() => {
    if (pathname !== '/') { setDiHero(false); return undefined; }
    const pantau = () => setDiHero(window.scrollY < 200);
    pantau();
    window.addEventListener('scroll', pantau, { passive: true });
    return () => window.removeEventListener('scroll', pantau);
  }, [pathname]);
  const exploring = pathname === '/' || pathname.startsWith('/map')
    || (pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update'));
  const berkontribusi = pathname.startsWith('/facilities/new') || pathname.includes('/update') || pathname.startsWith('/my-contributions');

  const petaTerlihat = (pathname === '/' && diHero) || pathname.startsWith('/map')
    || (pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update'));

  const tautan = (
    <>
      <TautanNav
        to="/" aktif={exploring}
        onClick={(e) => { if (pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); window.history.replaceState(null, '', '/'); } }}
      >
        <Compass aria-hidden="true" size={16} className="mr-1.5" /> Jelajahi
      </TautanNav>
      <TautanNav to="/#cara-kerja" aktif={false} onClick={(e) => { if (gulirKeBagian('cara-kerja')) e.preventDefault(); }}>
        Cara kerja
      </TautanNav>
    </>
  );

  // Navigasi mengikuti acuan Rallyo Club, ditiru dekat, bukan diadaptasi:
  // pil-pil bergaris di kiri, logo menggantung di tab putih di tengah, pencarian dan
  // satu CTA gelap berpanah bundar di kanan — semuanya mengambang dengan margin halaman,
  // bukan bilah penuh yang menempel di tepi atas.
  //
  // Catatan jujur: emil-design-eng menyarankan bilah polos tanpa perabot untuk navigasi,
  // dan versi sebelumnya memang begitu. Bentuk ini dipilih karena diminta mengikuti
  // acuan; kalau nanti terasa ramai, bilah polos itu yang jadi jalan pulangnya.
  const pil = 'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <div className="relative mx-auto flex max-w-7xl items-start gap-2">
        <nav aria-label="Navigasi utama" className="pointer-events-auto hidden items-center gap-2 md:flex">
          <TautanNav to="/" aktif={exploring} onClick={(e) => { if (pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); window.history.replaceState(null, '', '/'); } }}>
            Jelajahi
          </TautanNav>
          <TautanNav to="/#cara-kerja" aktif={false} onClick={(e) => { if (gulirKeBagian('cara-kerja')) e.preventDefault(); }}>
            Cara kerja
          </TautanNav>
          <Menu
            label="Kontribusi" align="left"
            buttonClassName={`${pil} gap-1 ${berkontribusi ? 'border-ink bg-ink text-white' : 'border-border-strong bg-surface text-ink hover:bg-surface-subtle'}`}
          >
            <Link to="/facilities/new" className={menuItemClass}><PlusCircle aria-hidden="true" size={18} /> Tambah fasilitas</Link>
            <Link to="/map?intent=update" className={menuItemClass}><ClipboardList aria-hidden="true" size={18} /> Perbarui data fasilitas</Link>
            {session && <Link to="/my-contributions" className={menuItemClass}><ListChecks aria-hidden="true" size={18} /> Kontribusi saya</Link>}
          </Menu>
        </nav>

        {/* Tab logo: menggantung dari tepi atas, sudut bawahnya membulat — bentuk inilah
            tanda paling khas acuan itu. Diposisikan absolut supaya benar-benar di tengah
            viewport dan tidak bergeser saat tombol kanan berubah. */}
        <Link
          to="/"
          aria-label="AksesKota, ke beranda"
          className="pointer-events-auto absolute left-0 top-0 z-10 flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 md:-top-3 md:left-1/2 md:-translate-x-1/2 md:rounded-b-[1.5rem] md:rounded-t-none md:px-7 md:pb-3.5 md:pt-7"
        >
          <LogoMark size={26} />
          <span className="text-base font-extrabold tracking-tight">AksesKota</span>
        </Link>

        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          {petaTerlihat && <PencarianNavbar />}
          <CtaAsisten />
          {session ? <AccountMenu /> : !petaTerlihat && (
            <Link to="/login" className={`${pil} border-border-strong bg-surface text-ink hover:bg-surface-subtle`}>
              <span className="sm:hidden">Masuk</span>
              <span className="max-sm:hidden">Masuk atau daftar</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  // Empat, bukan tiga: "Cara kerja" dipindah ke sini dari menu popup di bilah atas.
  // Sejak peta menahan gulir, tautan itu satu-satunya jalan turun ke penjelasan — ia
  // tidak boleh bersembunyi di balik ketukan kedua.
  //
  // Keaktifan dihitung sendiri, bukan diserahkan ke NavLink: "Cara kerja" menunjuk ke
  // /#cara-kerja, dan NavLink hanya melihat pathname-nya — jadi di beranda ia menyala
  // sementara "Jelajahi" justru padam. Ia memang bagian dari halaman, bukan halaman.
  const items = [
    { to: '/', label: 'Jelajahi', Icon: Compass, aktif: pathname === '/' || pathname.startsWith('/map') || (pathname.startsWith('/facilities/') && !pathname.startsWith('/facilities/new')) },
    { to: '/#cara-kerja', label: 'Cara kerja', Icon: BookOpen, aktif: false },
    { to: '/facilities/new', label: 'Kontribusi', Icon: PlusCircle, aktif: pathname.startsWith('/facilities/new') || pathname.startsWith('/my-contributions') },
    session
      ? { to: '/accessibility-profile', label: 'Profil', Icon: UserRound, aktif: pathname.startsWith('/accessibility-profile') }
      : { to: '/login', label: 'Masuk', Icon: CircleUserRound, aktif: pathname === '/login' || pathname === '/register' },
  ];
  return (
    <nav aria-label="Navigasi bawah" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ to, label, Icon, aktif }) => (
          <li key={label}>
            <Link
              to={to}
              aria-current={aktif ? 'page' : undefined}
              onClick={(e) => { if (label === 'Cara kerja' && gulirKeBagian('cara-kerja')) e.preventDefault(); }}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${aktif ? 'text-brand-800' : 'text-ink-secondary'}`}
            >
              <Icon aria-hidden="true" size={21} /> <span className="text-xs">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-surface pb-16 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_auto_1.3fr]">
        <div>
          <BrandLink size={30} />
          <p className="font-sub mt-2 max-w-xs text-ink-secondary">Cek dulu aksesnya, baru berangkat.</p>
        </div>
        <nav aria-label="Tautan footer">
          <ul className="font-semibold">
            {[['/map', 'Jelajahi fasilitas'], ['/facilities/new', 'Tambah fasilitas'], ['/#cara-kerja', 'Cara kerja']].map(([to, label]) => (
              <li key={to}><Link to={to} className="inline-flex min-h-11 items-center text-ink-secondary hover:text-brand-800">{label}</Link></li>
            ))}
          </ul>
        </nav>
        <p className="font-sub text-sm text-ink-secondary">
          Informasi aksesibilitas berasal dari data yang dipetakan dan kontribusi pengguna yang telah diverifikasi. Kondisi di lapangan dapat berubah, dan AksesKota tidak menjamin suatu fasilitas atau rute sepenuhnya bebas hambatan.
        </p>
      </div>

      {/* Kredit gambar: kewajiban lisensi CC BY, bukan hiasan. Tautan ke halaman sumber
          dan ke teks lisensinya harus tetap bisa diklik. */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <p className="font-sub text-sm text-ink-secondary">
          Foto arsip jalanan Bogor:{' '}
          <a href="https://commons.wikimedia.org/w/index.php?curid=85691345" className="underline underline-offset-2 hover:text-brand-800">“Straat inbij Buitenzorg (huidige Bogor), West-Java”</a> oleh Rijksmuseum, <a href="https://creativecommons.org/publicdomain/zero/1.0/deed.en/" className="underline underline-offset-2 hover:text-brand-800">CC0</a>;{' '}
          <a href="https://commons.wikimedia.org/w/index.php?curid=105307930" className="underline underline-offset-2 hover:text-brand-800">“Eetstalletjes aan de Roode Brug te Buitenzorg, KITLV 18920”</a>;{' '}
          <a href="https://commons.wikimedia.org/w/index.php?curid=101307482" className="underline underline-offset-2 hover:text-brand-800">“Straat te Buitenzorg met het paleis van de gouverneur-generaal, KITLV A1219”</a>, keduanya <a href="https://creativecommons.org/licenses/by/4.0/" className="underline underline-offset-2 hover:text-brand-800">CC BY 4.0</a> — semuanya via Wikimedia Commons.
        </p>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname, hash } = useLocation();
  // "Workspace" = kerangka aplikasi yang mengisi layar penuh dan TIDAK menggulir.
  //
  // "/" sengaja TIDAK termasuk: di sana peta hanya jadi hero setinggi satu layar, lalu
  // halaman berlanjut ke bagian Cara kerja dan Komunitas — jadi ia memang harus bisa
  // digulir. Alamat /map dan /facilities/:id tetap kerangka aplikasi murni tanpa
  // bagian landing, untuk pengguna yang datang langsung ke petanya.
  const beranda = pathname === '/';
  const workspace = pathname.startsWith('/map')
    || (pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update'));
  const showBottomNav = !pathname.startsWith('/admin');
  const section = workspace ? 'explore' : pathname.split('/')[1] || 'home';

  useEffect(() => {
    // Menggulir halus, bukan melompat: inilah yang diminta terjadi saat "Cara kerja"
    // diklik dari navigasi. Diabaikan bila pengguna meminta gerakan dikurangi.
    if (hash) {
      const halus = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: halus ? 'smooth' : 'auto' }), 60);
    } else if (!workspace) window.scrollTo(0, 0);
  }, [pathname, hash, workspace]);

  return (
    <LocationProvider>
      <AssistantProvider>
        <ToastProvider>
          {/* Tinggi dipegang kerangka ini, bukan dihitung ulang tiap halaman dengan
              calc(100dvh - tinggi header - tinggi nav). Angka ajaib seperti itu yang
              bikin peta meleset 64 px begitu bilah nav bawah muncul. */}
          <div className={`flex flex-col ${workspace ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-brand-900 focus:px-4 focus:py-3 focus:font-semibold focus:text-white">
              Lewati ke konten utama
            </a>
            <Header />
            {/* Navbar kini fixed dan tidak memakan ruang; halaman yang BUKAN hero peta
                harus menyediakan ruangnya sendiri. Hero peta tidak: di sana navbar
                memang harus mengambang di atas petanya, seperti pada acuan. */}
            <main id="main" tabIndex={-1} className={`flex-1 outline-none ${workspace ? 'min-h-0' : ''} ${beranda || workspace ? '' : 'pt-[4.75rem]'} ${showBottomNav ? 'pb-16 md:pb-0' : ''}`}>
              <m.div key={section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className={workspace ? 'h-full' : undefined}>
                <Outlet />
              </m.div>
            </main>
            {!workspace && <Footer />}
            {showBottomNav && <BottomNav />}
            <AssistantDock />
            <RouteAnnouncer />
          </div>
        </ToastProvider>
      </AssistantProvider>
    </LocationProvider>
  );
}
