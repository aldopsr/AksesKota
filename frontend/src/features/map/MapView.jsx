import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { KeyRound } from 'lucide-react';
import { clearRoute, drawRoute } from './route';
import { ambilJalur, isiJalur, lepasJalur, pasangJalur, perluMuatUlang } from './jalur';
import { isiJangkauan, lepasJangkauan, pasangJangkauan } from './jangkauan';
import { IKON_KATEGORI_NODE } from '../accessibility/icon-nodes';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (TOKEN) mapboxgl.accessToken = TOKEN;
export const mapAvailable = !!TOKEN;

function NoToken() {
  return (
    <div className="flex size-full items-center justify-center bg-surface-subtle p-6">
      <div className="max-w-md rounded-panel border border-border bg-surface p-5 shadow-panel">
        <p className="flex items-center gap-2 text-lg font-semibold"><KeyRound aria-hidden="true" size={20} /> Peta belum dapat ditampilkan</p>
        <p className="font-sub mt-2 text-ink-secondary">
          Token Mapbox belum diisi (<code className="rounded bg-surface-subtle px-1">VITE_MAPBOX_TOKEN</code> di <code className="rounded bg-surface-subtle px-1">.env.local</code>). Daftar hasil di samping tetap bisa dipakai.
        </p>
      </div>
    </div>
  );
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ikon kategori sebagai SVG, dibangun dari geometri lucide yang sama dengan kartu. */
function ikonKategori(code) {
  const node = IKON_KATEGORI_NODE[code] ?? IKON_KATEGORI_NODE._default;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '17');
  svg.setAttribute('height', '17');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  node.forEach(([tag, attr]) => {
    const anak = document.createElementNS(SVG_NS, tag);
    Object.entries(attr).forEach(([k, v]) => anak.setAttribute(k, String(v)));
    svg.append(anak);
  });
  return svg;
}

function markerElement(facility, level, onSelect) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ak-marker';
  // Isi penanda: ikon KATEGORI, bukan lambang tingkat.
  //
  // Lambang ●◐○? dulu mengulang apa yang sudah dikatakan BENTUK penanda — dua tanda
  // untuk satu informasi, sementara "ini rumah sakit atau mal?" tidak terjawab sama
  // sekali. Sekarang tiap tanda memikul satu makna: bentuk + warna = seberapa cocok,
  // ikon = tempat apa. Jaminan PRD 13 tetap utuh karena tingkat tidak pernah
  // bergantung pada warna saja — bentuknya berbeda per tingkat, dan namanya ada di
  // aria-label serta label hover.
  const sym = document.createElement('span');
  sym.append(ikonKategori(facility.category ?? facility.category_code));
  const label = document.createElement('span');
  label.className = 'ak-marker-label';
  label.setAttribute('aria-hidden', 'true');
  el.append(sym, label);
  terapkanTingkat(el, facility, level);
  el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(facility.id); });
  // Mapbox memosisikan elemen marker lewat `transform` inline. Animasi CSS (pantul)
  // dan rotasi tingkat "low" juga memakai `transform`, jadi bila dipasang pada elemen
  // yang sama, transform Mapbox tertimpa dan marker terlempar ke pojok kiri atas peta.
  // Solusinya: pembungkus ini milik Mapbox (hanya diposisikan), tombol di dalamnya
  // milik kita (bentuk, rotasi, animasi).
  const wrap = document.createElement('div');
  wrap.className = 'ak-marker-wrap';
  wrap.append(el);
  return { wrap, el };
}

/** Bagian penanda yang berubah saat kebutuhan pengguna berubah — warna, bentuk, nama. */
function terapkanTingkat(el, facility, level) {
  el.dataset.level = level.key; // bentuk marker ditentukan CSS per tingkat, bukan warna saja
  el.style.background = level.bg;
  el.setAttribute('aria-label', level.key === 'neutral' ? facility.name : `${facility.name}. ${level.label}`);
  const label = el.querySelector('.ak-marker-label');
  if (label) label.textContent = level.key === 'neutral' ? facility.name : `${facility.name} - ${level.label}`;
}

// Dua gaya saja. satellite-streets, bukan satellite polos: tanpa nama jalan di atas
// citra, orang tidak bisa mencocokkan apa yang dilihatnya dengan alamat fasilitas.
export const GAYA_PETA = {
  jalan: 'mapbox://styles/mapbox/streets-v12',
  satelit: 'mapbox://styles/mapbox/satellite-streets-v12',
};

const MapCanvas = forwardRef(function MapCanvas({
  items, selectedId, onSelect, userLocation, origin, routeGeometry, routeSegmen, pickingOrigin, onPickOrigin, focus, onError,
  gaya = 'jalan', jalurTerlihat = false, onJalurTerlaluJauh, onJalurRingkas, jangkauan = null, modeJangkauan = false, onPickJangkauan, heroGulir = false,
  // Sisi yang tertutup panel: penanda yang pas di tengah viewport tetap tersembunyi
  // kalau separuh kiri layar ditempati kartu mengambang.
  fitPaddingBottom = 70, fitPaddingLeft = 60,
}, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarker = useRef(null);
  const originMarker = useRef(null);
  const [ready, setReady] = useState(false);
  // Geometri rute disimpan juga di ref: setStyle membuang semua source dan layer kita,
  // jadi garis rutenya harus digambar ulang dari sesuatu yang bertahan.
  const routeGeomRef = useRef(null);
  const routeSegmenRef = useRef(null);
  const ubahRute = useRef(null);
  const gayaRef = useRef(gaya);
  const jalurRef = useRef(jalurTerlihat);
  jalurRef.current = jalurTerlihat;

  const live = useRef({});
  live.current = { onSelect, onPickOrigin, pickingOrigin, selectedId, onError, modeJangkauan, onPickJangkauan };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 200 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 200 }),
    flyTo: ({ lng, lat, zoom = 14 }) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700 }),
  }));

  useEffect(() => {
    // scrollZoom menyala di /map dan /facilities/:id, MATI saat peta jadi hero halaman
    // depan — lihat efek `heroGulir` di bawah.
    //
    // Dulu ia menyala di mana-mana, dengan alasan "peta adalah antarmuka utama". Di
    // halaman depan alasan itu tidak berlaku: di sana peta setinggi satu layar dan
    // halaman berlanjut ke bawah, jadi roda mouse yang mem-zoom peta berarti halaman
    // TIDAK BISA digulir sama sekali selama kursor ada di peta — yang menempati seluruh
    // lebar layar. Penguji menyebutnya "ke zoom out petanya mulu", dan mereka benar:
    // bagian penjelasan praktis tidak terjangkau tanpa memakai navbar.
    const map = new mapboxgl.Map({
      container: containerRef.current, style: GAYA_PETA[gayaRef.current] ?? GAYA_PETA.jalan,
      center: [118, -2.5], zoom: 3.6,
    });
    // 'style.load', bukan 'load'.
    //
    // 'load' baru menyala setelah gaya DAN sumber ubin pertama selesai dimuat. Satu
    // permintaan sumber yang gagal — jaringan hotel, kuota, DNS yang meleset sekejap —
    // membuatnya tidak pernah menyala sama sekali, dan karena seluruh lapisan peta
    // menunggu tanda ini, hasilnya peta tanpa satu pun penanda, rute, atau jangkauan.
    // Terukur: gaya 200, iconset 200, satu TileJSON gagal, nol penanda.
    //
    // 'style.load' menyala begitu gayanya selesai diurai. Di titik itu wadahnya sudah
    // punya ukuran (syarat sebenarnya agar penanda tidak terlempar ke 0,0) dan
    // addSource/addLayer sudah sah dipanggil — yang memang dua hal yang ditunggu.
    map.on('style.load', () => setReady(true));
    map.on('load', () => setReady(true));
    map.on('error', (e) => live.current.onError?.(e));
    map.on('click', (e) => {
      const t = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      if (live.current.pickingOrigin) live.current.onPickOrigin?.(t);
      else if (live.current.modeJangkauan) live.current.onPickJangkauan?.(t);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    mapRef.current = map;
    // Pegangan untuk memeriksa layer dari konsol saat pengembangan. Tidak ikut
    // terbangun ke produksi, dan sekali ini sudah berguna: lapisan jalur sempat
    // terlihat "tidak muncul" padahal queryRenderedFeatures menghitung 318 ruas —
    // yang salah warnanya, bukan kodenya.
    if (import.meta.env.DEV) window.__peta = map;
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; markersRef.current = []; setReady(false); };
  }, []);

  /**
   * Roda mouse: mem-zoom peta, atau menggulir halaman?
   *
   * Jawabannya bergantung pada peran peta saat itu. Di /map dan /facilities/:id peta
   * memenuhi layar dan tidak ada apa pun di bawahnya — zoom benar. Di halaman depan
   * peta hanya hero setinggi satu layar dengan penjelasan di bawahnya, dan di sana
   * zoom berarti halaman terkunci: peta menempati seluruh lebar layar, jadi tidak ada
   * tempat untuk menggulir melewatinya.
   *
   * Tombol +/- dan cubit dua jari tetap bekerja di kedua keadaan, jadi tidak ada cara
   * memperbesar yang hilang — yang hilang hanya jebakannya.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heroGulir) map.scrollZoom.disable();
    else map.scrollZoom.enable();
  }, [heroGulir, ready]);

  /**
   * Penanda dipasang hanya SETELAH peta siap.
   *
   * mapRef.current sudah terisi sejak `new mapboxgl.Map()`, jauh sebelum peta selesai
   * memuat — dan penanda yang ditambahkan ke peta yang belum siap tidak punya posisi
   * layar untuk dihitung, jadi Mapbox menaruhnya di titik 0,0: pojok kiri atas, menimpa
   * navbar. Terukur persis begitu saat berpindah dari /map ke halaman detail: satu
   * penanda di x:0 y:0 beserta labelnya di -6,-29. Ia memang hilang sendiri begitu peta
   * tenang, tapi kedipannya terlihat — cukup terlihat untuk difoto.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Pakai ulang penanda yang fasilitasnya masih ada; hanya yang benar-benar baru
    // yang dibuat, dan hanya yang benar-benar hilang yang dibuang.
    //
    // Dulu SELURUH penanda dibuang lalu dibuat ulang setiap kali `items` berubah —
    // termasuk saat berpindah dari daftar ke halaman detail, di mana dua puluh
    // fasilitas yang sama dibuat ulang tanpa alasan. Mapbox menunda penempatan penanda
    // baru ke DOM task, jadi selama satu frame semuanya menumpuk di titik 0,0, dan dua
    // puluh penanda sekaligus di tengah perpindahan rute membuat frame itu melar sampai
    // kedipannya terlihat. Pembungkus penanda sudah menghilangkan sebab utamanya;
    // berhenti membuat ulang yang tidak berubah menghapus sisanya sekaligus membuat
    // perpindahan rute jauh lebih murah.
    const sebelumnya = new Map(markersRef.current.map((x) => [String(x.id), x]));
    const dipakai = items.map(({ facility, level }) => {
      const kunci = String(facility.id);
      const lama = sebelumnya.get(kunci);
      if (lama) {
        sebelumnya.delete(kunci);
        terapkanTingkat(lama.el, facility, level);
        return lama;
      }
      const { wrap, el } = markerElement(facility, level, (id) => live.current.onSelect(id));
      const terpilih = String(facility.id) === String(live.current.selectedId);
      el.dataset.selected = String(terpilih);
      wrap.style.zIndex = terpilih ? '5' : '';
      const marker = new mapboxgl.Marker({ element: wrap }).setLngLat([facility.lon, facility.lat]).addTo(map);
      // Mapbox memasang role="img" aria-label="Map marker" pada elemen penanda. Pada
      // pembungkus kita itu merusak dua hal sekaligus: tombol yang bisa difokus jadi
      // bersarang di dalam peran img (axe: nested-interactive, serius), dan nama
      // fasilitas yang sudah ada di aria-label tombol tertelan oleh "Map marker".
      wrap.removeAttribute('role');
      wrap.removeAttribute('aria-label');
      return { id: facility.id, el, wrap, marker };
    });
    sebelumnya.forEach((x) => x.marker.remove()); // sisa = fasilitas yang keluar dari hasil
    markersRef.current = dipakai;
  }, [items, ready]);

  useEffect(() => {
    markersRef.current.forEach((x) => {
      const terpilih = String(x.id) === String(selectedId);
      const baruTerpilih = terpilih && x.el.dataset.selected !== 'true';
      x.el.dataset.selected = String(terpilih);
      x.wrap.style.zIndex = terpilih ? '5' : ''; // z-index harus di pembungkus, bukan tombol
      // Pantul sekali hanya pada transisi menjadi-terpilih, bukan di setiap render.
      //
      // Lepas-reflow-pasang, bukan menunggu `animationend`: kalau event itu tidak sempat
      // menyala (tab tersembunyi, halaman berhenti menggambar), kelasnya tertinggal dan
      // marker yang sama tidak akan pernah memantul lagi. Cara ini selalu memutar ulang.
      if (baruTerpilih) {
        x.el.classList.remove('ak-marker--pop');
        void x.el.offsetWidth; // paksa reflow supaya animasinya dihitung dari awal
        x.el.classList.add('ak-marker--pop');
      }
    });
  }, [selectedId, items]);

  const fitKey = items.map((i) => i.facility.id).join(',');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !items.length || live.current.selectedId) return;
    const b = new mapboxgl.LngLatBounds();
    items.forEach((i) => b.extend([i.facility.lon, i.facility.lat]));
    map.fitBounds(b, { padding: { top: 140, left: fitPaddingLeft, right: 60, bottom: fitPaddingBottom }, maxZoom: 13, duration: 500 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'ak-user-dot';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Lokasi Anda');
      userMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    originMarker.current?.remove();
    originMarker.current = null;
    if (origin) {
      const el = document.createElement('div');
      el.className = 'ak-origin';
      el.textContent = 'A';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Titik awal rute');
      originMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map);
    }
  }, [origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || gayaRef.current === gaya) return;
    gayaRef.current = gaya;
    map.setStyle(GAYA_PETA[gaya] ?? GAYA_PETA.jalan);
    // Penanda dibuat sebagai elemen DOM (mapboxgl.Marker), jadi ia selamat dari
    // pergantian gaya. Source dan layer tidak — rute dan lapisan jalur dipasang
    // ulang oleh efeknya masing-masing, yang ikut bergantung pada `gaya`.
  }, [gaya, ready]);

  // Garis rute. `gaya` ikut jadi dependensi dan `styledata` ikut didengarkan, dengan
  // alasan yang sama seperti lapisan jalur: setStyle membuang source kita, dan satu
  // handler style.load ternyata tidak selalu kebagian — terukur, layer rute hilang
  // seluruhnya setelah berganti ke satelit. Menggambar ulang itu murah dan idempoten,
  // jadi lebih baik dipanggil terlalu sering daripada terlewat sekali.
  useEffect(() => {
    const map = mapRef.current;
    routeGeomRef.current = routeGeometry ?? null;
    routeSegmenRef.current = routeSegmen ?? null;
    if (!map || !ready) return undefined;
    if (!routeGeometry) { clearRoute(map); return undefined; }

    const gambar = () => drawRoute(map, routeGeometry, routeSegmen);
    gambar();
    map.on('styledata', gambar);

    // Pemaskan hanya saat rutenya BERUBAH, bukan tiap kali gaya diganti: memaksa
    // kamera kembali ke rute saat pengguna baru saja menggeser peta itu menyebalkan.
    if (ubahRute.current !== routeGeometry) {
      ubahRute.current = routeGeometry;
      const b = new mapboxgl.LngLatBounds();
      routeGeometry.coordinates.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: { top: 140, left: fitPaddingLeft, right: 60, bottom: fitPaddingBottom }, duration: 600 });
    }
    return () => map.off('styledata', gambar);
  }, [routeGeometry, routeSegmen, ready, gaya]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lapisan jaringan pejalan kaki.
  //
  // SATU jalur pemulihan untuk semua keadaan, bukan penanganan khusus per kejadian.
  // Sebelumnya pemasangan layer dititipkan ke `style.load` sementara pengambilan data
  // menumpang `moveend`; begitu gaya peta diganti, keduanya bisa sama-sama tidak
  // kebagian dan lapisan hilang tanpa pernah kembali. Sekarang `sinkron()` memastikan
  // keadaan yang benar — layer terpasang, data sesuai kotak tampilan — dan ia dipanggil
  // dari setiap kejadian yang mungkin merusaknya.
  //
  // Datanya diambil per kotak yang terlihat, bukan sekaligus se-Bogor: 24.180 ruas
  // sebagai satu GeoJSON membuat peta tersendat beberapa detik setiap kali dibuka.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    if (!jalurTerlihat) { lepasJalur(map); return undefined; }

    let batal = null;
    let tunda = null;

    const muat = async () => {
      // perluMuatUlang menolak kotak yang sama dua kali, dan lupa ingatannya begitu
      // source dibuat ulang — itu yang membuat pemanggilan berulang di sini murah.
      if (!perluMuatUlang(map)) return;
      batal?.abort();
      batal = new AbortController();
      try {
        const { data, terlaluJauh } = await ambilJalur(map, { signal: batal.signal });
        isiJalur(map, data);
        onJalurTerlaluJauh?.(terlaluJauh);
        // Dihitung dari yang BENAR-BENAR digambar, bukan dari query terpisah ke
        // server: angka di keterangan harus cocok dengan garis yang dilihat orang.
        const hitung = { hambatan: 0, lolos: 0, belum: 0 };
        (data.features ?? []).forEach((f) => { hitung[f.properties.kelas] += 1; });
        onJalurRingkas?.(terlaluJauh ? null : hitung);
      } catch (e) {
        if (e.name !== 'AbortError') isiJalur(map, null);
      }
    };

    const sinkron = () => {
      if (!map.isStyleLoaded()) return; // styledata berikutnya yang akan memanggil lagi
      pasangJalur(map, gaya);
      muat();
    };
    // Ditunda sesaat: menggeser peta memicu belasan kejadian beruntun, dan tanpa jeda
    // ini setiap satu di antaranya jadi satu permintaan ke server.
    const jadwalkan = () => { clearTimeout(tunda); tunda = setTimeout(sinkron, 350); };

    sinkron();
    map.on('moveend', jadwalkan);
    map.on('idle', jadwalkan);
    map.on('styledata', jadwalkan);
    return () => {
      clearTimeout(tunda);
      batal?.abort();
      map.off('moveend', jadwalkan);
      map.off('idle', jadwalkan);
      map.off('styledata', jadwalkan);
      lepasJalur(map); // penjaga gaya-siap ada di dalamnya
    };
  }, [jalurTerlihat, ready, gaya]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    if (!jangkauan) { lepasJangkauan(map); return undefined; }
    const gambar = () => { if (pasangJangkauan(map)) isiJangkauan(map, jangkauan); };
    gambar();
    // Gaya bisa sedang dimuat ulang (mis. baru berganti ke satelit); coba lagi saat siap.
    map.on('styledata', gambar);
    return () => map.off('styledata', gambar);
  }, [jangkauan, ready]);

  // Kursor silang berlaku untuk dua mode yang sama-sama meminta ketukan di peta.
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = (pickingOrigin || modeJangkauan) ? 'crosshair' : '';
  }, [pickingOrigin, modeJangkauan]);
  useEffect(() => { const map = mapRef.current; if (map && focus) map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 14, duration: 600 }); }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} role="region" aria-label="Peta fasilitas. Daftar hasil menyediakan informasi yang sama untuk pengguna keyboard dan pembaca layar." className="size-full" />;
});

const MapView = forwardRef(function MapView(props, ref) {
  if (!TOKEN) return <NoToken />;
  return <MapCanvas ref={ref} {...props} />;
});
export default MapView;
