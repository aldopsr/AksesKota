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

/* gulirKeBagian() dulu ada di sini: ia membatalkan navigasi Link lalu memanggil
   history.replaceState untuk menyelaraskan URL tanpa render ulang — masuk akal ketika
   peta dan penjelasan masih satu dokumen yang digulir.
   Sejak halaman depan dipecah jadi dua keadaan (peta "/" dan penjelasan
   "/#cara-kerja"), hash bukan lagi penanda posisi gulir melainkan MODE, dan
   replaceState mengubahnya di belakang punggung React Router: URL berubah, komponen
   tidak pernah dirender ulang, petanya tidak pernah kembali. Terukur: renderUlang
   false padahal URL sudah "/". Navigasinya kini diserahkan penuh ke Link. */

/* ---------- gaya bersama bilah atas ----------
   Permukaan mengambang dipisahkan dari peta oleh BAYANGAN lembut dan kaca buram, bukan
   garis tepi tebal di tiap tombol. */
const kaca = 'bg-white/85 ring-1 ring-black/5 shadow-panel backdrop-blur-xl';

// Pindah ke awal halaman penjelasan. Dipakai saat "Cara kerja" diklik ketika sudah berada
// di sana: alamatnya tidak berubah, jadi efek di PublicLayout tidak akan berjalan lagi.
const keAwalHalaman = () => {
  const halus = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: halus ? 'smooth' : 'auto' });
};

// Penanda aktif: satu pil gelap yang MELUNCUR ke item aktif (layoutId). Z negatif di dalam
// elemen `isolate` supaya berada di bawah teks dan ikon panah menu. Otomatis dilewati bila
// pengguna memilih mengurangi gerakan (MotionConfig reducedMotion="user").
const penandaAktif = (
  <m.span
    layoutId="nav-aktif" aria-hidden="true"
    className="absolute inset-0 -z-10 rounded-full bg-ink"
    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
  />
);
const itemNav = (aktif) => `relative isolate inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors duration-200 focus-visible:rounded-full max-lg:min-w-11 lg:px-4 ${
  aktif ? 'text-white' : 'text-ink-secondary hover:bg-black/5 hover:text-ink'
}`;
// Di bawah lg dock hanya memuat ikon; item yang AKTIF tetap menampilkan namanya supaya
// pengguna tahu sedang di mana. Nama item lain tetap ada untuk pembaca layar (sr-only).
const labelNav = (aktif) => (aktif ? '' : 'max-lg:sr-only');

function AccountMenu() {
  const { me, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (me?.name ?? 'A').trim().charAt(0).toUpperCase();
  return (
    <Menu
      // Nama hanya tampil di layar sangat lebar; selebihnya cukup avatar. Nama panjang
      // adalah penyumbang terbesar tabrakan antara tombol-tombol di kanan dan logo.
      label={<span className="sr-only 2xl:not-sr-only 2xl:max-w-40 2xl:truncate">{me?.name ?? 'Akun'}</span>}
      buttonClassName={`${kaca} inline-flex min-h-12 items-center gap-2 rounded-full pl-1.5 pr-1.5 text-sm font-semibold text-ink transition-colors hover:bg-white focus-visible:rounded-full 2xl:pr-4`}
      icon={() => <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{initial}</span>}
    >
      <Link to="/accessibility-profile" className={menuItemClass}><UserRound aria-hidden="true" size={18} /> Profil aksesibilitas</Link>
      <Link to="/my-contributions" className={menuItemClass}><ListChecks aria-hidden="true" size={18} /> Kontribusi saya</Link>
      {isAdmin && <Link to="/admin" className={menuItemClass}><ShieldCheck aria-hidden="true" size={18} /> Dasbor admin</Link>}
      <div className="my-1 border-t border-border" />
      <button type="button" data-close className={menuItemClass} onClick={() => { signOut(); navigate('/'); }}><LogOut aria-hidden="true" size={18} /> Keluar</button>
    </Menu>
  );
}

function TautanNav({ to, aktif, Ikon, children, onClick }) {
  return (
    <Link to={to} onClick={onClick} aria-current={aktif ? 'page' : undefined} className={itemNav(aktif)}>
      {aktif && penandaAktif}
      <Ikon aria-hidden="true" size={18} className="shrink-0 lg:hidden" />
      <span className={labelNav(aktif)}>{children}</span>
    </Link>
  );
}

/**
 * CTA utama di kanan. Di bawah lg ia tombol bundar berikon (48 px); mulai lg ia tombol
 * gelap berlabel dengan panah bundar yang bergeser sedikit saat disorot.
 */
function CtaAsisten() {
  const { openAssistant } = useAssistant();
  return (
    <button
      type="button"
      onClick={openAssistant}
      aria-haspopup="dialog"
      className=" ak-pil group inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-full bg-ink text-sm font-semibold text-white shadow-panel transition-colors hover:bg-brand-900 focus-visible:rounded-full max-lg:w-12 lg:py-1 lg:pl-5 lg:pr-1"
    >
      <Sparkles aria-hidden="true" size={19} className="lg:hidden" />
      <span className="max-lg:sr-only">Tanya asisten</span>
      <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-full bg-white text-ink max-lg:hidden">
        <ArrowUpRight size={16} className="transition-transform duration-200 motion-safe:group-hover:-translate-y-px motion-safe:group-hover:translate-x-px" />
      </span>
    </button>
  );
}

/**
 * Pencarian di navbar: kapsul kaca yang baru membuka isinya saat diklik. Di bawah xl ia
 * menyusut jadi tombol ikon bundar 48 px.
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
      buttonClassName={`${kaca} mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white hover:text-ink focus-visible:rounded-full max-xl:w-12 max-xl:px-0`}
      icon={() => <Search aria-hidden="true" size={18} />}
      label={<span className="max-xl:sr-only">Cari tempat</span>}
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
              className="inline-flex min-h-9 items-center rounded-full bg-surface-subtle px-3 text-sm font-semibold transition-colors hover:bg-brand-100"
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

/**
 * Header: tiga kolom grid — dock navigasi | logo | aksi (pencarian, asisten, akun).
 *
 * Dulu logo diposisikan absolut di tengah viewport sementara kiri dan kanan mengalir bebas,
 * jadi tidak ada yang menjaga ketiganya agar tidak saling tindih: di lebar menengah dock
 * navigasi menabrak pencarian dan logo. Kolom `1fr auto 1fr` memberi sisi kiri dan kanan
 * lebar yang SAMA dan logo tepat di tengah, dan tiap sisi menyusut bertahap sesuai lebar
 * (label disembunyikan, pencarian jadi ikon, nama akun dihilangkan) sampai isinya muat:
 *
 *   < md   logo di kiri, aksi di kanan (navigasi pindah ke bilah bawah)
 *   md–lg  dock berisi ikon (yang aktif menampilkan nama), semua aksi berupa ikon bundar
 *   lg–xl  dock berlabel, asisten berlabel, pencarian tetap ikon
 *   xl+    pencarian berlabel; nama akun baru tampil di 2xl
 */
/**
 * Dua tujuan navbar yang sebenarnya satu halaman: "Jelajahi" dan "Cara kerja".
 *
 * Keduanya menunjuk ke "/" — bedanya hanya hash. Karena itu kuerinya HARUS ikut
 * terbawa: di layar sempit, pergi ke penjelasan lalu kembali ke Jelajahi tadinya
 * membuang ?q= beserta filternya, dan panel hasil yang baru saja dilihat pengguna
 * hilang tanpa sebab yang terlihat. Kueri hanya dibawa dari "/" sendiri; dari halaman
 * lain ia milik halaman itu, bukan milik peta.
 */
function useTautanBeranda() {
  const { pathname, search } = useLocation();
  const kueri = pathname === '/' ? search : '';
  return { jelajahi: { pathname: '/', search: kueri }, caraKerja: { pathname: '/', search: kueri, hash: '#cara-kerja' } };
}

function Header() {
  const { session } = useAuth();
  const { pathname, hash } = useLocation();
  const tujuan = useTautanBeranda();
  const [diHero, setDiHero] = useState(true);
  useEffect(() => {
    if (pathname !== '/') { setDiHero(false); return undefined; }
    const pantau = () => setDiHero(window.scrollY < 200);
    pantau();
    window.addEventListener('scroll', pantau, { passive: true });
    return () => window.removeEventListener('scroll', pantau);
  }, [pathname]);

  // "/#cara-kerja" = halaman penjelasan tanpa peta: di sana "Cara kerja" yang menyala.
  const caraKerja = pathname === '/' && hash === '#cara-kerja';
  const detailFasilitas = pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update');
  const exploring = (pathname === '/' && !caraKerja) || pathname.startsWith('/map') || detailFasilitas;
  const berkontribusi = pathname.startsWith('/facilities/new') || pathname.includes('/update') || pathname.startsWith('/my-contributions');
  const petaTerlihat = (pathname === '/' && diHero && !caraKerja) || pathname.startsWith('/map') || detailFasilitas;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)] items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <nav aria-label="Navigasi utama" className={`mt-1 pointer-events-auto hidden items-center gap-0.5 justify-self-start rounded-full p-0.5 md:flex ${kaca}`}>
          <TautanNav to={tujuan.jelajahi} aktif={exploring} Ikon={Compass}>Jelajahi</TautanNav>
          {/* Sudah di halaman penjelasan: klik lagi membawa ke awalnya. Dari tempat lain
              ia berpindah ke "/#cara-kerja", dan PublicLayout menampilkannya dari atas. */}
          <TautanNav
            to={tujuan.caraKerja} aktif={caraKerja} Ikon={BookOpen}
            onClick={(e) => { if (caraKerja) { e.preventDefault(); keAwalHalaman(); } }}
          >
            Cara kerja
          </TautanNav>
          <Menu
            label={<>{berkontribusi && penandaAktif}<PlusCircle aria-hidden="true" size={18} className="shrink-0 lg:hidden" /><span className={labelNav(berkontribusi)}>Kontribusi</span></>}
            align="left" buttonClassName={itemNav(berkontribusi)}
          >
            <Link to="/facilities/new" className={menuItemClass}><PlusCircle aria-hidden="true" size={18} /> Tambah fasilitas</Link>
            <Link to="/map?intent=update" className={menuItemClass}><ClipboardList aria-hidden="true" size={18} /> Perbarui data fasilitas</Link>
            {session && <Link to="/my-contributions" className={menuItemClass}><ListChecks aria-hidden="true" size={18} /> Kontribusi saya</Link>}
          </Menu>
        </nav>

        {/* Tab logo: menggantung dari tepi atas layar. Di md ke atas bahunya melebar
            lewat dua pseudo-elemen (kuadran lingkaran terbalik) sehingga tab terlihat
            tumbuh dari tepi atas, bukan kotak yang ditempel. Di bawah md ia kapsul kaca
            biasa. Wordmark disembunyikan di bawah 380 px agar tidak menabrak aksi. */}
        <Link
          to="/"
          aria-label="AksesKota, ke beranda"
          className="pointer-events-auto relative flex min-h-12 items-center gap-2 justify-self-center rounded-full bg-white/85 px-4 ring-1 ring-black/5 shadow-panel backdrop-blur-xl md:-mt-3 md:min-h-0 md:rounded-b-[1.75rem] md:rounded-t-none md:bg-surface md:px-8 md:pb-4 md:pt-7 md:shadow-none md:ring-0 md:backdrop-blur-none md:before:absolute md:before:-left-4 md:before:top-0 md:before:size-4 md:before:bg-[radial-gradient(circle_at_0_100%,transparent_16px,var(--color-surface)_16.5px)] md:after:absolute md:after:-right-4 md:after:top-0 md:after:size-4 md:after:bg-[radial-gradient(circle_at_100%_100%,transparent_16px,var(--color-surface)_16.5px)] max-md:justify-self-start"
        >
          <LogoMark size={26} />
          <span className="text-base font-extrabold tracking-tight max-[380px]:sr-only">AksesKota</span>
        </Link>

        <div className="pointer-events-auto flex items-center gap-2 justify-self-end">
          {petaTerlihat && <PencarianNavbar />}
          <CtaAsisten />
          {session ? <AccountMenu /> : !petaTerlihat && (
            <Link to="/login" className={`${kaca} inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-ink transition-colors hover:bg-white focus-visible:rounded-full`}>
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
  const { pathname, hash } = useLocation();
  const tujuan = useTautanBeranda();
  // Empat, bukan tiga: "Cara kerja" ada di sini karena sejak peta menahan gulir, tautan itu
  // satu-satunya jalan ke penjelasan — ia tidak boleh bersembunyi di balik ketukan kedua.
  //
  // Keaktifan dihitung sendiri, bukan diserahkan ke NavLink: "Cara kerja" menunjuk ke
  // /#cara-kerja dan NavLink hanya melihat pathname-nya, jadi di beranda ia menyala sementara
  // "Jelajahi" justru padam. "/" dengan hash itu adalah halaman penjelasan, dan di sana
  // "Cara kerja" yang aktif — bukan "Jelajahi".
  const caraKerja = pathname === '/' && hash === '#cara-kerja';
  const items = [
    { to: tujuan.jelajahi, label: 'Jelajahi', Icon: Compass, aktif: (pathname === '/' && !caraKerja) || pathname.startsWith('/map') || (pathname.startsWith('/facilities/') && !pathname.startsWith('/facilities/new')) },
    { to: tujuan.caraKerja, label: 'Cara kerja', Icon: BookOpen, aktif: caraKerja, onClick: (e) => { if (caraKerja) { e.preventDefault(); keAwalHalaman(); } } },
    { to: '/facilities/new', label: 'Kontribusi', Icon: PlusCircle, aktif: pathname.startsWith('/facilities/new') || pathname.startsWith('/my-contributions') },
    session
      ? { to: '/accessibility-profile', label: 'Profil', Icon: UserRound, aktif: pathname.startsWith('/accessibility-profile') }
      : { to: '/login', label: 'Masuk', Icon: CircleUserRound, aktif: pathname === '/login' || pathname === '/register' },
  ];
  return (
    <nav aria-label="Navigasi bawah" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ to, label, Icon, aktif, onClick }) => (
          <li key={label}>
            <Link
              to={to}
              onClick={onClick}
              aria-current={aktif ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors ${aktif ? 'text-brand-900' : 'text-ink-secondary'}`}
            >
              {/* Penanda aktif: pil di belakang ikon yang meluncur antar tab. */}
              <span className="relative inline-flex h-8 w-14 items-center justify-center">
                {aktif && (
                  <m.span
                    layoutId="bn-aktif" aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-brand-100"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <Icon aria-hidden="true" size={21} className="relative" />
              </span>
              <span className="text-xs">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  // Ajakan "Tambah fasilitas" hanya di halaman utama.
  //
  // Di halaman lain ia salah tempat sampai mengganggu: pada formulir tambah fasilitas
  // ia mengajak melakukan hal yang SEDANG dikerjakan pengguna, dan di halaman detail
  // ia bersaing dengan "Usulkan pembaruan" yang jauh lebih tepat di sana. Ajakan
  // penutup masuk akal ketika orang baru selesai membaca penjelasan, bukan ketika ia
  // sedang di tengah pekerjaan.
  const beranda = useLocation().pathname === '/';
  return (
    /* Satu blok penutup gelap: ajakan + tautan + legal, bukan dua blok berturut-turut.
       Halaman depan sebelumnya berakhir dengan CTA gelap setinggi hampir satu layar,
       lalu footer terang menempel di bawahnya — dua penutup beruntun, dan yang kedua
       terbaca seperti sisa yang menggantung. Acuan menyatukannya: ajakan dan footer
       adalah satu permukaan. Gelap, karena penutup halaman harus terasa seperti dasar,
       bukan seperti bagian berikutnya yang kebetulan habis. */
    <footer className="on-dark bg-ink text-white pb-16 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        {/* Ajakan. Satu-satunya tombol di seluruh footer, jadi tidak ada yang bersaing
            dengannya — persis saran "single CTA focus". */}
        {beranda && (
        <div className="grid gap-8 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-7">
            <h2 className="max-w-[13ch] text-title font-extrabold leading-[0.95] tracking-[-0.035em]">
              Datanya belum lengkap
            </h2>
            <p className="font-sub mt-5 max-w-[46ch] text-lead leading-snug text-brand-100">
              Tambahkan fasilitas atau perbarui datanya dengan foto bukti. Setiap kiriman
              ditinjau admin sebelum data resmi berubah.
            </p>
          </div>
          <div className="sm:col-span-4 sm:col-start-9">
            <Link
              to="/facilities/new"
              className="ak-pil flex min-h-14 w-full items-center justify-center rounded-control bg-accent-cyan px-6 text-base font-bold text-ink hover:brightness-95"
            >
              Tambah fasilitas
            </Link>
          </div>
        </div>
        )}

        {/* Garis pemisah dan jaraknya hanya berarti kalau ada ajakan di atasnya. */}
        <div className={`grid gap-10 sm:grid-cols-12 ${beranda ? 'mt-16 border-t border-white/15 pt-12' : ''}`}>
          <div className="sm:col-span-5">
            <BrandLink size={30} light />
            <p className="font-sub mt-4 max-w-[28ch] text-brand-100">Cek dulu aksesnya, baru berangkat.</p>
          </div>

          <nav aria-label="Tautan footer" className="grid grid-cols-2 gap-8 sm:col-span-5 sm:col-start-8">
            {[
              ['Jelajahi', [['/map', 'Peta fasilitas'], ['/#cara-kerja', 'Cara kerja'], ['/accessibility-profile', 'Profil kebutuhan']]],
              ['Kontribusi', [['/facilities/new', 'Tambah fasilitas'], ['/my-contributions', 'Kontribusi saya']]],
            ].map(([judul, tautan]) => (
              <div key={judul}>
                <h2 className="font-sub text-xs font-bold uppercase tracking-wide text-brand-300">{judul}</h2>
                <ul className="mt-1">
                  {tautan.map(([to, label]) => (
                    <li key={to}>
                      <Link to={to} className="inline-flex min-h-11 items-center font-semibold text-white hover:text-accent-cyan">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="font-sub mt-12 max-w-[72ch] text-sm leading-relaxed text-brand-100">
          Informasi aksesibilitas berasal dari data yang dipetakan dan kontribusi pengguna yang telah diverifikasi.
          Kondisi di lapangan dapat berubah, dan AksesKota tidak menjamin suatu fasilitas atau rute sepenuhnya bebas hambatan.
        </p>

        {/* Kredit gambar: KEWAJIBAN lisensi CC BY, bukan hiasan. Kecil boleh, hilang tidak. */}
        <div className="mt-10 flex flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-sub text-sm text-brand-100">© {new Date().getFullYear()} AksesKota</p>
          <p className="font-sub max-w-[62ch] text-xs leading-relaxed text-brand-100">
            Foto arsip: <a href="https://commons.wikimedia.org/w/index.php?curid=101307482" className="underline underline-offset-2 hover:text-white">“Straat te Buitenzorg met het paleis van de gouverneur-generaal, KITLV A1219”</a>, <a href="https://creativecommons.org/licenses/by/4.0/" className="underline underline-offset-2 hover:text-white">CC BY 4.0</a> via Wikimedia Commons.
          </p>
        </div>
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
  // Halaman depan punya dua keadaan (lihat ExplorePage): "/" peta layar penuh, dan
  // "/#cara-kerja" penjelasan tanpa peta. Yang pertama berperilaku seperti /map —
  // layar penuh, tidak menggulir, tanpa footer; yang kedua halaman biasa.
  const landingTerbuka = beranda && hash === '#cara-kerja';
  const workspace = pathname.startsWith('/map')
    || (pathname.startsWith('/facilities') && !pathname.startsWith('/facilities/new') && !pathname.includes('/update'));
  const showBottomNav = !pathname.startsWith('/admin');
  // Layar penuh tanpa gulir: /map, /facilities/:id, dan "/" selagi masih berupa peta.
  const layarPenuh = workspace || (beranda && !landingTerbuka);
  const section = workspace ? 'explore' : pathname.split('/')[1] || 'home';

  useEffect(() => {
    // "Cara kerja" membuka halaman penjelasan dari AWALNYA (hero), bukan melompat ke
    // bagian "Cara kerja" di tengahnya. Dua kali dicoba: sekali langsung, sekali setelah
    // tata letak berganti dari layar-penuh ke halaman biasa.
    if (landingTerbuka) {
      window.scrollTo(0, 0);
      const t = setTimeout(() => window.scrollTo(0, 0), 60);
      return () => clearTimeout(t);
    }
    // Menggulir halus, bukan melompat. Diabaikan bila pengguna meminta gerakan dikurangi.
    // "/#cara-kerja" = halaman penjelasan: tampilkan dari AWALNYA (hero), bukan melompat
    // ke bagian "Cara kerja" di tengahnya. Hash-nya penanda MODE halaman, bukan posisi gulir.
    if (pathname === '/' && hash === '#cara-kerja') {
      window.scrollTo(0, 0);
      return undefined;
    }
    if (hash) {
      const halus = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Dicoba beberapa kali, bukan sekali setelah 60 ms.
      //
      // Membuka /#cara-kerja langsung (muat dingin) sebelumnya berakhir di hero: pada
      // 60 ms halaman masih setinggi hero karena peta, foto, dan tabel di bawahnya
      // belum selesai menata diri, jadi gulirannya tidak ke mana-mana — terukur
      // scrollY 0 padahal bagiannya ada di 2065. Percobaan berhenti begitu bagian itu
      // benar-benar berada di dekat puncak layar.
      const jadwal = [60, 300, 700, 1200].map((ms) => setTimeout(() => {
        const el = document.getElementById(hash.slice(1));
        if (!el) return;
        const atas = el.getBoundingClientRect().top;
        if (Math.abs(atas) < 80) return; // sudah di tempat
        el.scrollIntoView({ behavior: halus ? 'smooth' : 'auto' });
      }, ms));
      return () => jadwal.forEach(clearTimeout);
    }
    if (!workspace) window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash, workspace, landingTerbuka]);

  return (
    <LocationProvider>
      <AssistantProvider>
        <ToastProvider>
          {/* Tinggi dipegang kerangka ini, bukan dihitung ulang tiap halaman dengan
              calc(100dvh - tinggi header - tinggi nav). Angka ajaib seperti itu yang
              bikin peta meleset 64 px begitu bilah nav bawah muncul. */}
          {/* overflow-clip, BUKAN overflow-hidden. Keduanya memotong isi yang meluber,
              tapi hidden membuat kotaknya BISA digulir secara programatik — dan panel
              bawah di ponsel digeser dengan transform, yang memperlebar area gulir
              cangkang ini sampai ~1340 px. Akibatnya browser menggulir seluruh aplikasi
              258 px ke atas begitu tombol di bagian panel yang di luar layar menerima
              fokus: peta, navbar, dan banner "Klik peta untuk menentukan titik awal"
              ikut terbawa keluar layar. overflow-clip tidak pernah jadi wadah gulir. */}
          <div className={`flex flex-col ${layarPenuh ? 'h-dvh overflow-clip' : 'min-h-dvh'}`}>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-brand-900 focus:px-4 focus:py-3 focus:font-semibold focus:text-white">
              Lewati ke konten utama
            </a>
            <Header />
            {/* Navbar kini fixed dan tidak memakan ruang; halaman yang BUKAN hero peta
                harus menyediakan ruangnya sendiri. Hero peta tidak: di sana navbar
                memang harus mengambang di atas petanya, seperti pada acuan. */}
            <main id="main" tabIndex={-1} className={`flex-1 outline-none ${layarPenuh ? 'min-h-0 pt-0' : 'pt-[4.75rem]'} ${showBottomNav ? 'pb-16 md:pb-0' : ''}`}>
              <m.div key={section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className={layarPenuh ? 'h-full' : undefined}>
                <Outlet />
              </m.div>
            </main>
            {!layarPenuh && <Footer />}
            {showBottomNav && <BottomNav />}
            <AssistantDock />
            <RouteAnnouncer />
          </div>
        </ToastProvider>
      </AssistantProvider>
    </LocationProvider>
  );
}
