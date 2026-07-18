const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireHOD, requireInchargeOrHOD, requireStaffOrHOD } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/hod/dashboard ────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, requireHOD, (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND isActive=1").get().c;
  const totalStaff = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='STAFF' AND isActive=1").get().c;
  const totalSubjects = db.prepare("SELECT COUNT(*) as c FROM subjects").get().c;
  const publishedExams = db.prepare("SELECT COUNT(*) as c FROM exams WHERE isPublished=1").get().c;
  const pendingMarks = db.prepare("SELECT COUNT(*) as c FROM exams e WHERE e.isPublished=1 AND (SELECT COUNT(*) FROM marks m WHERE m.examId=e.id AND m.marks IS NOT NULL) < (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND year=e.year AND isActive=1)").get().c;
  const studentsByYear = db.prepare("SELECT year, COUNT(*) as count FROM users WHERE role='STUDENT' AND isActive=1 GROUP BY year ORDER BY year").all();
  res.json({ totalStudents, totalStaff, totalSubjects, publishedExams, pendingMarks, studentsByYear });
});

// ── GET /api/hod/students ─────────────────────────────────────────────────────
router.get('/students', requireAuth, requireInchargeOrHOD, (req, res) => {
  const { year } = req.query;
  let query = "SELECT * FROM users WHERE role='STUDENT' AND isActive=1";
  const params = [];
  if (year) { query += ' AND year=?'; params.push(parseInt(year)); }
  if (req.user.role === 'STAFF' && req.user.inchargeYear) { query += ' AND year=?'; params.push(req.user.inchargeYear); }
  query += ' ORDER BY year, rollNo';
  const students = db.prepare(query).all(...params);
  res.json({ students });
});

// ── POST /api/hod/students ────────────────────────────────────────────────────
router.post('/students', requireAuth, requireHOD, (req, res) => {
  const { name, phone, year, rollNo } = req.body;
  if (!name || !phone || !year) return res.status(400).json({ error: 'name, phone, year required' });
  const existing = db.prepare('SELECT id FROM users WHERE phone=?').get(phone);
  if (existing) return res.status(409).json({ error: 'Phone already registered' });
  const id = uuidv4();
  db.prepare('INSERT INTO users (id,name,phone,role,year,rollNo) VALUES (?,?,?,?,?,?)').run(id, name, phone, 'STUDENT', year, rollNo || null);
  res.json({ success: true, id });
});

// ── PUT /api/hod/students/:id ─────────────────────────────────────────────────
router.put('/students/:id', requireAuth, requireInchargeOrHOD, (req, res) => {
  const { name, phone, year, rollNo } = req.body;
  if (req.user.role === 'STAFF') {
    const student = db.prepare('SELECT year FROM users WHERE id=?').get(req.params.id);
    if (!student || student.year !== req.user.inchargeYear) return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('UPDATE users SET name=?,phone=?,year=?,rollNo=? WHERE id=?').run(name, phone, year, rollNo, req.params.id);
  res.json({ success: true });
});

// ── DELETE /api/hod/students/:id ──────────────────────────────────────────────
router.delete('/students/:id', requireAuth, requireHOD, (req, res) => {
  db.prepare('UPDATE users SET isActive=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── POST /api/hod/students/bulk-upload ────────────────────────────────────────
// records: [{name, phone, year, rollNo}]
router.post('/students/bulk-upload', requireAuth, requireHOD, (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records[] required' });

  let added = 0, updated = 0, errors = [];
  const tx = db.transaction(() => {
    records.forEach((r, i) => {
      if (!r.name || !r.phone || !r.year) { errors.push(`Row ${i + 1}: name, phone, year required`); return; }
      const existing = db.prepare('SELECT id FROM users WHERE phone=?').get(r.phone);
      if (existing) {
        db.prepare('UPDATE users SET name=?,year=?,rollNo=?,isActive=1 WHERE phone=?').run(r.name, r.year, r.rollNo || null, r.phone);
        updated++;
      } else {
        db.prepare('INSERT INTO users (id,name,phone,role,year,rollNo) VALUES (?,?,?,?,?,?)').run(uuidv4(), r.name, r.phone, 'STUDENT', parseInt(r.year), r.rollNo || null);
        added++;
      }
    });
  });
  tx();

  res.json({ success: true, added, updated, errors });
});

// ── GET /api/hod/students/download-template ───────────────────────────────────
router.get('/students/download-template', requireAuth, requireHOD, (req, res) => {
  const csv = 'name,phone,year,rollNo\nStudent Name,9876543210,4,IT20001\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student-template.csv"');
  res.send(csv);
});

// ── GET /api/hod/students/download/:year ──────────────────────────────────────
router.get('/students/download/:year', requireAuth, requireInchargeOrHOD, (req, res) => {
  const year = parseInt(req.params.year);
  if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized' });
  const students = db.prepare('SELECT name,phone,year,rollNo FROM users WHERE role=? AND year=? AND isActive=1 ORDER BY rollNo').all('STUDENT', year);
  const csv = ['name,phone,year,rollNo', ...students.map(s => `${s.name},${s.phone},${s.year},${s.rollNo || ''}`)].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="students-year${year}.csv"`);
  res.send(csv);
});

// ── GET /api/hod/staff ────────────────────────────────────────────────────────
router.get('/staff', requireAuth, requireHOD, (req, res) => {
  const staff = db.prepare("SELECT * FROM users WHERE role='STAFF' AND isActive=1 ORDER BY name").all();
  res.json({ staff });
});

// ── POST /api/hod/staff ───────────────────────────────────────────────────────
router.post('/staff', requireAuth, requireHOD, (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name, phone required' });
  const existing = db.prepare('SELECT id FROM users WHERE phone=?').get(phone);
  if (existing) return res.status(409).json({ error: 'Phone already registered' });
  const id = uuidv4();
  db.prepare('INSERT INTO users (id,name,phone,role) VALUES (?,?,?,?)').run(id, name, phone, 'STAFF');
  res.json({ success: true, id });
});

// ── PUT /api/hod/staff/:id/promote ────────────────────────────────────────────
router.put('/staff/:id/promote', requireAuth, requireHOD, (req, res) => {
  const { inchargeYear } = req.body;
  if (!inchargeYear) return res.status(400).json({ error: 'inchargeYear required' });
  db.prepare('UPDATE users SET inchargeYear=? WHERE id=? AND role=?').run(inchargeYear, req.params.id, 'STAFF');
  res.json({ success: true });
});

// ── PUT /api/hod/staff/:id/demote ─────────────────────────────────────────────
router.put('/staff/:id/demote', requireAuth, requireHOD, (req, res) => {
  db.prepare('UPDATE users SET inchargeYear=NULL WHERE id=? AND role=?').run(req.params.id, 'STAFF');
  res.json({ success: true });
});

// ── GET /api/hod/stats/overview ───────────────────────────────────────────────
router.get('/stats/overview', requireAuth, requireHOD, (req, res) => {
  const years = [2, 3, 4];
  const stats = years.map(y => ({
    year: y,
    students: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND year=? AND isActive=1").get(y).c,
    subjects: db.prepare("SELECT COUNT(*) as c FROM subjects WHERE year=?").get(y).c,
    exams: db.prepare("SELECT COUNT(*) as c FROM exams WHERE year=? AND isPublished=1").get(y).c,
  }));
  res.json({ stats });
});

module.exports = router;
