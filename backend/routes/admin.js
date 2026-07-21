const express = require('express');
const { db, uuidv4, hashPassword } = require('../db');
const router = express.Router();

// All admin routes are accessible from the local PC admin panel (no JWT needed for LAN access)
// For security in production, add API key middleware here

router.get('/users', async (req, res) => {
  try {
    const { role, year } = req.query;
    let query = 'SELECT id, name, rollNo, role, year, department, inchargeYear, isActive FROM users';
    const params = [];
    const conditions = [];
    if (role) { conditions.push('role = ?'); params.push(role); }
    if (year === 'PASTOUT') {
      conditions.push('year = 5');
    } else if (year) {
      conditions.push('year = ?'); params.push(parseInt(year));
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY role, year, name';
    
    const result = await db.execute({ sql: query, args: params });
    res.json({ users: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users/bulk', async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'Array of users required' });

    let added = 0;
    let skipped = 0;

    for (const u of users) {
      if (!u.name || !u.rollNo || !u.role) {
        skipped++;
        continue;
      }
      try {
        const defaultPassword = u.rollNo.toString().slice(-4);
        const id = uuidv4();
        await db.execute({
          sql: `INSERT INTO users (id, name, rollNo, password, role, year, department, inchargeYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, u.name, u.rollNo, hashPassword(defaultPassword), u.role, u.year || null, u.department || 'IT', u.inchargeYear || null]
        });
        added++;
      } catch (e) {
        skipped++;
      }
    }
    res.json({ success: true, added, skipped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, rollNo, role, year, department, inchargeYear } = req.body;
    if (!name || !rollNo || !role) return res.status(400).json({ error: 'name, rollNo, role required' });

    const defaultPassword = rollNo.toString().slice(-4);
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO users (id, name, rollNo, password, role, year, department, inchargeYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name, rollNo, hashPassword(defaultPassword), role, year || null, department || 'IT', inchargeYear || null]
    });
    res.json({ success: true, id, defaultPassword });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Roll number already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, rollNo, role, year, department, inchargeYear, isActive, resetPassword } = req.body;
    const userRes = await db.execute({ sql: 'SELECT id, rollNo FROM users WHERE id = ?', args: [req.params.id] });
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await db.execute({
      sql: `UPDATE users SET name=?, rollNo=?, role=?, year=?, department=?, inchargeYear=?, isActive=? WHERE id=?`,
      args: [name, rollNo, role, year || null, department || 'IT', inchargeYear || null, isActive ? 1 : 0, req.params.id]
    });

    let newDefaultPass = null;
    if (resetPassword) {
      newDefaultPass = rollNo.toString().slice(-4);
      await db.execute({ sql: 'UPDATE users SET password=? WHERE id=?', args: [hashPassword(newDefaultPass), req.params.id] });
    }

    res.json({ success: true, defaultPassword: newDefaultPass });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'UPDATE users SET isActive=0 WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/subjects', async (req, res) => {
  try {
    const { year } = req.query;
    let result;
    if (year) {
      result = await db.execute({
        sql: 'SELECT s.*, GROUP_CONCAT(u.name, \', \') as staffNames FROM subjects s LEFT JOIN subject_staff ss ON s.id=ss.subjectId LEFT JOIN users u ON ss.staffId=u.id WHERE s.year=? AND s.isActive=1 GROUP BY s.id ORDER BY s.year, s.name',
        args: [parseInt(year)]
      });
    } else {
      result = await db.execute('SELECT s.*, GROUP_CONCAT(u.name, \', \') as staffNames FROM subjects s LEFT JOIN subject_staff ss ON s.id=ss.subjectId LEFT JOIN users u ON ss.staffId=u.id WHERE s.isActive=1 GROUP BY s.id ORDER BY s.year, s.name');
    }
    res.json({ subjects: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subjects', async (req, res) => {
  try {
    const { name, code, year, semester, credits, hoursPerWeek, staffIds } = req.body;
    if (!name || !code || !year) return res.status(400).json({ error: 'name, code, year required' });

    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO subjects (id,name,code,year,semester,credits,hoursPerWeek) VALUES (?,?,?,?,?,?,?)',
      args: [id, name, code, year, semester || 1, credits || 3, hoursPerWeek || 4]
    });

    if (staffIds && staffIds.length) {
      for (const sId of staffIds) {
        await db.execute({ sql: 'INSERT OR IGNORE INTO subject_staff (id,subjectId,staffId) VALUES (?,?,?)', args: [uuidv4(), id, sId] });
      }
    }
    res.json({ success: true, id });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Subject code already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/subjects/:id', async (req, res) => {
  try {
    const { name, code, year, semester, credits, hoursPerWeek, staffIds } = req.body;
    await db.execute({
      sql: 'UPDATE subjects SET name=?,code=?,year=?,semester=?,credits=?,hoursPerWeek=? WHERE id=?',
      args: [name, code, year, semester, credits, hoursPerWeek, req.params.id]
    });

    if (staffIds !== undefined) {
      await db.execute({ sql: 'DELETE FROM subject_staff WHERE subjectId=?', args: [req.params.id] });
      for (const sId of staffIds) {
        await db.execute({ sql: 'INSERT OR IGNORE INTO subject_staff (id,subjectId,staffId) VALUES (?,?,?)', args: [uuidv4(), req.params.id, sId] });
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/subjects/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'UPDATE subjects SET isActive=0 WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/timetable/:year', async (req, res) => {
  try {
    const ttRes = await db.execute({ sql: 'SELECT * FROM timetable WHERE year=?', args: [parseInt(req.params.year)] });
    if (ttRes.rows.length === 0) return res.json({ timetable: null });
    const tt = ttRes.rows[0];
    res.json({ timetable: { ...tt, config: JSON.parse(tt.config) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/timetable/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const { config, publishedBy } = req.body;
    if (!config) return res.status(400).json({ error: 'config required' });

    await db.execute({
      sql: `INSERT INTO timetable (id,year,config,publishedBy,publishedAt) VALUES (?,?,?,?,?) ON CONFLICT(year) DO UPDATE SET config=excluded.config, publishedBy=excluded.publishedBy, publishedAt=excluded.publishedAt`,
      args: [uuidv4(), year, JSON.stringify(config), publishedBy || null, new Date().toISOString()]
    });

    const notifId = uuidv4();
    await db.execute({
      sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)',
      args: [notifId, 'Timetable Updated', `Year ${year} timetable has been published by Admin.`, 'STUDENT', year, publishedBy || null, new Date().toISOString()]
    });

    const io = global.io;
    if (io) io.to(`year:${year}`).emit('notification', { title: 'Timetable Updated' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/exams', async (req, res) => {
  try {
    const { year } = req.query;
    let result;
    if (year) {
      result = await db.execute({ sql: 'SELECT e.*, s.name as subjectName, s.code as subjectCode FROM exams e JOIN subjects s ON e.subjectId=s.id WHERE e.year=? ORDER BY e.examDate', args: [parseInt(year)] });
    } else {
      result = await db.execute('SELECT e.*, s.name as subjectName, s.code as subjectCode FROM exams e JOIN subjects s ON e.subjectId=s.id ORDER BY e.year, e.examDate');
    }
    res.json({ exams: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/exams', async (req, res) => {
  try {
    const { title, type, subjectId, year, examDate, maxMarks } = req.body;
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO exams (id,title,type,subjectId,year,examDate,maxMarks) VALUES (?,?,?,?,?,?,?)',
      args: [id, title, type, subjectId, year, examDate || null, maxMarks || 50]
    });
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/exams/:id', async (req, res) => {
  try {
    const { title, type, examDate, maxMarks, isPublished } = req.body;
    await db.execute({
      sql: 'UPDATE exams SET title=?,type=?,examDate=?,maxMarks=?,isPublished=? WHERE id=?',
      args: [title, type, examDate, maxMarks, isPublished ? 1 : 0, req.params.id]
    });

    if (isPublished) {
      const examRes = await db.execute({ sql: 'SELECT * FROM exams WHERE id=?', args: [req.params.id] });
      const exam = examRes.rows[0];
      if (exam) {
        await db.execute({
          sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)',
          args: [uuidv4(), `Exam Published: ${title}`, `${type} exam scheduled.`, 'STUDENT', exam.year, null, new Date().toISOString()]
        });
        if (global.io) global.io.to(`year:${exam.year}`).emit('notification', { title: `Exam: ${title}` });
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/exams/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM exams WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/marks/:examId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT m.studentId, m.marks, m.enteredAt, u.name, u.rollNo FROM marks m JOIN users u ON m.studentId=u.id WHERE m.examId=? ORDER BY u.rollNo`,
      args: [req.params.examId]
    });
    res.json({ marks: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/marks/:examId', async (req, res) => {
  try {
    const { entries } = req.body;
    const batch = entries.map(e => ({
      sql: `INSERT INTO marks (id, examId, studentId, marks, enteredAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(examId, studentId) DO UPDATE SET marks=excluded.marks, enteredAt=excluded.enteredAt`,
      args: [uuidv4(), req.params.examId, e.studentId, e.marks, new Date().toISOString()]
    }));
    await db.batch(batch, "write");
    res.json({ success: true, count: entries.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/attendance', async (req, res) => {
  try {
    const { year, date, subjectId } = req.query;
    let query = `SELECT a.*, s.name as subjectName, u.name as staffName FROM attendance a JOIN subjects s ON a.subjectId=s.id LEFT JOIN users u ON a.staffId=u.id WHERE 1=1`;
    const params = [];
    if (year) {
      const yearNum = year === 'PASTOUT' ? 5 : parseInt(year);
      if (!isNaN(yearNum)) { query += ' AND a.year=?'; params.push(yearNum); }
    }
    if (date) { query += ' AND a.date=?'; params.push(date); }
    if (subjectId) { query += ' AND a.subjectId=?'; params.push(subjectId); }
    query += ' ORDER BY a.date DESC, a.period';
    
    const result = await db.execute({ sql: query, args: params });
    res.json({ attendance: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/attendance/:id', async (req, res) => {
  try {
    const { presentIds, absentIds } = req.body;
    await db.execute({
      sql: 'UPDATE attendance SET presentIds=?, absentIds=? WHERE id=?',
      args: [JSON.stringify(presentIds || []), JSON.stringify(absentIds || []), req.params.id]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/attendance/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM attendance WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/fees', async (req, res) => {
  try {
    const { year } = req.query;
    let result;
    if (year) {
      result = await db.execute({ sql: 'SELECT f.*, u.name, u.rollNo FROM fee_payments f JOIN users u ON f.studentId=u.id WHERE u.year=? ORDER BY u.rollNo', args: [parseInt(year)] });
    } else {
      result = await db.execute('SELECT f.*, u.name, u.rollNo, u.year FROM fee_payments f JOIN users u ON f.studentId=u.id ORDER BY u.year, u.rollNo');
    }
    res.json({ fees: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fees', async (req, res) => {
  try {
    const { studentId, semester, totalFee, paidAmount, dueDate, notes } = req.body;
    await db.execute({
      sql: `INSERT INTO fee_payments (id,studentId,semester,totalFee,paidAmount,dueDate,notes,updatedAt) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(studentId,semester) DO UPDATE SET totalFee=excluded.totalFee, paidAmount=excluded.paidAmount, dueDate=excluded.dueDate, notes=excluded.notes, updatedAt=excluded.updatedAt`,
      args: [uuidv4(), studentId, semester, totalFee || 0, paidAmount || 0, dueDate || null, notes || null, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fees/bulk', async (req, res) => {
  try {
    const { entries } = req.body;
    const batch = entries.map(e => ({
      sql: `INSERT INTO fee_payments (id,studentId,semester,totalFee,paidAmount,updatedAt) VALUES (?,?,?,?,?,?) ON CONFLICT(studentId,semester) DO UPDATE SET totalFee=excluded.totalFee, paidAmount=excluded.paidAmount, updatedAt=excluded.updatedAt`,
      args: [uuidv4(), e.studentId, e.semester, e.totalFee||0, e.paidAmount||0, new Date().toISOString()]
    }));
    await db.batch(batch, "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/coding', async (req, res) => {
  try {
    const { year } = req.query;
    let result;
    if (year) {
      result = await db.execute({ sql: 'SELECT c.*, u.name, u.rollNo FROM coding_scores c JOIN users u ON c.studentId=u.id WHERE u.year=? ORDER BY u.rollNo', args: [parseInt(year)] });
    } else {
      result = await db.execute('SELECT c.*, u.name, u.rollNo, u.year FROM coding_scores c JOIN users u ON c.studentId=u.id ORDER BY u.year, u.rollNo');
    }
    res.json({ scores: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/coding', async (req, res) => {
  try {
    const { studentId, leetcode, hackerrank, contestRating } = req.body;
    await db.execute({
      sql: `INSERT INTO coding_scores (id,studentId,leetcode,hackerrank,contestRating,updatedAt) VALUES (?,?,?,?,?,?) ON CONFLICT(studentId) DO UPDATE SET leetcode=excluded.leetcode, hackerrank=excluded.hackerrank, contestRating=excluded.contestRating, updatedAt=excluded.updatedAt`,
      args: [uuidv4(), studentId, leetcode||0, hackerrank||0, contestRating||0, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/announcements', async (req, res) => {
  try {
    const result = await db.execute('SELECT n.*, u.name as senderName FROM notifications n LEFT JOIN users u ON n.sentByUserId=u.id ORDER BY n.createdAt DESC LIMIT 100');
    res.json({ announcements: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/announcements', async (req, res) => {
  try {
    const { title, body, targetRole, targetYear, sentByUserId } = req.body;
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)',
      args: [id, title, body, targetRole || null, targetYear || null, sentByUserId || null, new Date().toISOString()]
    });

    if (global.io) {
      if (targetYear) global.io.to(`year:${targetYear}`).emit('notification', { title, body });
      else global.io.emit('notification', { title, body });
    }
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


router.get('/settings', async (req, res) => {
  try {
    const result = await db.execute('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = JSON.parse(r.value); });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    await db.execute({
      sql: 'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      args: [key, JSON.stringify(value)]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Promote all students: year 1->2, 2->3, 3->4, 4->5 (PASTOUT)
router.post('/promote-students', async (req, res) => {
  try {
    await db.execute({ sql: "UPDATE users SET year=5 WHERE role='STUDENT' AND year=4", args: [] });
    await db.execute({ sql: "UPDATE users SET year=4 WHERE role='STUDENT' AND year=3", args: [] });
    await db.execute({ sql: "UPDATE users SET year=3 WHERE role='STUDENT' AND year=2", args: [] });
    await db.execute({ sql: "UPDATE users SET year=2 WHERE role='STUDENT' AND year=1", args: [] });
    const r = await db.execute({ sql: "SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND isActive=1", args: [] });
    res.json({ success: true, promoted: r.rows[0].c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Defaulters: attendance < 75% OR pending fees
router.get('/defaulters', async (req, res) => {
  try {
    const { year } = req.query;
    let yearCond = year && year !== '' ? `AND s.year = ${parseInt(year)}` : '';
    // Students with any subject attendance < 75%
    const attResult = await db.execute({ sql: `
      SELECT u.id, u.name, u.rollNo, u.year,
        COUNT(a.id) as totalClasses,
        SUM(CASE WHEN INSTR(a.presentIds, '"'||u.id||'"') > 0 THEN 1 ELSE 0 END) as present
      FROM users u
      JOIN subjects s ON s.year = u.year AND s.isActive = 1
      LEFT JOIN attendance a ON a.subjectId = s.id
      WHERE u.role = 'STUDENT' AND u.isActive = 1 ${yearCond.replace('s.year', 'u.year').replace('AND s.year', 'AND u.year')}
      GROUP BY u.id, s.id
      HAVING totalClasses > 0 AND (CAST(present AS REAL) / totalClasses) < 0.75
    `, args: [] });
    const attStudentIds = [...new Set(attResult.rows.map(r => r.id))];

    // Students with pending fees
    const feeResult = await db.execute({ sql: `
      SELECT DISTINCT u.id, u.name, u.rollNo, u.year
      FROM users u
      JOIN fee_payments f ON f.studentId = u.id
      WHERE u.role = 'STUDENT' AND u.isActive = 1 AND f.totalFee > f.paidAmount
    `, args: [] });
    const feeStudentIds = feeResult.rows.map(r => r.id);

    const allIds = [...new Set([...attStudentIds, ...feeStudentIds])];
    if (!allIds.length) return res.json({ defaulters: [] });

    const placeholders = allIds.map(() => '?').join(',');
    const usersRes = await db.execute({ sql: `SELECT id, name, rollNo, year FROM users WHERE id IN (${placeholders})`, args: allIds });

    const defaulters = usersRes.rows.map(u => ({
      ...u,
      hasAttendanceIssue: attStudentIds.includes(u.id),
      hasFeeIssue: feeStudentIds.includes(u.id)
    }));
    res.json({ defaulters });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const r1 = await db.execute("SELECT COUNT(*) as c FROM users WHERE role='STUDENT' AND isActive=1");
    const r2 = await db.execute("SELECT COUNT(*) as c FROM users WHERE role IN ('STAFF','HOD') AND isActive=1");
    const r3 = await db.execute("SELECT COUNT(*) as c FROM subjects WHERE isActive=1");
    const r4 = await db.execute("SELECT COUNT(*) as c FROM exams");
    const r5 = await db.execute("SELECT COUNT(*) as c FROM fee_payments WHERE totalFee > paidAmount");
    const r6 = await db.execute("SELECT DISTINCT year FROM users WHERE role='STUDENT' AND isActive=1 ORDER BY year");

    res.json({
      totalStudents: r1.rows[0].c,
      totalStaff: r2.rows[0].c,
      totalSubjects: r3.rows[0].c,
      totalExams: r4.rows[0].c,
      pendingFees: r5.rows[0].c,
      years: r6.rows.map(r => r.year)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DB mode indicator
router.get('/db-mode', (req, res) => {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl && !tursoUrl.startsWith('file:')) {
    res.json({ mode: 'turso', url: tursoUrl });
  } else {
    res.json({ mode: 'local', url: 'file:./campusos.db' });
  }
});

// Deploy trigger — git push + optional Render deploy hook
router.post('/deploy', (req, res) => {
  const { exec } = require('child_process');
  const https = require('https');
  const { message = `Admin publish ${new Date().toISOString().slice(0, 16)}`, renderHookUrl } = req.body;
  const cwd = require('path').join(__dirname, '../../');

  exec(`git add . && git commit -m "${message}" && git push`, { cwd, timeout: 60000 }, (err, stdout, stderr) => {
    const nothingNew = (stderr && stderr.includes('nothing to commit')) || (stdout && stdout.includes('nothing to commit'));
    if (err && !nothingNew) {
      return res.status(500).json({ error: err.message, detail: stderr || stdout });
    }
    const gitMsg = nothingNew
      ? 'No code changes to commit. Already up to date on GitHub.'
      : 'Code pushed to GitHub successfully.';

    if (!renderHookUrl) {
      return res.json({ success: true, gitMsg, renderMsg: 'No Render hook configured. Set it in Settings.' });
    }

    // Call Render deploy hook
    try {
      const hookUrl = new URL(renderHookUrl);
      const opts = { hostname: hookUrl.hostname, path: hookUrl.pathname + hookUrl.search, method: 'POST' };
      const req2 = https.request(opts, (resp) => {
        res.json({ success: true, gitMsg, renderMsg: `Render deploy triggered (HTTP ${resp.statusCode}). Live in ~2-3 min.` });
      });
      req2.on('error', (e) => {
        res.json({ success: true, gitMsg, renderMsg: `Render hook error: ${e.message}` });
      });
      req2.end();
    } catch (e) {
      res.json({ success: true, gitMsg, renderMsg: `Invalid Render hook URL: ${e.message}` });
    }
  });
});

module.exports = router;

