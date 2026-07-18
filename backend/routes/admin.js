const express = require('express');
const { db, uuidv4, hashPassword } = require('../db');
const router = express.Router();

// All admin routes are accessible from the local PC admin panel (no JWT needed for LAN access)
// For security in production, add API key middleware here

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════

router.get('/users', (req, res) => {
  const { role, year } = req.query;
  let query = 'SELECT id, name, rollNo, role, year, department, inchargeYear, isActive FROM users';
  const params = [];
  const conditions = [];
  if (role) { conditions.push('role = ?'); params.push(role); }
  if (year) { conditions.push('year = ?'); params.push(parseInt(year)); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY role, year, name';
  res.json({ users: db.prepare(query).all(...params) });
});

router.post('/users', (req, res) => {
  const { name, rollNo, role, year, department, inchargeYear } = req.body;
  if (!name || !rollNo || !role) return res.status(400).json({ error: 'name, rollNo, role required' });

  // Default password = last 4 digits of rollNo
  const defaultPassword = rollNo.toString().slice(-4);
  const id = uuidv4();
  try {
    db.prepare(`
      INSERT INTO users (id, name, rollNo, password, role, year, department, inchargeYear)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, rollNo, hashPassword(defaultPassword), role, year || null, department || 'IT', inchargeYear || null);
    res.json({ success: true, id, defaultPassword });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Roll number already exists' });
    throw e;
  }
});

router.put('/users/:id', (req, res) => {
  const { name, rollNo, role, year, department, inchargeYear, isActive, resetPassword } = req.body;
  const user = db.prepare('SELECT id, rollNo FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users SET name=?, rollNo=?, role=?, year=?, department=?, inchargeYear=?, isActive=?
    WHERE id=?
  `).run(name, rollNo, role, year || null, department || 'IT', inchargeYear || null, isActive ? 1 : 0, req.params.id);

  let newDefaultPass = null;
  if (resetPassword) {
    newDefaultPass = rollNo.toString().slice(-4);
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPassword(newDefaultPass), req.params.id);
  }

  res.json({ success: true, defaultPassword: newDefaultPass });
});

router.delete('/users/:id', (req, res) => {
  db.prepare('UPDATE users SET isActive=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// SUBJECTS
// ═══════════════════════════════════════════════════════════════

router.get('/subjects', (req, res) => {
  const { year } = req.query;
  const subjects = year
    ? db.prepare('SELECT s.*, GROUP_CONCAT(u.name, ", ") as staffNames FROM subjects s LEFT JOIN subject_staff ss ON s.id=ss.subjectId LEFT JOIN users u ON ss.staffId=u.id WHERE s.year=? AND s.isActive=1 GROUP BY s.id ORDER BY s.year, s.name').all(parseInt(year))
    : db.prepare('SELECT s.*, GROUP_CONCAT(u.name, ", ") as staffNames FROM subjects s LEFT JOIN subject_staff ss ON s.id=ss.subjectId LEFT JOIN users u ON ss.staffId=u.id WHERE s.isActive=1 GROUP BY s.id ORDER BY s.year, s.name').all();
  res.json({ subjects });
});

router.post('/subjects', (req, res) => {
  const { name, code, year, semester, credits, hoursPerWeek, staffIds } = req.body;
  if (!name || !code || !year) return res.status(400).json({ error: 'name, code, year required' });

  const id = uuidv4();
  try {
    db.prepare('INSERT INTO subjects (id,name,code,year,semester,credits,hoursPerWeek) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, code, year, semester || 1, credits || 3, hoursPerWeek || 4);

    if (staffIds && staffIds.length) {
      const ins = db.prepare('INSERT OR IGNORE INTO subject_staff (id,subjectId,staffId) VALUES (?,?,?)');
      staffIds.forEach(sId => ins.run(uuidv4(), id, sId));
    }
    res.json({ success: true, id });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Subject code already exists' });
    throw e;
  }
});

router.put('/subjects/:id', (req, res) => {
  const { name, code, year, semester, credits, hoursPerWeek, staffIds } = req.body;
  db.prepare('UPDATE subjects SET name=?,code=?,year=?,semester=?,credits=?,hoursPerWeek=? WHERE id=?')
    .run(name, code, year, semester, credits, hoursPerWeek, req.params.id);

  if (staffIds !== undefined) {
    db.prepare('DELETE FROM subject_staff WHERE subjectId=?').run(req.params.id);
    if (staffIds.length) {
      const ins = db.prepare('INSERT OR IGNORE INTO subject_staff (id,subjectId,staffId) VALUES (?,?,?)');
      staffIds.forEach(sId => ins.run(uuidv4(), req.params.id, sId));
    }
  }
  res.json({ success: true });
});

router.delete('/subjects/:id', (req, res) => {
  db.prepare('UPDATE subjects SET isActive=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// TIMETABLE
// ═══════════════════════════════════════════════════════════════

router.get('/timetable/:year', (req, res) => {
  const tt = db.prepare('SELECT * FROM timetable WHERE year=?').get(parseInt(req.params.year));
  if (!tt) return res.json({ timetable: null });
  res.json({ timetable: { ...tt, config: JSON.parse(tt.config) } });
});

router.post('/timetable/:year', (req, res) => {
  const year = parseInt(req.params.year);
  const { config, publishedBy } = req.body;
  if (!config) return res.status(400).json({ error: 'config required' });

  db.prepare(`
    INSERT INTO timetable (id,year,config,publishedBy,publishedAt) VALUES (?,?,?,?,?)
    ON CONFLICT(year) DO UPDATE SET config=excluded.config, publishedBy=excluded.publishedBy, publishedAt=excluded.publishedAt
  `).run(uuidv4(), year, JSON.stringify(config), publishedBy || null, new Date().toISOString());

  // Notify students of this year
  const notifId = uuidv4();
  db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(notifId, 'Timetable Updated', `Year ${year} timetable has been published by Admin.`, 'STUDENT', year, publishedBy || null, new Date().toISOString());

  const io = global.io;
  if (io) io.to(`year:${year}`).emit('notification', { title: 'Timetable Updated' });

  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// EXAMS
// ═══════════════════════════════════════════════════════════════

router.get('/exams', (req, res) => {
  const { year } = req.query;
  const exams = year
    ? db.prepare('SELECT e.*, s.name as subjectName, s.code as subjectCode FROM exams e JOIN subjects s ON e.subjectId=s.id WHERE e.year=? ORDER BY e.examDate').all(parseInt(year))
    : db.prepare('SELECT e.*, s.name as subjectName, s.code as subjectCode FROM exams e JOIN subjects s ON e.subjectId=s.id ORDER BY e.year, e.examDate').all();
  res.json({ exams });
});

router.post('/exams', (req, res) => {
  const { title, type, subjectId, year, examDate, maxMarks } = req.body;
  if (!title || !type || !subjectId || !year) return res.status(400).json({ error: 'title, type, subjectId, year required' });

  const id = uuidv4();
  db.prepare('INSERT INTO exams (id,title,type,subjectId,year,examDate,maxMarks) VALUES (?,?,?,?,?,?,?)')
    .run(id, title, type, subjectId, year, examDate || null, maxMarks || 50);
  res.json({ success: true, id });
});

router.put('/exams/:id', (req, res) => {
  const { title, type, examDate, maxMarks, isPublished } = req.body;
  db.prepare('UPDATE exams SET title=?,type=?,examDate=?,maxMarks=?,isPublished=? WHERE id=?')
    .run(title, type, examDate, maxMarks, isPublished ? 1 : 0, req.params.id);

  if (isPublished) {
    const exam = db.prepare('SELECT * FROM exams WHERE id=?').get(req.params.id);
    if (exam) {
      db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
        .run(uuidv4(), `Exam Published: ${title}`, `${type} exam has been scheduled. Check your exam timetable.`, 'STUDENT', exam.year, null, new Date().toISOString());
      const io = global.io;
      if (io) io.to(`year:${exam.year}`).emit('notification', { title: `Exam: ${title}` });
    }
  }
  res.json({ success: true });
});

router.delete('/exams/:id', (req, res) => {
  db.prepare('DELETE FROM exams WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// MARKS
// ═══════════════════════════════════════════════════════════════

router.get('/marks/:examId', (req, res) => {
  const rows = db.prepare(`
    SELECT m.studentId, m.marks, m.enteredAt, u.name, u.rollNo
    FROM marks m JOIN users u ON m.studentId=u.id
    WHERE m.examId=?
    ORDER BY u.rollNo
  `).all(req.params.examId);
  res.json({ marks: rows });
});

router.post('/marks/:examId', (req, res) => {
  // Bulk upsert: [{ studentId, marks }]
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

  const upsert = db.prepare(`
    INSERT INTO marks (id, examId, studentId, marks, enteredAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(examId, studentId) DO UPDATE SET marks=excluded.marks, enteredAt=excluded.enteredAt
  `);
  const tx = db.transaction(() => {
    entries.forEach(e => upsert.run(uuidv4(), req.params.examId, e.studentId, e.marks, new Date().toISOString()));
  });
  tx();
  res.json({ success: true, count: entries.length });
});

// ═══════════════════════════════════════════════════════════════
// ATTENDANCE (Admin can view/edit any day)
// ═══════════════════════════════════════════════════════════════

router.get('/attendance', (req, res) => {
  const { year, date, subjectId } = req.query;
  let query = `SELECT a.*, s.name as subjectName, u.name as staffName
    FROM attendance a
    JOIN subjects s ON a.subjectId=s.id
    LEFT JOIN users u ON a.staffId=u.id
    WHERE 1=1`;
  const params = [];
  if (year) { query += ' AND a.year=?'; params.push(parseInt(year)); }
  if (date) { query += ' AND a.date=?'; params.push(date); }
  if (subjectId) { query += ' AND a.subjectId=?'; params.push(subjectId); }
  query += ' ORDER BY a.date DESC, a.period';
  res.json({ attendance: db.prepare(query).all(...params) });
});

router.put('/attendance/:id', (req, res) => {
  const { presentIds, absentIds } = req.body;
  db.prepare('UPDATE attendance SET presentIds=?, absentIds=? WHERE id=?')
    .run(JSON.stringify(presentIds || []), JSON.stringify(absentIds || []), req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// FEES
// ═══════════════════════════════════════════════════════════════

router.get('/fees', (req, res) => {
  const { year } = req.query;
  const fees = year
    ? db.prepare('SELECT f.*, u.name, u.rollNo FROM fee_payments f JOIN users u ON f.studentId=u.id WHERE u.year=? ORDER BY u.rollNo').all(parseInt(year))
    : db.prepare('SELECT f.*, u.name, u.rollNo, u.year FROM fee_payments f JOIN users u ON f.studentId=u.id ORDER BY u.year, u.rollNo').all();
  res.json({ fees });
});

router.post('/fees', (req, res) => {
  const { studentId, semester, totalFee, paidAmount, dueDate, notes } = req.body;
  if (!studentId || !semester) return res.status(400).json({ error: 'studentId and semester required' });

  db.prepare(`
    INSERT INTO fee_payments (id,studentId,semester,totalFee,paidAmount,dueDate,notes,updatedAt)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(studentId,semester) DO UPDATE SET totalFee=excluded.totalFee, paidAmount=excluded.paidAmount, dueDate=excluded.dueDate, notes=excluded.notes, updatedAt=excluded.updatedAt
  `).run(uuidv4(), studentId, semester, totalFee || 0, paidAmount || 0, dueDate || null, notes || null, new Date().toISOString());
  res.json({ success: true });
});

// Bulk fees update
router.post('/fees/bulk', (req, res) => {
  const { entries } = req.body; // [{ studentId, semester, totalFee, paidAmount }]
  const upsert = db.prepare(`
    INSERT INTO fee_payments (id,studentId,semester,totalFee,paidAmount,updatedAt) VALUES (?,?,?,?,?,?)
    ON CONFLICT(studentId,semester) DO UPDATE SET totalFee=excluded.totalFee, paidAmount=excluded.paidAmount, updatedAt=excluded.updatedAt
  `);
  const tx = db.transaction(() => entries.forEach(e => upsert.run(uuidv4(), e.studentId, e.semester, e.totalFee||0, e.paidAmount||0, new Date().toISOString())));
  tx();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// CODING SCORES
// ═══════════════════════════════════════════════════════════════

router.get('/coding', (req, res) => {
  const { year } = req.query;
  const rows = year
    ? db.prepare('SELECT c.*, u.name, u.rollNo FROM coding_scores c JOIN users u ON c.studentId=u.id WHERE u.year=? ORDER BY u.rollNo').all(parseInt(year))
    : db.prepare('SELECT c.*, u.name, u.rollNo, u.year FROM coding_scores c JOIN users u ON c.studentId=u.id ORDER BY u.year, u.rollNo').all();
  res.json({ scores: rows });
});

router.post('/coding', (req, res) => {
  const { studentId, leetcode, hackerrank, contestRating } = req.body;
  db.prepare(`
    INSERT INTO coding_scores (id,studentId,leetcode,hackerrank,contestRating,updatedAt) VALUES (?,?,?,?,?,?)
    ON CONFLICT(studentId) DO UPDATE SET leetcode=excluded.leetcode, hackerrank=excluded.hackerrank, contestRating=excluded.contestRating, updatedAt=excluded.updatedAt
  `).run(uuidv4(), studentId, leetcode||0, hackerrank||0, contestRating||0, new Date().toISOString());
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════

router.get('/announcements', (req, res) => {
  const notifs = db.prepare('SELECT n.*, u.name as senderName FROM notifications n LEFT JOIN users u ON n.sentByUserId=u.id ORDER BY n.createdAt DESC LIMIT 100').all();
  res.json({ announcements: notifs });
});

router.post('/announcements', (req, res) => {
  const { title, body, targetRole, targetYear, sentByUserId } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  const id = uuidv4();
  db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(id, title, body, targetRole || null, targetYear || null, sentByUserId || null, new Date().toISOString());

  const io = global.io;
  if (io) {
    if (targetYear) io.to(`year:${targetYear}`).emit('notification', { title, body });
    else io.emit('notification', { title, body });
  }
  res.json({ success: true, id });
});

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = JSON.parse(r.value); });
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, JSON.stringify(value));
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// STATS (Dashboard summary)
// ═══════════════════════════════════════════════════════════════

router.get('/stats', (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND isActive=1").get().c;
  const totalStaff = db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('STAFF','HOD') AND isActive=1").get().c;
  const totalSubjects = db.prepare("SELECT COUNT(*) as c FROM subjects WHERE isActive=1").get().c;
  const totalExams = db.prepare("SELECT COUNT(*) as c FROM exams").get().c;
  const pendingFees = db.prepare("SELECT COUNT(*) as c FROM fee_payments WHERE totalFee > paidAmount").get().c;
  const years = db.prepare("SELECT DISTINCT year FROM users WHERE role='STUDENT' AND isActive=1 ORDER BY year").all().map(r => r.year);
  res.json({ totalStudents, totalStaff, totalSubjects, totalExams, pendingFees, years });
});

module.exports = router;
