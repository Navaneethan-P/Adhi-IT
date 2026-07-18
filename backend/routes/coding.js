const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireInchargeOrHOD } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/coding/ranking/:year ─────────────────────────────────────────────
router.get('/ranking/:year', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  const scores = db.prepare(`
    SELECT u.id, u.name, u.rollNo, c.leetcode, c.hackerrank, c.contestRating, c.updatedAt,
           (COALESCE(c.leetcode,0) + COALESCE(c.hackerrank,0)) as totalScore
    FROM users u
    LEFT JOIN coding_scores c ON u.id=c.studentId
    WHERE u.role='STUDENT' AND u.year=? AND u.isActive=1
    ORDER BY totalScore DESC, c.contestRating DESC
  `).all(year);
  res.json({ ranking: scores.map((s, i) => ({ ...s, rank: i + 1 })) });
});

// ── PUT /api/coding/score/:studentId ──────────────────────────────────────────
router.put('/score/:studentId', requireAuth, requireInchargeOrHOD, (req, res) => {
  const { leetcode, hackerrank, contestRating } = req.body;
  const sid = req.params.studentId;

  if (req.user.role === 'STAFF') {
    const student = db.prepare('SELECT year FROM users WHERE id=?').get(sid);
    if (!student || student.year !== req.user.inchargeYear) return res.status(403).json({ error: 'Not authorized for this student' });
  }

  db.prepare(`
    INSERT INTO coding_scores (id,studentId,leetcode,hackerrank,contestRating,updatedBy,updatedAt)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(studentId) DO UPDATE SET
      leetcode=excluded.leetcode, hackerrank=excluded.hackerrank,
      contestRating=excluded.contestRating, updatedBy=excluded.updatedBy, updatedAt=excluded.updatedAt
  `).run(uuidv4(), sid, leetcode || 0, hackerrank || 0, contestRating || 0, req.user.userId, new Date().toISOString());

  res.json({ success: true });
});

// ── POST /api/coding/bulk-update ──────────────────────────────────────────────
router.post('/bulk-update', requireAuth, requireInchargeOrHOD, (req, res) => {
  const { records } = req.body; // [{rollNo, leetcode, hackerrank, contestRating}]
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records[] required' });

  let updated = 0;
  const tx = db.transaction(() => {
    records.forEach(r => {
      const student = db.prepare('SELECT id FROM users WHERE rollNo=? AND role=?').get(r.rollNo, 'STUDENT');
      if (!student) return;
      db.prepare(`
        INSERT INTO coding_scores (id,studentId,leetcode,hackerrank,contestRating,updatedBy,updatedAt)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(studentId) DO UPDATE SET leetcode=excluded.leetcode,hackerrank=excluded.hackerrank,contestRating=excluded.contestRating,updatedBy=excluded.updatedBy,updatedAt=excluded.updatedAt
      `).run(uuidv4(), student.id, r.leetcode || 0, r.hackerrank || 0, r.contestRating || 0, req.user.userId, new Date().toISOString());
      updated++;
    });
  });
  tx();
  res.json({ success: true, updated });
});

module.exports = router;
