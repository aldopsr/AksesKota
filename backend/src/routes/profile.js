import express from 'express';
import { z } from 'zod';
import { many, q, tx } from '../db.js';
import { semuaKode } from '../match.js';
import { requireAuth } from '../auth.js';

export const router = express.Router();

router.use(requireAuth); // profil kebutuhan aksesibilitas hanya untuk user login (PRD 9)

router.get('/accessibility', async (req, res) => {
  const rows = await many(
    `select p.attribute_code, a.name, a.icon
       from accessibility_profiles p join accessibility_attributes a on a.code = p.attribute_code
      where p.user_id = $1 and p.is_required
      order by a.sort`,
    [req.user.id],
  );
  res.json({ needs: rows.map((r) => r.attribute_code), detail: rows });
});

/** Ganti seluruh isi profil (bukan tambah satu-satu) — UI-nya daftar centang, jadi kirim penuh. */
router.put('/accessibility', async (req, res) => {
  const codes = z.array(z.string()).max(20).parse(req.body.needs);
  const valid = await semuaKode();
  const salah = codes.filter((c) => !valid.has(c));
  if (salah.length) return res.status(400).json({ error: `Kode atribut tidak dikenal: ${salah.join(', ')}` });

  const unik = [...new Set(codes)];
  await tx(async (c) => {
    await c.query('delete from accessibility_profiles where user_id = $1', [req.user.id]);
    if (unik.length)
      await c.query(
        'insert into accessibility_profiles (user_id, attribute_code) select $1, unnest($2::text[])',
        [req.user.id, unik],
      );
  });
  res.json({ needs: unik });
});

router.delete('/accessibility', async (req, res) => {
  await q('delete from accessibility_profiles where user_id = $1', [req.user.id]);
  res.json({ needs: [] });
});
