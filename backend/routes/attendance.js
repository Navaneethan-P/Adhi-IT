const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function today() { return new Date().toISOString().split('T')[0]; }

// ── GET /api/attendance/my-periods — Staff sees their assigned periods today
router.get('/my-periods', requireAuth, (req, res) => {
  const { userId, year, inchargeYear } = req.user;
  const targetYear = inchargeYear || year;
  
  const periods = db.prepare(`
    SELECT a.*, s.name as subjectName, s.code as subjectCode
    FROM attendance a
    JOIN subject_staff ss ON a.subjectId = ss.subjectId AND ss.staffId = ?
    JOIN subjects s ON a.subjectId = s.id
    WHERE a.date = ?
    ORDER BY a.period
  `).all(userId, today());
  
  res.json({ periods });
});

// ── GET /api/attendance/students/:year — Get students for a year (for taking attendance)
router.get('/students/:year', requireAuth, (req, res) => {
  const students = db.prepare(`
    SELECT id, name, rollNo FROM users 
    WHERE year = ? AND role = 'STUDENT' AND isActive = 1
    ORDER BY rollNo
  `).all(parseInt(req.params.year));
  res.json({ students });
});

// ── GET /api/attendance/subjects/:year — Subjects a staff member teaches in a year
router.get('/subjects/:year', requireAuth, (req, res) => {
  const { userId } = req.user;
  const subjects = db.prepare(`
    SELECT s.id, s.name, s.code FROM subjects s
    JOIN subject_staff ss ON s.id = ss.subjectId AND ss.staffId = ?
    WHERE s.year = ? AND s.isActive = 1
  `).all(userId, parseInt(req.params.year));
  res.json({ subjects });
});

// ── GET /api/attendance/session — Get existing attendance for a period
router.get('/session', requireAuth, (req, res) => {
  const { subjectId, date, period } = req.query;
  if (!subjectId || !date || period === undefined) return res.status(400).json({ error: 'subjectId, date, period required' });
  
  const session = db.prepare('SELECT * FROM attendance WHERE subjectId=? AND date=? AND period=?').get(subjectId, date, parseInt(period));
  res.json({ session: session ? { ...session, presentIds: JSON.parse(session.presentIds), absentIds: JSON.parse(session.absentIds) } : null });
});

// ── POST /api/attendance — Submit or update attendance for a period
router.post('/', requireAuth, (req, res) => {
  const { subjectId, year, date, period, presentIds, absentIds } = req.body;
  if (!subjectId || !year || !date || period === undefined) return res.status(400).json({ error: 'subjectId, year, date, period required' });

  const recordDate = date || today();
  const isToday = recordDate === today();

  // Check if a record already exists
  const existing = db.prepare('SELECT * FROM attendance WHERE subjectId=? AND date=? AND period=?').get(subjectId, recordDate, parseInt(period));

  if (existing) {
    // Only staff who created it can edit on same day; Admin can always edit via /api/admin/attendance/:id
    if (!isToday) return res.status(403).json({ error: 'Cannot modify past attendance. Contact Admin.' });
    
    // Check staff is assigned to this subject
    const assigned = db.prepare('SELECT id FROM subject_staff WHERE subjectId=? AND staffId=?').get(subjectId, req.user.userId);
    if (!assigned && req.user.role !== 'HOD' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to modify this attendance' });
    }

    db.prepare('UPDATE attendance SET presentIds=?, absentIds=?, staffId=? WHERE id=?')
      .run(JSON.stringify(presentIds || []), JSON.stringify(absentIds || []), req.user.userId, existing.id);
    return res.json({ success: true, updated: true });
  }

  // New record
  const id = uuidv4();
  db.prepare('INSERT INTO attendance (id,subjectId,staffId,year,date,period,presentIds,absentIds,createdAt) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, subjectId, req.user.userId, parseInt(year), recordDate, parseInt(period), JSON.stringify(presentIds || []), JSON.stringify(absentIds || []), new Date().toISOString());
  res.json({ success: true, id, created: true });
});

// ── GET /api/attendance/student/:studentId — Student's own attendance summary
router.get('/student/:studentId', requireAuth, (req, res) => {
  const { studentId } = req.params;
  // Students can only see their own
  if (req.user.role === 'STUDENT' && req.user.userId !== studentId) return res.status(403).json({ error: 'Forbidden' });

  const subjects = db.prepare(`
    SELECT s.id, s.name, s.code,
      COUNT(a.id) as totalClasses,
      SUM(CASE WHEN INSTR(a.presentIds, ?) > 0 THEN 1 ELSE 0 END) as present
    FROM subjects s
    LEFT JOIN attendance a ON a.subjectId=s.id
    WHERE s.year=(SELECT year FROM users WHERE id=?) AND s.isActive=1
    GROUP BY s.id
  `).all(`"${studentId}"`, studentId);

  const summary = subjects.map(s => ({
    ...s,
    absent: s.totalClasses - s.present,
    percentage: s.totalClasses > 0 ? Math.round((s.present / s.totalClasses) * 100) : null
  }));

  res.json({ summary });
});

// ── GET /api/attendance/class/:year — Full class attendance (for staff/HOD view)
router.get('/class/:year', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  const { date } = req.query;

  let query = `SELECT a.*, s.name as subjectName, s.code as subjectCode, u.name as staffName
    FROM attendance a
    JOIN subjects s ON a.subjectId=s.id
    LEFT JOIN users u ON a.staffId=u.id
    WHERE a.year=?`;
  const params = [year];
  if (date) { query += ' AND a.date=?'; params.push(date); }
  query += ' ORDER BY a.date DESC, a.period';

  const rows = db.prepare(query).all(...params).map(r => ({
    ...r,
    presentIds: JSON.parse(r.presentIds),
    absentIds: JSON.parse(r.absentIds)
  }));
  res.json({ attendance: rows });
});

module.exports = router;
