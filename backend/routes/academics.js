const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireHOD, requireStaffOrHOD } = require('../middleware/auth');
const router = express.Router();

router.get('/subjects/:year', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const result = await db.execute({ sql: `
      SELECT s.*,
        GROUP_CONCAT(u.name, ', ') as staffName
      FROM subjects s
      LEFT JOIN subject_staff ss ON ss.subjectId = s.id
      LEFT JOIN users u ON ss.staffId = u.id
      WHERE s.year = ?
      GROUP BY s.id
      ORDER BY s.code
    `, args: [year] });
    res.json({ subjects: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/subjects', requireAuth, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT s.*,
        GROUP_CONCAT(u.name, ', ') as staffName
      FROM subjects s
      LEFT JOIN subject_staff ss ON ss.subjectId = s.id
      LEFT JOIN users u ON ss.staffId = u.id
      GROUP BY s.id
      ORDER BY s.year, s.code
    `);
    res.json({ subjects: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subjects', requireAuth, requireHOD, async (req, res) => {
  try {
    const { name, code, year, semester, credits, hoursPerWeek, staffIds } = req.body;
    if (!name || !code || !year || !semester) return res.status(400).json({ error: 'name, code, year, semester required' });
    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO subjects (id,name,code,year,semester,credits,hoursPerWeek) VALUES (?,?,?,?,?,?,?)', args: [id, name, code, year, semester, credits || 3, hoursPerWeek || 4] });
    // Assign staff via junction table
    if (staffIds && staffIds.length) {
      const batch = staffIds.map(sid => ({ sql: 'INSERT OR IGNORE INTO subject_staff (id,subjectId,staffId) VALUES (?,?,?)', args: [uuidv4(), id, sid] }));
      await db.batch(batch, 'write');
    }
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/subjects/:id', requireAuth, requireHOD, async (req, res) => {
  try {
    const { name, code, year, semester, credits, hoursPerWeek, staffIds } = req.body;
    await db.execute({ sql: 'UPDATE subjects SET name=?,code=?,year=?,semester=?,credits=?,hoursPerWeek=? WHERE id=?', args: [name, code, year, semester, credits, hoursPerWeek || 4, req.params.id] });
    // Re-sync staff assignments
    if (staffIds !== undefined) {
      await db.execute({ sql: 'DELETE FROM subject_staff WHERE subjectId=?', args: [req.params.id] });
      if (staffIds.length) {
        const batch = staffIds.map(sid => ({ sql: 'INSERT OR IGNORE INTO subject_staff (id,subjectId,staffId) VALUES (?,?,?)', args: [uuidv4(), req.params.id, sid] }));
        await db.batch(batch, 'write');
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/subjects/:id', requireAuth, requireHOD, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM subjects WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/exams/:year', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const result = await db.execute({ sql: `
      SELECT e.*, s.name as subjectName, s.code as subjectCode,
             GROUP_CONCAT(u.name, ', ') as staffName
      FROM exams e
      JOIN subjects s ON e.subjectId = s.id
      LEFT JOIN subject_staff ss ON ss.subjectId = s.id
      LEFT JOIN users u ON ss.staffId = u.id
      WHERE e.year = ?
      GROUP BY e.id
      ORDER BY e.type, s.code
    `, args: [year] });
    res.json({ exams: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/exams', requireAuth, requireHOD, async (req, res) => {
  try {
    const { title, type, subjectId, year, examDate, examTime, maxMarks } = req.body;
    if (!type || !subjectId || !year) return res.status(400).json({ error: 'type, subjectId, year required' });
    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO exams (id,title,type,subjectId,year,examDate,examTime,maxMarks) VALUES (?,?,?,?,?,?,?,?)', args: [id, title || type, type, subjectId, year, examDate || null, examTime || null, maxMarks || 50] });
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/exams/:id', requireAuth, requireHOD, async (req, res) => {
  try {
    const { title, examDate, examTime, maxMarks } = req.body;
    await db.execute({ sql: 'UPDATE exams SET title=?,examDate=?,examTime=?,maxMarks=? WHERE id=?', args: [title, examDate, examTime, maxMarks, req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/exams/:id/publish', requireAuth, requireHOD, async (req, res) => {
  try {
    const examRes = await db.execute({ sql: 'SELECT * FROM exams WHERE id=?', args: [req.params.id] });
    const exam = examRes.rows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    await db.execute({ sql: 'UPDATE exams SET isPublished=1 WHERE id=?', args: [req.params.id] });

    const notifId = uuidv4();
    await db.execute({ sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)', args: [notifId, `${exam.type} Exam Scheduled`, `${exam.title} - ${exam.examDate || 'Date TBA'}. Max Marks: ${exam.maxMarks}`, 'STUDENT', exam.year, req.user.userId, new Date().toISOString()] });

    // Notify assigned staff
    const staffRes = await db.execute({ sql: 'SELECT staffId FROM subject_staff WHERE subjectId=?', args: [exam.subjectId] });
    for (const row of staffRes.rows) {
      const notifStaffId = uuidv4();
      await db.execute({ sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)', args: [notifStaffId, `Please Enter Marks: ${exam.title}`, `${exam.type} exam published for Year ${exam.year}. Fill student marks in the Mark Entry section.`, 'STAFF', null, req.user.userId, new Date().toISOString()] });
    }

    const io = req.app.get('io');
    if (io) io.to(`year:${exam.year}`).emit('notification', { title: `${exam.type} Exam Scheduled` });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/marks/exam/:examId', requireAuth, requireStaffOrHOD, async (req, res) => {
  try {
    const examRes = await db.execute({ sql: 'SELECT e.*, s.year FROM exams e JOIN subjects s ON e.subjectId=s.id WHERE e.id=?', args: [req.params.examId] });
    const exam = examRes.rows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const studentsRes = await db.execute({ sql: 'SELECT * FROM users WHERE role=? AND year=? AND isActive=1 ORDER BY rollNo', args: ['STUDENT', exam.year] });
    const marksMap = {};
    const marksRes = await db.execute({ sql: 'SELECT * FROM marks WHERE examId=?', args: [req.params.examId] });
    marksRes.rows.forEach(m => { marksMap[m.studentId] = m; });

    const result = studentsRes.rows.map(s => ({
      studentId: s.id, name: s.name, rollNo: s.rollNo,
      marks: marksMap[s.id] ? marksMap[s.id].marks : null,
      entered: !!marksMap[s.id]
    }));
    res.json({ exam, students: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/marks', requireAuth, requireStaffOrHOD, async (req, res) => {
  try {
    const { examId, marksData } = req.body;
    if (!examId || !Array.isArray(marksData)) return res.status(400).json({ error: 'examId and marksData[] required' });

    const batch = marksData.map(({ studentId, marks }) => ({
      sql: 'INSERT INTO marks (id,examId,studentId,marks,enteredAt) VALUES (?,?,?,?,?) ON CONFLICT(examId,studentId) DO UPDATE SET marks=excluded.marks,enteredAt=excluded.enteredAt',
      args: [uuidv4(), examId, studentId, marks !== '' ? parseFloat(marks) : null, new Date().toISOString()]
    }));
    await db.batch(batch, "write");

    const examRes = await db.execute({ sql: 'SELECT e.*, s.year, s.name as subjectName FROM exams e JOIN subjects s ON e.subjectId=s.id WHERE e.id=?', args: [examId] });
    const exam = examRes.rows[0];
    if (exam) {
      await db.execute({ sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)', args: [uuidv4(), `Marks Published: ${exam.subjectName} ${exam.type}`, `Your ${exam.type} marks for ${exam.subjectName} have been published. Check your Marks section.`, 'STUDENT', exam.year, req.user.userId, new Date().toISOString()] });
      const io = req.app.get('io');
      if (io) io.to(`year:${exam.year}`).emit('notification', { title: 'Marks Published' });
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/marks/student/:studentId', requireAuth, async (req, res) => {
  try {
    const sid = req.params.studentId;
    if (req.user.role === 'STUDENT' && req.user.userId !== sid) return res.status(403).json({ error: 'Forbidden' });

    const marksRes = await db.execute({ sql: `
      SELECT m.*, e.type as examType, e.title as examTitle, e.maxMarks, e.isPublished as examPublished,
             e.examDate, s.name as subjectName, s.code as subjectCode
      FROM marks m
      JOIN exams e ON m.examId = e.id
      JOIN subjects s ON e.subjectId = s.id
      WHERE m.studentId = ?
      ORDER BY e.type, s.code
    `, args: [sid] });

    const studentRes = await db.execute({ sql: 'SELECT year FROM users WHERE id=?', args: [sid] });
    const student = studentRes.rows[0];
    let allPublishedExams = [];
    if (student) {
      const pubRes = await db.execute({ sql: `
        SELECT e.*, s.name as subjectName, s.code as subjectCode
        FROM exams e JOIN subjects s ON e.subjectId=s.id
        WHERE e.year=? AND e.isPublished=1
        ORDER BY e.type, s.code
      `, args: [student.year] });
      allPublishedExams = pubRes.rows;
    }

    res.json({ marks: marksRes.rows, allPublishedExams });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ranking/:year/:examType', requireAuth, async (req, res) => {
  try {
    const { year, examType } = req.params;
    const studentsRes = await db.execute({ sql: 'SELECT id,name,rollNo FROM users WHERE role=? AND year=? AND isActive=1', args: ['STUDENT', parseInt(year)] });
    
    const examsRes = await db.execute({ sql: 'SELECT id, maxMarks FROM exams WHERE year=? AND type=? AND isPublished=1', args: [parseInt(year), examType] });
    if (examsRes.rows.length === 0) return res.json({ ranking: [], examType });

    const totalMax = examsRes.rows.reduce((s, e) => s + e.maxMarks, 0);

    const rankingPromises = studentsRes.rows.map(async s => {
      let total = 0, filled = 0;
      for (const e of examsRes.rows) {
        const mRes = await db.execute({ sql: 'SELECT marks FROM marks WHERE examId=? AND studentId=?', args: [e.id, s.id] });
        const m = mRes.rows[0];
        if (m && m.marks !== null) { total += m.marks; filled++; }
      }
      return { ...s, totalMarks: filled > 0 ? total : null, maxMarks: totalMax, filled };
    });

    const rankingFull = await Promise.all(rankingPromises);
    const ranking = rankingFull.filter(s => s.totalMarks !== null)
      .sort((a, b) => b.totalMarks - a.totalMarks)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    res.json({ ranking, examType, totalMax });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending-exams', requireAuth, requireStaffOrHOD, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'HOD') {
      result = await db.execute(`
        SELECT e.*, s.name as subjectName, s.code as subjectCode, s.year,
               GROUP_CONCAT(u.name, ', ') as staffName,
               (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND year=s.year AND isActive=1) as totalStudents,
               (SELECT COUNT(*) FROM marks WHERE examId=e.id AND marks IS NOT NULL) as filledCount
        FROM exams e
        JOIN subjects s ON e.subjectId=s.id
        LEFT JOIN subject_staff ss ON ss.subjectId = s.id
        LEFT JOIN users u ON ss.staffId=u.id
        WHERE e.isPublished=1
        GROUP BY e.id
        ORDER BY e.createdAt DESC
      `);
    } else {
      result = await db.execute({ sql: `
        SELECT e.*, s.name as subjectName, s.code as subjectCode, s.year,
               (SELECT COUNT(*) FROM users WHERE role='STUDENT' AND year=s.year AND isActive=1) as totalStudents,
               (SELECT COUNT(*) FROM marks WHERE examId=e.id AND marks IS NOT NULL) as filledCount
        FROM exams e
        JOIN subjects s ON e.subjectId=s.id
        JOIN subject_staff ss ON ss.subjectId=s.id AND ss.staffId=?
        WHERE e.isPublished=1
        ORDER BY e.createdAt DESC
      `, args: [req.user.userId] });
    }
    res.json({ exams: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
