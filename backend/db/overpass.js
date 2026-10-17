// Pemanggil Overpass yang dipakai bersama import-osm.js dan import-ways.js.
//
// overpass-api.de sering membalas 504/429 saat sibuk — itu normal, bukan bug kita.
// Jadi: coba beberapa mirror bergantian, dengan jeda yang makin panjang.
// Mirror-nya berbagi data yang sama, jadi hasilnya identik.

const MIRROR = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchOverpass(query, { percobaan = 3 } = {}) {
  let terakhir;
  for (let putaran = 0; putaran < percobaan; putaran++) {
    for (const url of MIRROR) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          // Tanpa User-Agent, Overpass membalas 406. Jangan dihapus.
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AksesKota/0.1 (riset aksesibilitas Kota Bogor)',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(180_000),
        });
        if (res.ok) {
          const json = await res.json();
          console.log(`  sumber: ${new URL(url).hostname}`);
          return json;
        }
        terakhir = `${new URL(url).hostname} -> ${res.status}`;
      } catch (e) {
        terakhir = `${new URL(url).hostname} -> ${e.message}`;
      }
      console.log(`  gagal: ${terakhir}`);
    }
    const jeda = 5000 * (putaran + 1);
    if (putaran < percobaan - 1) {
      console.log(`  semua mirror sibuk, tunggu ${jeda / 1000} detik...`);
      await tidur(jeda);
    }
  }
  throw new Error(`Overpass tidak bisa dihubungi setelah ${percobaan} putaran. Terakhir: ${terakhir}`);
}
