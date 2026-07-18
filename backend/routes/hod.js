const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireHOD, requireInchargeOrHOD, requireStaffOrHOD } = require('../middleware/auth');
const router = express.Router();

router.get('/dashboard', requireAuth, requireHOD, async (req, res) => {
  try {
    const totalStudents = (await db.execute("SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND isActive=1")).rows[0].c;
    const totalStaff = (await db.execute("SELECT COUNT(*) as c FROM users WHERE role='STAFF' AND isActive=1")).rows[0].c;
    const totalSubjects = (await db.execute("SELECT COUNT(*) as c FROM subjects")).rows[0].c;
    const publishedExams = (await db.execute("SELECT COUNT(*) as c FROM exams WHERE isPublished=1")).rows[0].c;
    const pendingMarks = (await db.execute("SELECT COUNT(*) as c FROM exams e WHERE e.isPublished=1 AND (SELECT COUNT(*) FROM marks m WHERE m.examId=e.id AND m.marks IS NOT NULL) < (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND year=e.year AND isActive=1)")).rows[0].c;
    const studentsByYear = (await db.execute("SELECT year, COUNT(*) as count FROM users WHERE role='STUDENT' AND isActive=1 GROUP BY year ORDER BY year")).rows;
    res.json({ totalStudents, totalStaff, totalSubjects, publishedExams, pendingMarks, studentsByYear });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/students', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const { year } = req.query;
    let query = "SELECT * FROM users WHERE role='STUDENT' AND isActive=1";
    const params = [];
    if (year) { query += ' AND year=?'; params.push(parseInt(year)); }
    if (req.user.role === 'STAFF' && req.user.inchargeYear) { query += ' AND year=?'; params.push(req.user.inchargeYear); }
    query += ' ORDER BY year, rollNo';
    const students = (await db.execute({ sql: query, args: params })).rows;
    res.json({ students });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/students', requireAuth, requireHOD, async (req, res) => {
  try {
    const { name, phone, year, rollNo } = req.body;
    if (!name || !phone || !year) return res.status(400).json({ error: 'name, phone, year required' });
    const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE phone=?', args: [phone] })).rows[0];
    if (existing) return res.status(409).json({ error: 'Phone already registered' });
    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO users (id,name,phone,role,year,rollNo) VALUES (?,?,?,?,?,?)', args: [id, name, phone, 'STUDENT', year, rollNo || null] });
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/students/:id', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const { name, phone, year, rollNo } = req.body;
    if (req.user.role === 'STAFF') {
      const student = (await db.execute({ sql: 'SELECT year FROM users WHERE id=?', args: [req.params.id] })).rows[0];
      if (!student || student.year !== req.user.inchargeYear) return res.status(403).json({ error: 'Not authorized' });
    }
    await db.execute({ sql: 'UPDATE users SET name=?,phone=?,year=?,rollNo=? WHERE id=?', args: [name, phone, year, rollNo, req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/students/:id', requireAuth, requireHOD, async (req, res) => {
  try {
    await db.execute({ sql: 'UPDATE users SET isActive=0 WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/students/bulk-upload', requireAuth, requireHOD, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records[] required' });

    let added = 0, updated = 0, errors = [];
    
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name || !r.phone || !r.year) { errors.push(`Row ${i + 1}: name, phone, year required`); continue; }
      const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE phone=?', args: [r.phone] })).rows[0];
      if (existing) {
        await db.execute({ sql: 'UPDATE users SET name=?,year=?,rollNo=?,isActive=1 WHERE phone=?', args: [r.name, r.year, r.rollNo || null, r.phone] });
        updated++;
      } else {
        await db.execute({ sql: 'INSERT INTO users (id,name,phone,role,year,rollNo) VALUES (?,?,?,?,?,?)', args: [uuidv4(), r.name, r.phone, 'STUDENT', parseInt(r.year), r.rollNo || null] });
        added++;
      }
    }

    res.json({ success: true, added, updated, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/students/download-template', requireAuth, requireHOD, (req, res) => {
  const csv = 'name,phone,year,rollNo\nStudent Name,9876543210,4,IT20001\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student-template.csv"');
  res.send(csv);
});

router.get('/students/download/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized' });
    const students = (await db.execute({ sql: 'SELECT name,phone,year,rollNo FROM users WHERE role=? AND year=? AND isActive=1 ORDER BY rollNo', args: ['STUDENT', year] })).rows;
    const csv = ['name,phone,year,rollNo', ...students.map(s => `${s.name},${s.phone},${s.year},${s.rollNo || ''}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="students-year${year}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/staff', requireAuth, requireHOD, async (req, res) => {
  try {
    const staff = (await db.execute("SELECT * FROM users WHERE role='STAFF' AND isActive=1 ORDER BY name")).rows;
    res.json({ staff });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/staff', requireAuth, requireHOD, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name, phone required' });
    const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE phone=?', args: [phone] })).rows[0];
    if (existing) return res.status(409).json({ error: 'Phone already registered' });
    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO users (id,name,phone,role) VALUES (?,?,?,?)', args: [id, name, phone, 'STAFF'] });
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/staff/:id/promote', requireAuth, requireHOD, async (req, res) => {
  try {
    const { inchargeYear } = req.body;
    if (!inchargeYear) return res.status(400).json({ error: 'inchargeYear required' });
    await db.execute({ sql: 'UPDATE users SET inchargeYear=? WHERE id=? AND role=?', args: [inchargeYear, req.params.id, 'STAFF'] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/staff/:id/demote', requireAuth, requireHOD, async (req, res) => {
  try {
    await db.execute({ sql: 'UPDATE users SET inchargeYear=NULL WHERE id=? AND role=?', args: [req.params.id, 'STAFF'] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats/overview', requireAuth, requireHOD, async (req, res) => {
  try {
    const years = [2, 3, 4];
    const statsPromises = years.map(async y => ({
      year: y,
      students: (await db.execute({ sql: "SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND year=? AND isActive=1", args: [y] })).rows[0].c,
      subjects: (await db.execute({ sql: "SELECT COUNT(*) as c FROM subjects WHERE year=?", args: [y] })).rows[0].c,
      exams: (await db.execute({ sql: "SELECT COUNT(*) as c FROM exams WHERE year=? AND isPublished=1", args: [y] })).rows[0].c,
    }));
    const stats = await Promise.all(statsPromises);
    res.json({ stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
