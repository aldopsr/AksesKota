import base64, re, sys, time, traceback
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:4173'
EMAIL = f'e2e{int(time.time())}@uji.id'
open('/tmp/proof.png', 'wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))
FAKES = """
(() => {
  window.__spoken = []; window.__recCalls = 0;
  class FakeRec {
    start() { window.__recCalls++; const n = window.__recCalls;
      setTimeout(() => { const text = n === 1 ? 'rekomendasi rumah sakit dengan ramp' : 'berhenti';
        const res = [[{ transcript: text }]]; res[0].isFinal = true;
        this.onresult && this.onresult({ results: res });
        setTimeout(() => this.onend && this.onend(), 50); }, 300); }
    stop() { this.onend && this.onend(); }
    abort() {}
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 100); },
    cancel() {}, getVoices() { return [{ lang: 'id-ID', name: 'fake' }]; }, addEventListener() {}, removeEventListener() {},
  } });
})();
"""
errors = []

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, geolocation={'latitude': -6.595, 'longitude': 106.79}, permissions=['geolocation'])
        ctx.add_init_script(FAKES)
        pg = ctx.new_page(); pg.set_default_timeout(10000)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' and 'mapbox' not in m.text.lower() and 'Failed to load resource' not in m.text else None)
        ok = lambda s: print('OK  ', s, flush=True)
        card = lambda: pg.locator('article[id^="facility-"]')
        pw = re.compile('^Kata sandi')

        def login(email, password):
            pg.goto(BASE + '/login')
            pg.get_by_label('Email').fill(email); pg.get_by_label(pw).fill(password)
            pg.get_by_role('button', name='Masuk', exact=True).click()
            expect(pg).not_to_have_url(re.compile('/login'))
        def logout_public():
            pg.locator('header').get_by_role('button', name=re.compile('^(Penguji|Admin)')).click()
            pg.get_by_role('button', name='Keluar').click()
            expect(pg.locator('header').get_by_role('link', name='Masuk')).to_be_visible()

        # 1. beranda -> pencarian
        pg.goto(BASE); expect(pg.get_by_role('heading', level=1)).to_contain_text('Cek akses')
        expect(pg.get_by_label('Contoh hasil fasilitas')).to_contain_text(re.compile(r'Sebagian Sesuai\s*50%'))  # contoh hasil konsisten dengan atributnya
        pg.locator('#home-search').fill('Stasiun'); pg.get_by_role('button', name='Jelajahi fasilitas').click()
        expect(pg).to_have_url(re.compile(r'/map\?q=Stasiun')); expect(card()).to_have_count(1)
        ok('beranda: pencarian membawa parameter ke URL; contoh hasil konsisten')

        # 2. daftar + filter via URL
        pg.goto(BASE + '/map'); expect(pg.get_by_text(re.compile(r'^14 fasilitas'))).to_be_visible(timeout=12000)
        pg.get_by_role('button', name=re.compile('^Filter kebutuhan')).click()
        dlg = pg.get_by_role('dialog', name='Filter kebutuhan aksesibilitas')
        dlg.get_by_label(re.compile('^Ramp')).check(); dlg.get_by_label(re.compile('^Lift')).check()
        dlg.get_by_role('button', name=re.compile('^Terapkan')).click()
        expect(pg).to_have_url(re.compile(r'needs=ramp%2Clift|needs=ramp,lift'))
        expect(pg.get_by_role('list', name='Filter aktif').get_by_text('Ramp')).to_be_visible()
        expect(pg.get_by_text(re.compile('(Sangat|Sebagian|Kurang) Sesuai|Data Terbatas')).first).to_be_visible()
        ok('filter kebutuhan (Terapkan) -> URL + chip aktif + kecocokan dari backend')
        pg.get_by_role('button', name='Hapus filter Ramp').click()
        expect(pg).to_have_url(re.compile(r'needs=lift')); ok('chip filter bisa dihapus satu per satu')
        pg.get_by_role('button', name='Kesehatan', exact=True).click(); expect(pg).to_have_url(re.compile('category=kesehatan'))
        expect(pg.get_by_text(re.compile(r'^\d+ fasilitas'))).not_to_have_text(re.compile(r'^14 fasilitas')); ok('kategori')

        # 3. detail mempertahankan filter
        card().first.locator('h3 a').click()
        expect(pg).to_have_url(re.compile(r'/facilities/\d+')); expect(pg.get_by_role('heading', name='Atribut aksesibilitas')).to_be_visible()
        expect(pg.get_by_role('heading', name='Kecocokan dengan kebutuhan Anda')).to_be_visible()
        pg.get_by_role('button', name=re.compile('Kembali ke hasil')).click()
        expect(pg).to_have_url(re.compile(r'/map\?.*category=kesehatan')); expect(pg).to_have_url(re.compile('needs=lift')); ok('detail + kembali ke hasil mempertahankan filter')

        # 4. rute (lokasi diizinkan)
        pg.goto(BASE + '/map?q=Stasiun'); card().first.locator('h3 a').click()
        pg.get_by_role('button', name='Lihat rute').click()
        expect(pg.get_by_text(re.compile(r'1,[34] km'))).to_be_visible(); expect(pg).to_have_url(re.compile('route=1'))
        pg.get_by_role('button', name='Tutup rute').click(); expect(pg).not_to_have_url(re.compile('route=1')); ok('rute jalan kaki dari backend + skor')

        # 5. guard login dengan alasan, lalu daftar dan kembali ke tujuan
        pg.goto(BASE + '/my-contributions')
        expect(pg).to_have_url(re.compile('/login')); expect(pg.get_by_text(re.compile('Masuk untuk melihat status kontribusi'))).to_be_visible()
        pg.get_by_role('link', name='Daftar', exact=True).last.click()
        pg.get_by_label('Nama tampilan').fill('Penguji E2E'); pg.get_by_label('Email').fill(EMAIL)
        pg.get_by_label(pw).first.fill('rahasia123'); pg.get_by_label('Ulangi kata sandi').fill('rahasia123')
        pg.get_by_role('button', name='Buat akun').click()
        expect(pg).to_have_url(re.compile('/my-contributions')); ok('guard: alasan login ditampilkan, setelah daftar kembali ke halaman tujuan')

        # 6. profil dipakai otomatis
        pg.goto(BASE + '/accessibility-profile')
        pg.get_by_label(re.compile('^Lift')).check(); pg.get_by_label(re.compile('^Ramp')).check()
        pg.get_by_role('button', name='Simpan perubahan').click(); expect(pg.get_by_text('Profil aksesibilitas tersimpan.')).to_be_visible()
        pg.goto(BASE + '/map'); expect(pg.get_by_role('list', name='Filter aktif').get_by_text('Profil saya')).to_be_visible(); ok('profil tersimpan dan dipakai otomatis')

        # 7. asisten AI (Gemini tiruan)
        pg.get_by_role('button', name='Tanya asisten').click()
        dock = pg.get_by_role('dialog', name='Asisten AksesKota')
        dock.get_by_role('button', name=re.compile('Rekomendasikan rumah sakit')).click()
        expect(dock.get_by_text('Saya rekomendasikan 2 tempat.')).to_be_visible()
        expect(dock.get_by_text('Rekomendasi', exact=True).first).to_be_visible(); expect(dock.get_by_text(re.compile('Filter yang dipakai'))).to_be_visible()
        expect(pg).to_have_url(re.compile('category=kesehatan')); ok('asisten: rekomendasi + ringkasan filter + parameter masuk URL')
        dock.get_by_role('button', name=re.compile('Aktifkan lokasi')).click(); expect(dock.get_by_role('button', name=re.compile('Aktifkan lokasi'))).to_have_count(0)
        dock.get_by_label('Pesan untuk asisten').fill('Buatkan rute ke stasiun'); dock.get_by_role('button', name='Kirim').click()
        expect(dock.get_by_text(re.compile(r'Rute ke Stasiun .* \d+ menit'))).to_be_visible()
        expect(pg).to_have_url(re.compile(r'/facilities/\d+\?.*route=1')); expect(pg.get_by_text(re.compile(r'1,[34] km'))).to_be_visible(); ok('asisten: rute langsung dibuat')
        dock.get_by_role('button', name='Mode hands-free').click()
        expect(dock.get_by_text(re.compile('rekomendasi rumah sakit dengan ramp'))).to_be_visible(timeout=15000)
        expect(dock.get_by_role('button', name='Mode hands-free')).to_have_attribute('aria-pressed', 'false', timeout=20000)
        spoken = pg.evaluate('window.__spoken'); assert any('Mode hands-free aktif' in t for t in spoken) and any('rekomendasikan 2 tempat' in t for t in spoken), spoken
        ok('hands-free: dengar -> jawab -> bicara -> "berhenti"'); dock.get_by_role('button', name='Tutup asisten').click()

        # 8. kontribusi: form bertahap
        pg.goto(BASE + '/facilities/new'); expect(pg.get_by_role('heading', name='Informasi', exact=True)).to_be_visible()
        pg.get_by_role('button', name='Lanjut').click(); expect(pg.get_by_text('Nama minimal 3 karakter.')).to_be_visible()
        pg.get_by_label(re.compile('^Nama fasilitas')).fill('Klinik E2E Aksesibel'); pg.get_by_label(re.compile('^Kategori')).select_option('kesehatan')
        pg.get_by_label(re.compile('^Alamat')).fill('Jl. Pengujian No. 7, Bogor'); pg.get_by_role('button', name='Lanjut').click()
        expect(pg.get_by_role('heading', name='Lokasi', exact=True)).to_be_visible()
        pg.locator('summary', has_text='Isi koordinat secara manual').click()
        pg.get_by_label(re.compile('^Latitude')).fill('-6.5950'); pg.get_by_label(re.compile('^Longitude')).fill('106.7990'); pg.get_by_role('button', name='Lanjut').click()
        expect(pg.get_by_role('heading', name='Atribut', exact=True)).to_be_visible()
        pg.get_by_role('group', name=re.compile('^Ramp')).get_by_text('✓ Tersedia').click(); pg.get_by_role('button', name='Lanjut').click()
        pg.get_by_role('button', name='Lanjut').click(); expect(pg.get_by_text(re.compile('Lampirkan minimal 1 foto'))).to_be_visible(); ok('form bertahap: validasi per langkah + foto bukti wajib')
        pg.set_input_files('input[type=file]', '/tmp/proof.png'); pg.get_by_label(re.compile('^Catatan untuk admin')).fill('Saya cek langsung kemarin.')
        pg.get_by_role('button', name='Lanjut').click(); expect(pg.get_by_role('heading', name='Tinjau dan kirim')).to_be_visible()
        expect(pg.get_by_text('Klinik E2E Aksesibel').first).to_be_visible()
        pg.get_by_role('button', name='Kirim fasilitas').click(); expect(pg.get_by_role('heading', name='Kontribusi terkirim')).to_be_visible()
        pg.get_by_role('link', name='Lihat kontribusi saya').click(); expect(pg.get_by_text('Menunggu verifikasi').first).to_be_visible(); ok('kontribusi terkirim, konfirmasi, status pending')
        logout_public()

        # 9. admin
        login('admin@akseskota.id', 'admin12345'); pg.goto(BASE + '/admin')
        expect(pg.get_by_role('heading', name='Antrean verifikasi')).to_be_visible()
        pg.get_by_role('link', name=re.compile('Klinik E2E')).first.click()
        expect(pg.get_by_role('heading', name='Perubahan yang diusulkan')).to_be_visible(); expect(pg.get_by_text('Saya cek langsung kemarin.')).to_be_visible()
        expect(pg.get_by_role('img', name=re.compile('Foto bukti 1'))).to_be_visible()
        pg.get_by_role('button', name='Setujui').click(); pg.get_by_role('button', name='Ya, setujui').click()
        expect(pg).to_have_url(re.compile('/admin$')); expect(pg.get_by_text('Kontribusi disetujui dan data diperbarui.')).to_be_visible(); ok('admin: tinjau diff + catatan + foto, setujui')
        pg.get_by_role('button', name='Keluar').click()

        # 10. data baru tampil, update, ulasan, laporan
        login(EMAIL, 'rahasia123'); pg.goto(BASE + '/map?q=Klinik E2E'); expect(card()).to_have_count(1)
        card().first.locator('h3 a').click(); expect(pg.get_by_role('img', name=re.compile('Foto 1 dari 1'))).to_be_visible()
        fid = re.search(r'/facilities/(\d+)', pg.url).group(1); ok('fasilitas baru tampil di peta lengkap dengan foto')
        pg.get_by_role('button', name='Tulis ulasan').click(); dlg = pg.get_by_role('dialog', name='Tulis ulasan')
        dlg.locator('label', has_text='5').first.click(); dlg.get_by_label(re.compile('^Ulasan singkat')).fill('Ramp landai dan petugas ramah.')
        dlg.get_by_role('button', name='Kirim ulasan').click(); expect(pg.get_by_text('Ramp landai dan petugas ramah.').first).to_be_visible(); ok('ulasan terkirim')
        pg.get_by_role('button', name='Laporkan informasi').click(); dlg = pg.get_by_role('dialog', name='Laporkan informasi')
        dlg.get_by_label(re.compile('^Jenis masalah')).select_option('data_salah'); dlg.get_by_label(re.compile('^Penjelasan')).fill('Data toilet belum sesuai dengan kondisi sebenarnya.')
        dlg.get_by_role('button', name='Kirim laporan').click(); expect(pg.get_by_text('Laporan terkirim. Admin akan memeriksanya.')).to_be_visible(); ok('laporan terkirim')
        pg.goto(BASE + f'/facilities/{fid}/update'); expect(pg.get_by_role('heading', level=1, name='Usulkan pembaruan')).to_be_visible()
        pg.get_by_role('button', name='Lanjut').click(); pg.get_by_role('button', name='Lanjut').click()
        pg.get_by_role('group', name=re.compile('^Lift')).get_by_text('✓ Tersedia').click(); pg.get_by_role('button', name='Lanjut').click()
        pg.set_input_files('input[type=file]', '/tmp/proof.png'); pg.get_by_role('button', name='Lanjut').click()
        expect(pg.get_by_role('columnheader', name='Sebelumnya')).to_be_visible(); pg.get_by_role('button', name='Kirim usulan pembaruan').click()
        expect(pg.get_by_role('heading', name='Kontribusi terkirim')).to_be_visible(); ok('usulan pembaruan: tampilan sebelum/sesudah, terkirim')
        logout_public()

        # 11. admin menangani laporan; guard non-admin
        login('admin@akseskota.id', 'admin12345'); pg.goto(BASE + '/admin?tab=reports')
        expect(pg.get_by_text('Data toilet belum sesuai')).to_be_visible(); pg.get_by_role('button', name='Tandai selesai').click(); expect(pg.get_by_text('Status laporan diperbarui.')).to_be_visible()
        pg.get_by_role('tab', name=re.compile('^Ulasan')).click(); expect(pg.get_by_text('Ramp landai dan petugas ramah.')).to_be_visible(); ok('admin: laporan dan moderasi ulasan; tab dengan navigasi panah')
        pg.get_by_role('button', name='Keluar').click(); login(EMAIL, 'rahasia123'); pg.goto(BASE + '/admin'); expect(pg).not_to_have_url(re.compile('/admin')); ok('guard: non-admin ditolak')

        # 12. URL lama dialihkan
        pg.goto(BASE + f'/map/{fid}'); expect(pg).to_have_url(re.compile(f'/facilities/{fid}$')); ok('URL lama dialihkan ke struktur baru')

        # 13. mobile
        mctx = b.new_context(viewport={'width': 390, 'height': 844}); mctx.add_init_script(FAKES)
        m = mctx.new_page(); m.set_default_timeout(10000)
        m.goto(BASE + '/'); expect(m.get_by_role('navigation', name='Navigasi bawah')).to_be_visible()
        m.goto(BASE + '/map'); expect(m.get_by_role('navigation', name='Navigasi bawah')).to_have_count(0)
        expect(m.get_by_text(re.compile(r'^\d+ fasilitas'))).to_be_visible(timeout=12000)
        m.get_by_role('button', name='Peta', exact=True).click(); expect(m.get_by_text(re.compile(r'\d+ fasilitas di peta'))).to_be_visible()
        m.get_by_role('button', name='Lihat daftar').click(); expect(m.locator('article[id^="facility-"]').first).to_be_visible(); ok('mobile: tanpa bottom nav di peta, sheet Peta/Daftar dengan tombol eksplisit')
        b.close()

try:
    run()
    print('\nERROR KONSOL:', errors[:5] or 'tidak ada'); print('SEMUA ALUR LOLOS')
except Exception:
    traceback.print_exc(); print('errors:', errors[:5]); sys.exit(1)
