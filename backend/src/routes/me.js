import express from 'express';
import { z } from 'zod';
import { many, pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { sanitizeNeeds } from '../match.js';

export const router = express.Router();

// Profil kebutuhan aksesibilitas user (PRD 9)
router.get('/me/accessibility-profile', requireAuth, async (req, res) => {
  const rows = await many(
    'select attribute_code from accessibility_profiles where user_id = $1 and is_required order by attribute_code',
    [req.user.id],
  );
  res.json({ attributes: rows.map((r) => r.attribute_code) });
});

router.put('/me/accessibility-profile', requireAuth, async (req, res) => {
  const { attributes } = z.object({ attributes: z.array(z.string()).max(20) }).parse(req.body);
  const codes = await sanitizeNeeds(attributes);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from accessibility_profiles where user_id = $1', [req.user.id]);
    if (codes.length) {
      await client.query(
        'insert into accessibility_profiles (user_id, attribute_code) select $1, unnest($2::text[])',
        [req.user.id, codes],
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  res.json({ attributes: codes });
});

// Kontribusi milik sendiri + statusnya
router.get('/me/contributions', requireAuth, async (req, res) => {
  res.json(await many(
    `select c.id, c.facility_id, c.change_type, c.payload, c.status, c.review_note, c.reviewed_at, c.created_at,
            coalesce(f.name, c.payload->'facility'->>'name') as facility_name
       from contributions c left join facilities f on f.id = c.facility_id
      where c.submitted_by = $1 order by c.id desc limit 100`,
    [req.user.id],
  ));
});
