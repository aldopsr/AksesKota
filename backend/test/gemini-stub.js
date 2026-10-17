// Gemini TIRUAN untuk pengujian: meniru protokol generateContent + function calling.
// Dipakai test/api.js dan e2e frontend. Jalankan sendiri: `node test/gemini-stub.js` (port 4998).
import http from 'node:http';

// Gemini tiruan: meniru protokol generateContent + function calling (tanpa jaringan/kunci sungguhan)
export function createGeminiStub() {
  return http.createServer(async (req, res) => {
  let raw = ''; for await (const c of req) raw += c;
  res.setHeader('content-type', 'application/json');
  if (req.headers['x-goog-api-key'] !== 'test-key') { res.statusCode = 401; return res.end('{}'); }
  const j = JSON.parse(raw);
  const names = j.tools?.[0]?.functionDeclarations?.map((d) => d.name) ?? [];
  if (!j.systemInstruction || !['search_facilities', 'plan_route', 'recommend_facilities', 'get_facility_details'].every((n) => names.includes(n))) {
    res.statusCode = 400; return res.end('{"error":"protokol tidak sesuai"}');
  }
  const first = [...j.contents].reverse().find((c) => c.role === 'user' && c.parts[0].text).parts[0].text;
  const ok = (parts) => res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] }));
  const fr = j.contents.at(-1).parts.filter((p) => p.functionResponse)[0]?.functionResponse;
  if (!fr) {
    if (/error500/i.test(first)) { res.statusCode = 500; return res.end('{}'); }
    if (/rute/i.test(first)) return ok([{ functionCall: { name: 'search_facilities', args: { query: 'Stasiun' } } }]);
    if (/rekomendasi/i.test(first)) return ok([{ functionCall: { name: 'search_facilities', args: { category: 'kesehatan', needs: ['ramp', 'lift'] } } }]);
    if (/ngawur/i.test(first)) return ok([{ functionCall: { name: 'recommend_facilities', args: { facility_ids: [99999] } } }]);
    return ok([{ text: 'Halo, saya asisten AksesKota.' }]);
  }
  const r = fr.response;
  if (fr.name === 'search_facilities' && /rute/i.test(first)) return ok([{ functionCall: { name: 'plan_route', args: { facility_id: r.hasil[0].id } } }]);
  if (fr.name === 'search_facilities') return ok([{ functionCall: { name: 'recommend_facilities', args: { facility_ids: [...r.hasil.slice(0, 2).map((h) => h.id), 424242] } } }]);
  if (fr.name === 'plan_route') return ok([{ text: r.durasi_menit ? `Rute ke ${r.fasilitas} siap, sekitar ${r.durasi_menit} menit jalan kaki.` : `Silakan izinkan lokasi untuk rute ke ${r.fasilitas}.` }]);
  if (fr.name === 'recommend_facilities') return ok([{ text: `Saya rekomendasikan ${r.diterima} tempat.` }]);
  return ok([{ text: 'Selesai.' }]);
});
}
if (process.argv[1]?.endsWith('gemini-stub.js')) createGeminiStub().listen(4998, () => console.log('gemini stub :4998'));
