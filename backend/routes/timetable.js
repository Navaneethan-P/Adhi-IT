const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireInchargeOrHOD } = require('../middleware/auth');
const router = express.Router();

router.get('/:year', requireAuth, async (req, res) => {
  try {
    const ttRes = await db.execute({ sql: 'SELECT * FROM timetable WHERE year=?', args: [parseInt(req.params.year)] });
    const tt = ttRes.rows[0];
    if (!tt) return res.json({ timetable: null });
    // Keep backward compatibility: if config exists, use it, else weeklySlots
    let slots = tt.config ? JSON.parse(tt.config) : (tt.weeklySlots ? JSON.parse(tt.weeklySlots) : {});
    res.json({ timetable: { ...tt, config: slots, weeklySlots: slots } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/generate/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });

    const { placements } = req.body || {}; 

    const subjectsRes = await db.execute({ sql: 'SELECT code FROM subjects WHERE year = ?', args: [year] });
    const subjects = subjectsRes.rows.map(s => s.code);
    if (subjects.length === 0) return res.status(400).json({ error: 'No subjects found for this year' });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const maxPeriods = 4;
    const timetable = {};

    let currentSubIdx = 0;
    
    days.forEach(day => {
      timetable[day] = [];
      const placementPeriods = placements?.[day] || [];
      for (let p = 0; p < maxPeriods; p++) {
        if (placementPeriods.includes(p)) {
          timetable[day].push('PLACEMENT');
        } else {
          timetable[day].push(subjects[currentSubIdx]);
          currentSubIdx = (currentSubIdx + 1) % subjects.length;
        }
      }
    });

    res.json({ weeklySlots: timetable });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });

    const { weeklySlots, config } = req.body;
    const finalSlots = config || weeklySlots;
    if (!finalSlots) return res.status(400).json({ error: 'weeklySlots or config required' });

    await db.execute({
      sql: `INSERT INTO timetable (id,year,config,publishedBy,publishedAt) VALUES (?,?,?,?,?) ON CONFLICT(year) DO UPDATE SET config=excluded.config, publishedBy=excluded.publishedBy, publishedAt=excluded.publishedAt`,
      args: [uuidv4(), year, JSON.stringify(finalSlots), req.user.userId, new Date().toISOString()]
    });

    await db.execute({
      sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)',
      args: [uuidv4(), 'Timetable Updated', `Year ${year} timetable has been published. Check your Timetable section.`, 'STUDENT', year, req.user.userId, new Date().toISOString()]
    });

    const io = req.app.get('io');
    if (io) io.to(`year:${year}`).emit('notification', { title: 'Timetable Updated' });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
