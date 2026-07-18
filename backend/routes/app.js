const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/timetable/:year', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM timetable WHERE year=?', args: [parseInt(req.params.year)] });
    const tt = result.rows[0];
    if (!tt) return res.json({ timetable: null });
    res.json({ timetable: { ...tt, config: JSON.parse(tt.config) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/exams/:year', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: `
      SELECT e.*, s.name as subjectName, s.code as subjectCode
      FROM exams e JOIN subjects s ON e.subjectId=s.id
      WHERE e.year=? AND e.isPublished=1
      ORDER BY e.examDate
    `, args: [parseInt(req.params.year)] });
    res.json({ exams: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/marks/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.userId !== studentId) return res.status(403).json({ error: 'Forbidden' });

    const result = await db.execute({ sql: `
      SELECT m.marks, m.enteredAt, e.title, e.type, e.maxMarks, e.examDate,
             s.name as subjectName, s.code as subjectCode
      FROM marks m
      JOIN exams e ON m.examId=e.id
      JOIN subjects s ON e.subjectId=s.id
      WHERE m.studentId=?
      ORDER BY e.examDate
    `, args: [studentId] });
    res.json({ marks: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fees/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.userId !== studentId) return res.status(403).json({ error: 'Forbidden' });

    const result = await db.execute({ sql: 'SELECT * FROM fee_payments WHERE studentId=? ORDER BY semester', args: [studentId] });
    res.json({ fees: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ranking/:year', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STUDENT' && req.user.year !== year) return res.status(403).json({ error: 'Forbidden' });

    const studentsRes = await db.execute({ sql: "SELECT id, name, rollNo FROM users WHERE year=? AND role='STUDENT' AND isActive=1", args: [year] });
    
    const rankingsPromises = studentsRes.rows.map(async student => {
      const allMarksRes = await db.execute({ sql: `
        SELECT m.marks, e.maxMarks, e.type FROM marks m 
        JOIN exams e ON m.examId=e.id 
        WHERE m.studentId=? AND m.marks IS NOT NULL
      `, args: [student.id] });
      const allMarks = allMarksRes.rows;

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

      const codingRes = await db.execute({ sql: 'SELECT leetcode, hackerrank, contestRating FROM coding_scores WHERE studentId=?', args: [student.id] });
      const coding = codingRes.rows[0];

      return { ...student, total, maxTotal, percentage, ...byType, coding: coding || null };
    });

    const rankings = await Promise.all(rankingsPromises);
    rankings.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    rankings.forEach((r, i) => { r.rank = i + 1; });

    res.json({ rankings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/staff-schedule/:staffId', requireAuth, async (req, res) => {
  try {
    const { staffId } = req.params;
    const subjectsRes = await db.execute({ sql: `
      SELECT s.id, s.name, s.code, s.year, s.hoursPerWeek
      FROM subjects s
      JOIN subject_staff ss ON s.id=ss.subjectId AND ss.staffId=?
      WHERE s.isActive=1
    `, args: [staffId] });
    const subjects = subjectsRes.rows;

    const years = [...new Set(subjects.map(s => s.year))];
    const timetables = {};
    for (const y of years) {
      const ttRes = await db.execute({ sql: 'SELECT config FROM timetable WHERE year=?', args: [y] });
      const tt = ttRes.rows[0];
      if (tt) {
        timetables[y] = JSON.parse(tt.config);
      }
    }

    res.json({ subjects, timetables });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/class-list/:year', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: `
      SELECT id, name, rollNo FROM users
      WHERE year=? AND role='STUDENT' AND isActive=1
      ORDER BY rollNo
    `, args: [parseInt(req.params.year)] });
    res.json({ students: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fee-pending/:year', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const result = await db.execute({ sql: `
      SELECT u.id, u.name, u.rollNo, 
             SUM(f.totalFee) as totalFee, SUM(f.paidAmount) as paidAmount,
             SUM(f.totalFee - f.paidAmount) as balance
      FROM users u
      LEFT JOIN fee_payments f ON u.id=f.studentId
      WHERE u.year=? AND u.role='STUDENT' AND u.isActive=1
      GROUP BY u.id
      HAVING balance > 0
      ORDER BY balance DESC
    `, args: [year] });
    res.json({ pending: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pass-fail/:year/:examType', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const type = req.params.examType;

    const studentsRes = await db.execute({ sql: "SELECT id, name, rollNo FROM users WHERE year=? AND role='STUDENT' AND isActive=1", args: [year] });
    
    const resultPromises = studentsRes.rows.map(async student => {
      let marksQuery = `
        SELECT m.marks, e.maxMarks FROM marks m 
        JOIN exams e ON m.examId=e.id 
        WHERE m.studentId=? AND m.marks IS NOT NULL
      `;
      const params = [student.id];
      if (type !== 'ALL') { marksQuery += ' AND e.type=?'; params.push(type); }

      const allMarksRes = await db.execute({ sql: marksQuery, args: params });
      const allMarks = allMarksRes.rows;
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

    const result = await Promise.all(resultPromises);
    res.json({ result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
