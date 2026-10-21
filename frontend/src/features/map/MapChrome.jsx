import { useEffect, useId, useRef, useState } from 'react';
import { CircleQuestionMark, Footprints, Layers, LocateFixed, Minus, Plus, Radar } from 'lucide-react';
import { LEVELS } from '../accessibility/match';
import { WARNA_JALUR } from './jalur';
import { Spinner } from '../../components/ui';

/**
 * Kontrol peta: satu klaster melayang di kanan, bukan tombol-tombol yang tersebar.
 *
 * Sebelumnya zoom ada di kanan atas dan legenda jadi tombol tersendiri di kiri atas,
 * berebut tempat dengan bilah pencarian. Mengumpulkannya jadi satu kolom membuat
 * pojok kiri sepenuhnya milik pencarian, dan semua kontrol manual berada di satu
 * tempat yang bisa dihafal.
 */

// Bentuk tombol DIPISAH dari warnanya. Sebelumnya keduanya menyatu dalam satu
// string, jadi tombol yang ingin berlatar lain menambahkan `bg-brand-700` di samping
// `bg-surface/95` yang sudah ada — dua utilitas latar yang bertabrakan, dan yang
// menang ditentukan urutan CSS, bukan urutan penulisan. Akibatnya ikon putih di atas
// latar putih: tombolnya terlihat kosong. Ini tabrakan utilitas ketiga di proyek ini
// setelah dua kasus hidden/inline-flex, jadi kali ini diperbaiki pada bentuknya.
const bentukTombol =
  'inline-flex size-11 items-center justify-center backdrop-blur active:scale-[0.97] disabled:opacity-50';
const kelasTombol = `${bentukTombol} bg-surface/95 text-ink hover:bg-surface-subtle`;

function Tombol({ label, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${kelasTombol} ${className}`}
      style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
    >
      {children}
    </button>
  );
}

export function MapControls({ onZoomIn, onZoomOut, onLocate, locating, gaya = 'jalan', onGantiGaya, jalur = false, onGantiJalur, ringkasJalur, modeJangkauan = false, onGantiJangkauan }) {
  const [legenda, setLegenda] = useState(false);
  const id = useId();
  const bungkus = useRef(null);

  // Lapisan jalur dinyalakan: buka keterangannya sendiri, sekali seumur peramban.
  //
  // Lapisan itu menggambar tiga warna garis yang tidak berarti apa-apa sampai ada yang
  // menerangkannya, dan penjelasannya bersembunyi di balik tombol tanda tanya yang
  // tidak akan ditekan orang yang belum tahu ada yang perlu ditanyakan. Menyalakan
  // lapisannya ADALAH saat ia paling dibutuhkan. Sekali saja: penjelasan yang sama
  // muncul berulang kali berubah dari menolong jadi mengganggu, dan panel ini menutupi
  // peta yang baru saja ingin dilihat pengguna.
  useEffect(() => {
    if (!jalur) return;
    try {
      if (localStorage.getItem('ak_legenda_jalur') === '1') return;
      localStorage.setItem('ak_legenda_jalur', '1');
    } catch { /* mode privat: biar terbuka, lebih baik daripada tidak pernah */ }
    setLegenda(true);
  }, [jalur]);

  // Legenda menutup saat diklik di luar atau Escape: ia menumpang di atas peta, dan
  // panel yang menempel di sana menghalangi hal yang justru ingin dilihat pengguna.
  useEffect(() => {
    if (!legenda) return undefined;
    const klik = (e) => { if (!bungkus.current?.contains(e.target)) setLegenda(false); };
    const esc = (e) => { if (e.key === 'Escape') setLegenda(false); };
    document.addEventListener('pointerdown', klik);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', klik); document.removeEventListener('keydown', esc); };
  }, [legenda]);

  return (
    // Di layar sempit klaster ini turun ke bawah baris kategori. Pada posisi atas ia
    // menindih tombol "Tanya asisten" tepat di koordinat yang sama — di layar lebar
    // bilah perintah berhenti di 28rem sehingga keduanya tidak pernah bertemu.
    //
    // 7.5rem diukur dari wadah peta, bukan dari layar: wadahnya sendiri sudah mulai
    // 65 px di bawah header. Angka yang diukur dari layar membuat klaster ini jatuh
    // terlalu rendah dan tombol legendanya tertutup panel bawah.
    <div ref={bungkus} className="absolute right-3 top-[7.5rem] z-30 flex flex-col items-end gap-2 lg:top-[4.5rem]">
      <div className="flex flex-col overflow-hidden rounded-control border border-border-strong">
        <Tombol label="Perbesar peta" onClick={onZoomIn}><Plus aria-hidden="true" size={19} /></Tombol>
        <span aria-hidden="true" className="h-px bg-border" />
        <Tombol label="Perkecil peta" onClick={onZoomOut}><Minus aria-hidden="true" size={19} /></Tombol>
      </div>

      <div className="flex flex-col overflow-hidden rounded-control border border-border-strong">
        <Tombol label="Gunakan lokasi saya" onClick={onLocate}>
          {locating ? <Spinner size={19} /> : <LocateFixed aria-hidden="true" size={19} />}
        </Tombol>
        <span aria-hidden="true" className="h-px bg-border" />
        {/* Jangkauan nyata. Satu-satunya kontrol di kolom ini yang meminta ketukan
            lanjutan di peta, jadi ia menyala terang selama modenya aktif. */}
        <button
          type="button"
          aria-pressed={modeJangkauan}
          aria-label={modeJangkauan ? 'Keluar dari mode jangkauan' : 'Hitung jangkauan dari sebuah titik'}
          onClick={() => onGantiJangkauan?.(!modeJangkauan)}
          className={`${bentukTombol} ${modeJangkauan ? 'bg-brand-700 text-white hover:bg-brand-800' : 'bg-surface/95 text-ink hover:bg-surface-subtle'}`}
          style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
        >
          <Radar aria-hidden="true" size={19} />
        </button>
        <span aria-hidden="true" className="h-px bg-border" />

        {/* Lapisan jaringan pejalan kaki: tangga, jalur ber-guiding block, dan ruas
            yang belum terdata. Ditaruh satu kelompok dengan sakelar satelit karena
            keduanya menjawab pertanyaan yang sama — "peta ini menampilkan apa". */}
        <button
          type="button"
          aria-pressed={jalur}
          aria-label={jalur ? 'Sembunyikan jalur pejalan kaki' : 'Tampilkan jalur pejalan kaki dan hambatannya'}
          onClick={() => onGantiJalur?.(!jalur)}
          className={`${bentukTombol} ${jalur ? 'bg-brand-100 text-brand-900 hover:bg-brand-200' : 'bg-surface/95 text-ink hover:bg-surface-subtle'}`}
          style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
        >
          <Footprints aria-hidden="true" size={19} />
        </button>
        <span aria-hidden="true" className="h-px bg-border" />

        {/* Ikon tumpukan lembaran akhirnya dipakai untuk hal yang memang dijanjikannya.
            Label berubah mengikuti keadaan, karena tombol sakelar yang namanya tetap
            tidak pernah jelas sedang menyalakan atau mematikan apa. */}
        <button
          type="button"
          aria-pressed={gaya === 'satelit'}
          aria-label={gaya === 'satelit' ? 'Tampilkan peta jalan' : 'Tampilkan citra satelit'}
          onClick={() => onGantiGaya?.(gaya === 'satelit' ? 'jalan' : 'satelit')}
          className={`${bentukTombol} ${gaya === 'satelit' ? 'bg-brand-100 text-brand-900 hover:bg-brand-200' : 'bg-surface/95 text-ink hover:bg-surface-subtle'}`}
          style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
        >
          <Layers aria-hidden="true" size={19} />
        </button>
        <span aria-hidden="true" className="h-px bg-border" />
        <button
          type="button"
          aria-expanded={legenda}
          aria-controls={id}
          aria-label="Keterangan warna penanda peta"
          onClick={() => setLegenda((v) => !v)}
          className={`${bentukTombol} ${legenda ? 'bg-brand-100 text-brand-900 hover:bg-brand-200' : 'bg-surface/95 text-ink hover:bg-surface-subtle'}`}
          style={{ transition: 'transform 160ms var(--ease-out), background-color 160ms ease' }}
        >
          <CircleQuestionMark aria-hidden="true" size={19} />
        </button>
      </div>

      {legenda && (
        <div
          id={id}
          // Muncul dari sudut tombolnya, bukan dari tengah: panel yang membesar dari
          // titik lain terasa datang entah dari mana.
          className="ak-muncul panel-scroll max-h-[calc(100dvh-27rem)] w-64 origin-top-right overflow-y-auto rounded-card border border-border bg-surface p-3 shadow-popover lg:max-h-[min(70dvh,34rem)]"
        >
          <p className="mb-2 text-sm font-bold">Kecocokan dengan kebutuhan Anda</p>
          <ul className="space-y-1.5">
            {['high', 'partial', 'low', 'limited', 'neutral'].map((k) => {
              const l = LEVELS[k];
              return (
                <li key={k} className="flex items-center gap-2.5">
                  <span aria-hidden="true" style={{ background: l.bg }} className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ring-1 ring-border-strong">
                    {l.symbol || <span className="size-2 rounded-full bg-white" />}
                  </span>
                  <span className="text-sm">{k === 'neutral' ? 'Belum ada kebutuhan dipilih' : l.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="font-sub mt-2 text-xs text-ink-secondary">Kecocokan bukan sertifikasi. Detail ada di halaman fasilitas.</p>

          {/* Keterangan garis hanya muncul kalau lapisannya memang menyala: kunci warna
              untuk sesuatu yang tidak terlihat hanya menambah yang harus dibaca. */}
          {jalur && (
            <>
              <p className="mb-2 mt-3 border-t border-border pt-3 text-sm font-bold">Jalur pejalan kaki</p>
              {/* Angka untuk kotak yang sedang dilihat, bukan untuk seluruh kota:
                  kunci warna memberi tahu artinya, angka ini memberi tahu seberapa
                  banyak — dan "belum terdata" yang selalu menang telak itu temuannya. */}
              {ringkasJalur && (
                <p className="font-sub mb-2 text-xs text-ink-secondary">
                  Di layar ini: <strong className="font-semibold text-ink">{ringkasJalur.hambatan}</strong> hambatan ·{' '}
                  <strong className="font-semibold text-ink">{ringkasJalur.lolos}</strong> terdata lolos ·{' '}
                  <strong className="font-semibold text-ink">{ringkasJalur.belum}</strong> belum terdata
                </p>
              )}
              <ul className="space-y-1.5">
                {[
                  ['hambatan', 'Hambatan: tangga atau ditandai tidak dapat dilalui'],
                  ['lolos', 'Terdata dapat dilalui atau ber-guiding block'],
                  ['belum', 'Belum terdata'],
                ].map(([k, teks]) => (
                  <li key={k} className="flex items-center gap-2.5">
                    <span aria-hidden="true" style={{ background: WARNA_JALUR[k] }} className="h-1 w-6 shrink-0 rounded-full" />
                    <span className="text-sm">{teks}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
