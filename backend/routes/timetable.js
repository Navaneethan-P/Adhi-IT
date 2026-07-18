const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireInchargeOrHOD } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/timetable/:year ───────────────────────────────────────────────────
router.get('/:year', requireAuth, (req, res) => {
  const tt = db.prepare('SELECT * FROM timetable WHERE year=?').get(parseInt(req.params.year));
  if (!tt) return res.json({ timetable: null });
  res.json({ timetable: { ...tt, weeklySlots: JSON.parse(tt.weeklySlots) } });
});

// ── POST /api/timetable/generate/:year ──────────────────────────────────────────
router.post('/generate/:year', requireAuth, requireInchargeOrHOD, (req, res) => {
  const year = parseInt(req.params.year);
  if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });

  const { placements } = req.body || {}; 
  // placements is an object mapping day to an array of period indexes e.g., { Monday: [0, 1] }

  const subjects = db.prepare('SELECT code FROM subjects WHERE year = ?').all(year).map(s => s.code);
  if (subjects.length === 0) return res.status(400).json({ error: 'No subjects found for this year' });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const maxPeriods = 4; // Using the 4-period default for UI
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
});

// ── POST /api/timetable/:year ──────────────────────────────────────────────────
router.post('/:year', requireAuth, requireInchargeOrHOD, (req, res) => {
  const year = parseInt(req.params.year);
  if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });

  const { weeklySlots } = req.body;
  if (!weeklySlots) return res.status(400).json({ error: 'weeklySlots required' });

  db.prepare(`
    INSERT INTO timetable (id,year,weeklySlots,publishedBy,publishedAt) VALUES (?,?,?,?,?)
    ON CONFLICT(year) DO UPDATE SET weeklySlots=excluded.weeklySlots, publishedBy=excluded.publishedBy, publishedAt=excluded.publishedAt
  `).run(uuidv4(), year, JSON.stringify(weeklySlots), req.user.userId, new Date().toISOString());

  // Notify students
  db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(uuidv4(), ' Timetable Updated', `Year ${year} timetable has been published. Check your Timetable section.`, 'STUDENT', year, req.user.userId, new Date().toISOString());

  const io = req.app.get('io');
  if (io) io.to(`year:${year}`).emit('notification', { title: 'Timetable Updated' });

  res.json({ success: true });
});

module.exports = router;
