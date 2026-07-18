const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireHOD, requireStaffOrHOD } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/academics/subjects/:year ─────────────────────────────────────────
router.get('/subjects/:year', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  const subjects = db.prepare(`
    SELECT s.*, u.name as staffName
    FROM subjects s
    LEFT JOIN users u ON s.staffId = u.id
    WHERE s.year = ?
    ORDER BY s.code
  `).all(year);
  res.json({ subjects });
});

// ── GET /api/academics/subjects (all) ─────────────────────────────────────────
router.get('/subjects', requireAuth, (req, res) => {
  const subjects = db.prepare(`
    SELECT s.*, u.name as staffName
    FROM subjects s
    LEFT JOIN users u ON s.staffId = u.id
    ORDER BY s.year, s.code
  `).all();
  res.json({ subjects });
});

// ── POST /api/academics/subjects ──────────────────────────────────────────────
router.post('/subjects', requireAuth, requireHOD, (req, res) => {
  const { name, code, year, semester, credits, staffId } = req.body;
  if (!name || !code || !year || !semester) return res.status(400).json({ error: 'name, code, year, semester required' });
  const id = uuidv4();
  db.prepare('INSERT INTO subjects (id,name,code,year,semester,credits,staffId) VALUES (?,?,?,?,?,?,?)').run(id, name, code, year, semester, credits || 3, staffId || null);
  res.json({ success: true, id });
});

// ── PUT /api/academics/subjects/:id ───────────────────────────────────────────
router.put('/subjects/:id', requireAuth, requireHOD, (req, res) => {
  const { name, code, year, semester, credits, staffId } = req.body;
  db.prepare('UPDATE subjects SET name=?,code=?,year=?,semester=?,credits=?,staffId=? WHERE id=?').run(name, code, year, semester, credits, staffId || null, req.params.id);
  res.json({ success: true });
});

// ── DELETE /api/academics/subjects/:id ────────────────────────────────────────
router.delete('/subjects/:id', requireAuth, requireHOD, (req, res) => {
  db.prepare('DELETE FROM subjects WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── GET /api/academics/exams/:year ────────────────────────────────────────────
router.get('/exams/:year', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  const exams = db.prepare(`
    SELECT e.*, s.name as subjectName, s.code as subjectCode, u.name as staffName,
           p.name as publishedByName
    FROM exams e
    JOIN subjects s ON e.subjectId = s.id
    LEFT JOIN users u ON s.staffId = u.id
    LEFT JOIN users p ON e.publishedBy = p.id
    WHERE e.year = ?
    ORDER BY e.type, s.code
  `).all(year);
  res.json({ exams });
});

// ── POST /api/academics/exams ─────────────────────────────────────────────────
router.post('/exams', requireAuth, requireHOD, (req, res) => {
  const { title, type, subjectId, year, examDate, examTime, maxMarks } = req.body;
  if (!type || !subjectId || !year) return res.status(400).json({ error: 'type, subjectId, year required' });
  const id = uuidv4();
  db.prepare('INSERT INTO exams (id,title,type,subjectId,year,examDate,examTime,maxMarks) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, title || type, type, subjectId, year, examDate || null, examTime || null, maxMarks || 50);
  res.json({ success: true, id });
});

// ── PUT /api/academics/exams/:id ──────────────────────────────────────────────
router.put('/exams/:id', requireAuth, requireHOD, (req, res) => {
  const { title, examDate, examTime, maxMarks } = req.body;
  db.prepare('UPDATE exams SET title=?,examDate=?,examTime=?,maxMarks=? WHERE id=?').run(title, examDate, examTime, maxMarks, req.params.id);
  res.json({ success: true });
});

// ── POST /api/academics/exams/:id/publish ─────────────────────────────────────
router.post('/exams/:id/publish', requireAuth, requireHOD, (req, res) => {
  const exam = db.prepare('SELECT e.*, s.year FROM exams e JOIN subjects s ON e.subjectId = s.id WHERE e.id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  db.prepare('UPDATE exams SET isPublished=1, publishedBy=?, publishedAt=? WHERE id=?')
    .run(req.user.userId, new Date().toISOString(), req.params.id);

  // Notify students of that year
  const notifId = uuidv4();
  db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(notifId, ` ${exam.type} Exam Scheduled`, `${exam.title} — ${exam.examDate || 'Date TBA'} ${exam.examTime ? '(' + exam.examTime + ')' : ''}. Max Marks: ${exam.maxMarks}`, 'STUDENT', exam.year, req.user.userId, new Date().toISOString());

  // Notify staff who teaches the subject
  const subject = db.prepare('SELECT staffId FROM subjects WHERE id=?').get(exam.subjectId);
  if (subject && subject.staffId) {
    db.prepare('INSERT INTO notifications (id,title,body,targetUserId,sentByUserId,createdAt) VALUES (?,?,?,?,?,?)')
      .run(uuidv4(), ` Please Enter Marks: ${exam.title}`, `${exam.type} exam published for Year ${exam.year}. Open the Mark Entry section to fill student marks.`, subject.staffId, req.user.userId, new Date().toISOString());
  }

  const io = req.app.get('io');
  if (io) io.to(`year:${exam.year}`).emit('notification', { title: `${exam.type} Exam Scheduled` });

  res.json({ success: true });
});

// ── GET /api/academics/marks/exam/:examId ─────────────────────────────────────
router.get('/marks/exam/:examId', requireAuth, requireStaffOrHOD, (req, res) => {
  const exam = db.prepare('SELECT e.*, s.year FROM exams e JOIN subjects s ON e.subjectId=s.id WHERE e.id=?').get(req.params.examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const students = db.prepare('SELECT * FROM users WHERE role=? AND year=? AND isActive=1 ORDER BY rollNo').all('STUDENT', exam.year);
  const marksMap = {};
  db.prepare('SELECT * FROM marks WHERE examId=?').all(req.params.examId).forEach(m => { marksMap[m.studentId] = m; });

  const result = students.map(s => ({
    studentId: s.id, name: s.name, rollNo: s.rollNo,
    marks: marksMap[s.id] ? marksMap[s.id].marks : null,
    entered: !!marksMap[s.id]
  }));
  res.json({ exam, students: result });
});

// ── POST /api/academics/marks ─────────────────────────────────────────────────
router.post('/marks', requireAuth, requireStaffOrHOD, (req, res) => {
  const { examId, marksData } = req.body; // marksData: [{studentId, marks}]
  if (!examId || !Array.isArray(marksData)) return res.status(400).json({ error: 'examId and marksData[] required' });

  const upsert = db.prepare('INSERT INTO marks (id,examId,studentId,marks,enteredBy,enteredAt) VALUES (?,?,?,?,?,?) ON CONFLICT(examId,studentId) DO UPDATE SET marks=excluded.marks,enteredBy=excluded.enteredBy,enteredAt=excluded.enteredAt');
  const tx = db.transaction(() => {
    marksData.forEach(({ studentId, marks }) => {
      upsert.run(uuidv4(), examId, studentId, marks !== '' ? parseFloat(marks) : null, req.user.userId, new Date().toISOString());
    });
  });
  tx();

  // Notify students
  const exam = db.prepare('SELECT e.*, s.year, s.name as subjectName FROM exams e JOIN subjects s ON e.subjectId=s.id WHERE e.id=?').get(examId);
  if (exam) {
    db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
      .run(uuidv4(), ` Marks Published: ${exam.subjectName} ${exam.type}`, `Your ${exam.type} marks for ${exam.subjectName} have been published. Check your Marks section.`, 'STUDENT', exam.year, req.user.userId, new Date().toISOString());
    const io = req.app.get('io');
    if (io) io.to(`year:${exam.year}`).emit('notification', { title: 'Marks Published' });
  }

  res.json({ success: true });
});

// ── GET /api/academics/marks/student/:studentId ───────────────────────────────
router.get('/marks/student/:studentId', requireAuth, (req, res) => {
  const sid = req.params.studentId;
  // Students can only see own marks
  if (req.user.role === 'STUDENT' && req.user.userId !== sid) return res.status(403).json({ error: 'Forbidden' });

  const marks = db.prepare(`
    SELECT m.*, e.type as examType, e.title as examTitle, e.maxMarks, e.isPublished as examPublished,
           e.examDate, s.name as subjectName, s.code as subjectCode
    FROM marks m
    JOIN exams e ON m.examId = e.id
    JOIN subjects s ON e.subjectId = s.id
    WHERE m.studentId = ?
    ORDER BY e.type, s.code
  `).all(sid);

  // Also get all published exams for this student's year (to show PENDING)
  const student = db.prepare('SELECT year FROM users WHERE id=?').get(sid);
  const allPublishedExams = student ? db.prepare(`
    SELECT e.*, s.name as subjectName, s.code as subjectCode
    FROM exams e JOIN subjects s ON e.subjectId=s.id
    WHERE e.year=? AND e.isPublished=1
    ORDER BY e.type, s.code
  `).all(student.year) : [];

  res.json({ marks, allPublishedExams });
});

// ── GET /api/academics/ranking/:year/:examType ────────────────────────────────
router.get('/ranking/:year/:examType', requireAuth, (req, res) => {
  const { year, examType } = req.params;
  const students = db.prepare('SELECT id,name,rollNo FROM users WHERE role=? AND year=? AND isActive=1').all('STUDENT', parseInt(year));

  const exams = db.prepare('SELECT id, maxMarks FROM exams WHERE year=? AND type=? AND isPublished=1').all(parseInt(year), examType);
  if (exams.length === 0) return res.json({ ranking: [], examType });

  const totalMax = exams.reduce((s, e) => s + e.maxMarks, 0);

  const ranking = students.map(s => {
    let total = 0, filled = 0;
    exams.forEach(e => {
      const m = db.prepare('SELECT marks FROM marks WHERE examId=? AND studentId=?').get(e.id, s.id);
      if (m && m.marks !== null) { total += m.marks; filled++; }
    });
    return { ...s, totalMarks: filled > 0 ? total : null, maxMarks: totalMax, filled };
  }).filter(s => s.totalMarks !== null)
    .sort((a, b) => b.totalMarks - a.totalMarks)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  res.json({ ranking, examType, totalMax });
});

// ── GET /api/academics/pending-exams (for staff to see which exams need marks) ─
router.get('/pending-exams', requireAuth, requireStaffOrHOD, (req, res) => {
  let exams;
  if (req.user.role === 'HOD') {
    exams = db.prepare(`
      SELECT e.*, s.name as subjectName, s.code as subjectCode, s.year, s.staffId,
             u.name as staffName,
             (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND year=s.year AND isActive=1) as totalStudents,
             (SELECT COUNT(*) FROM marks WHERE examId=e.id AND marks IS NOT NULL) as filledCount
      FROM exams e JOIN subjects s ON e.subjectId=s.id LEFT JOIN users u ON s.staffId=u.id
      WHERE e.isPublished=1
      ORDER BY e.publishedAt DESC
    `).all();
  } else {
    // Staff: only their subjects
    exams = db.prepare(`
      SELECT e.*, s.name as subjectName, s.code as subjectCode, s.year, s.staffId,
             (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND year=s.year AND isActive=1) as totalStudents,
             (SELECT COUNT(*) FROM marks WHERE examId=e.id AND marks IS NOT NULL) as filledCount
      FROM exams e JOIN subjects s ON e.subjectId=s.id
      WHERE e.isPublished=1 AND s.staffId=?
      ORDER BY e.publishedAt DESC
    `).all(req.user.userId);
  }
  res.json({ exams });
});

module.exports = router;
