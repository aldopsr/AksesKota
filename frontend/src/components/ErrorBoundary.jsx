import { Component } from 'react';

/**
 * Penjaga galat render.
 *
 * React MELEPAS seluruh pohon komponen ketika satu komponen melempar saat render —
 * bukan hanya bagian yang rusak. Tanpa penjaga ini akibatnya layar putih kosong
 * total: tidak ada pesan, tidak ada navigasi, tidak ada cara keluar selain mengetik
 * ulang alamatnya. Itu benar-benar terjadi di halaman tambah fasilitas, dan satu-
 * satunya petunjuk ada di konsol pengembang — tempat yang tidak akan dibuka juri.
 *
 * Yang ditawarkan di sini sengaja dua: memuat ulang (galat sesaat, mis. jaringan
 * putus saat memuat potongan kode) dan kembali ke peta (halamannya sendiri yang
 * rusak). Tanpa pilihan kedua, pengguna yang halamannya rusak permanen terjebak
 * pada tombol yang selalu gagal.
 *
 * ponytail: tidak mengirim galat ke mana pun. Tambahkan pelaporan kalau nanti
 * aplikasi ini benar-benar dipakai orang banyak dan kita perlu tahu apa yang pecah.
 */
export default class ErrorBoundary extends Component {
  state = { galat: null };

  static getDerivedStateFromError(galat) {
    return { galat };
  }

  componentDidCatch(galat, info) {
    // Tetap dicetak: saat pengembangan inilah satu-satunya jejak tumpukannya.
    console.error('Galat render:', galat, info?.componentStack);
  }

  render() {
    if (!this.state.galat) return this.props.children;

    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold">Halaman ini gagal dimuat</h1>
        <p className="font-sub text-ink-secondary">
          Ada yang salah saat menampilkan halaman ini. Data Anda tidak hilang — coba muat ulang,
          atau kembali ke peta.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-control bg-action-primary px-4 font-semibold text-white"
          >
            Muat ulang halaman
          </button>
          {/* <a>, bukan <Link>: router boleh jadi bagian yang rusak, dan tautan yang
              bergantung padanya ikut mati bersamanya. */}
          <a
            href="/map"
            className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-4 font-semibold"
          >
            Kembali ke peta
          </a>
        </div>
      </div>
    );
  }
}
