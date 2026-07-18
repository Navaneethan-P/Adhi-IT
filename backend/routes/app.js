const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/app/timetable/:year
router.get('/timetable/:year', requireAuth, (req, res) => {
  const tt = db.prepare('SELECT * FROM timetable WHERE year=?').get(parseInt(req.params.year));
  if (!tt) return res.json({ timetable: null });
  res.json({ timetable: { ...tt, config: JSON.parse(tt.config) } });
});

// GET /api/app/exams/:year
router.get('/exams/:year', requireAuth, (req, res) => {
  const exams = db.prepare(`
    SELECT e.*, s.name as subjectName, s.code as subjectCode
    FROM exams e JOIN subjects s ON e.subjectId=s.id
    WHERE e.year=? AND e.isPublished=1
    ORDER BY e.examDate
  `).all(parseInt(req.params.year));
  res.json({ exams });
});

// GET /api/app/marks/:studentId
router.get('/marks/:studentId', requireAuth, (req, res) => {
  const { studentId } = req.params;
  if (req.user.role === 'STUDENT' && req.user.userId !== studentId) return res.status(403).json({ error: 'Forbidden' });

  const marks = db.prepare(`
    SELECT m.marks, m.enteredAt, e.title, e.type, e.maxMarks, e.examDate,
           s.name as subjectName, s.code as subjectCode
    FROM marks m
    JOIN exams e ON m.examId=e.id
    JOIN subjects s ON e.subjectId=s.id
    WHERE m.studentId=?
    ORDER BY e.examDate
  `).all(studentId);
  res.json({ marks });
});

// GET /api/app/fees/:studentId
router.get('/fees/:studentId', requireAuth, (req, res) => {
  const { studentId } = req.params;
  if (req.user.role === 'STUDENT' && req.user.userId !== studentId) return res.status(403).json({ error: 'Forbidden' });

  const fees = db.prepare('SELECT * FROM fee_payments WHERE studentId=? ORDER BY semester').all(studentId);
  res.json({ fees });
});

// GET /api/app/ranking/:year — Year-based ranking
router.get('/ranking/:year', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  // Students can only see their own year
  if (req.user.role === 'STUDENT' && req.user.year !== year) return res.status(403).json({ error: 'Forbidden' });

  const students = db.prepare("SELECT id, name, rollNo FROM users WHERE year=? AND role='STUDENT' AND isActive=1").all(year);

  const rankings = students.map(student => {
    const allMarks = db.prepare(`
      SELECT m.marks, e.maxMarks, e.type FROM marks m 
      JOIN exams e ON m.examId=e.id 
      WHERE m.studentId=? AND m.marks IS NOT NULL
    `).all(student.id);

    const total = allMarks.reduce((s, m) => s + m.marks, 0);
    const maxTotal = allMarks.reduce((s, m) => s + m.maxMarks, 0);
    const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : null;

    const byType = {};
    ['IA1','IA2','SEMESTER'].forEach(type => {
      const tMarks = allMarks.filter(m => m.type === type);
      const tTotal = tMarks.reduce((s, m) => s + m.marks, 0);
      const tMax = tMarks.reduce((s, m) => s + m.maxMarks, 0);
      byType[type] = tMax > 0 ? Math.round((tTotal / tMax) * 100) : null;
    });

    const coding = db.prepare('SELECT leetcode, hackerrank, contestRating FROM coding_scores WHERE studentId=?').get(student.id);

    return { ...student, total, maxTotal, percentage, ...byType, coding: coding || null };
  });

  // Sort by overall percentage desc
  rankings.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  rankings.forEach((r, i) => { r.rank = i + 1; });

  res.json({ rankings });
});

// GET /api/app/staff-schedule/:staffId — Staff sees their assigned subjects per day
router.get('/staff-schedule/:staffId', requireAuth, (req, res) => {
  const { staffId } = req.params;
  const subjects = db.prepare(`
    SELECT s.id, s.name, s.code, s.year, s.hoursPerWeek
    FROM subjects s
    JOIN subject_staff ss ON s.id=ss.subjectId AND ss.staffId=?
    WHERE s.isActive=1
  `).all(staffId);

  // Get timetable entries for each year this staff teaches
  const years = [...new Set(subjects.map(s => s.year))];
  const timetables = {};
  years.forEach(y => {
    const tt = db.prepare('SELECT config FROM timetable WHERE year=?').get(y);
    if (tt) {
      const config = JSON.parse(tt.config);
      timetables[y] = config;
    }
  });

  res.json({ subjects, timetables });
});

// GET /api/app/class-list/:year — Staff gets student list for a year (to take attendance)
router.get('/class-list/:year', requireAuth, (req, res) => {
  const students = db.prepare(`
    SELECT id, name, rollNo FROM users
    WHERE year=? AND role='STUDENT' AND isActive=1
    ORDER BY rollNo
  `).all(parseInt(req.params.year));
  res.json({ students });
});

// GET /api/app/fee-pending/:year — Staff/HOD sees fee pending list
router.get('/fee-pending/:year', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  const pending = db.prepare(`
    SELECT u.id, u.name, u.rollNo, 
           SUM(f.totalFee) as totalFee, SUM(f.paidAmount) as paidAmount,
           SUM(f.totalFee - f.paidAmount) as balance
    FROM users u
    LEFT JOIN fee_payments f ON u.id=f.studentId
    WHERE u.year=? AND u.role='STUDENT' AND u.isActive=1
    GROUP BY u.id
    HAVING balance > 0
    ORDER BY balance DESC
  `).all(year);
  res.json({ pending });
});

// GET /api/app/pass-fail/:year/:examType — Staff checks pass/avg/fail list
router.get('/pass-fail/:year/:examType', requireAuth, (req, res) => {
  const year = parseInt(req.params.year);
  const type = req.params.examType; // IA1, IA2, SEMESTER, or 'ALL'

  const students = db.prepare("SELECT id, name, rollNo FROM users WHERE year=? AND role='STUDENT' AND isActive=1").all(year);

  const result = students.map(student => {
    let marksQuery = `
      SELECT m.marks, e.maxMarks FROM marks m 
      JOIN exams e ON m.examId=e.id 
      WHERE m.studentId=? AND m.marks IS NOT NULL
    `;
    const params = [student.id];
    if (type !== 'ALL') { marksQuery += ' AND e.type=?'; params.push(type); }

    const allMarks = db.prepare(marksQuery).all(...params);
    if (!allMarks.length) return { ...student, status: 'No Marks', percentage: null };

    const total = allMarks.reduce((s, m) => s + m.marks, 0);
    const maxTotal = allMarks.reduce((s, m) => s + m.maxMarks, 0);
    const pct = Math.round((total / maxTotal) * 100);
    return {
      ...student,
      percentage: pct,
      status: pct >= 60 ? 'Pass' : pct >= 40 ? 'Average' : 'Fail'
    };
  });

  res.json({ result });
});

module.exports = router;
