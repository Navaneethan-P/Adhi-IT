const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/:year', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STUDENT' && req.user.year !== year) return res.status(403).json({ error: 'Forbidden' });

    const result = await db.execute({ sql: `
      SELECT c.*, u.name, u.rollNo
      FROM coding_scores c
      JOIN users u ON c.studentId=u.id
      WHERE u.year=? AND u.isActive=1
      ORDER BY (c.leetcode + c.hackerrank) DESC
    `, args: [year] });
    res.json({ scores: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
