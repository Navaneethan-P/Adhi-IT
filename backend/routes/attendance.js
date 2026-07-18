const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function today() { return new Date().toISOString().split('T')[0]; }

router.get('/my-periods', requireAuth, async (req, res) => {
  try {
    const { userId, year, inchargeYear } = req.user;
    const targetYear = inchargeYear || year;
    
    const result = await db.execute({ sql: `
      SELECT a.*, s.name as subjectName, s.code as subjectCode
      FROM attendance a
      JOIN subject_staff ss ON a.subjectId = ss.subjectId AND ss.staffId = ?
      JOIN subjects s ON a.subjectId = s.id
      WHERE a.date = ?
      ORDER BY a.period
    `, args: [userId, today()] });
    
    res.json({ periods: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/students/:year', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: `
      SELECT id, name, rollNo FROM users 
      WHERE year = ? AND role = 'STUDENT' AND isActive = 1
      ORDER BY rollNo
    `, args: [parseInt(req.params.year)] });
    res.json({ students: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/subjects/:year', requireAuth, async (req, res) => {
  try {
    const { userId } = req.user;
    const result = await db.execute({ sql: `
      SELECT s.id, s.name, s.code FROM subjects s
      JOIN subject_staff ss ON s.id = ss.subjectId AND ss.staffId = ?
      WHERE s.year = ? AND s.isActive = 1
    `, args: [userId, parseInt(req.params.year)] });
    res.json({ subjects: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/session', requireAuth, async (req, res) => {
  try {
    const { subjectId, date, period } = req.query;
    if (!subjectId || !date || period === undefined) return res.status(400).json({ error: 'subjectId, date, period required' });
    
    const sessionRes = await db.execute({ sql: 'SELECT * FROM attendance WHERE subjectId=? AND date=? AND period=?', args: [subjectId, date, parseInt(period)] });
    const session = sessionRes.rows[0];
    res.json({ session: session ? { ...session, presentIds: JSON.parse(session.presentIds), absentIds: JSON.parse(session.absentIds) } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { subjectId, year, date, period, presentIds, absentIds } = req.body;
    if (!subjectId || !year || !date || period === undefined) return res.status(400).json({ error: 'subjectId, year, date, period required' });

    const recordDate = date || today();
    const isToday = recordDate === today();

    const existingRes = await db.execute({ sql: 'SELECT * FROM attendance WHERE subjectId=? AND date=? AND period=?', args: [subjectId, recordDate, parseInt(period)] });
    const existing = existingRes.rows[0];

    if (existing) {
      if (!isToday) return res.status(403).json({ error: 'Cannot modify past attendance. Contact Admin.' });
      
      const assignedRes = await db.execute({ sql: 'SELECT id FROM subject_staff WHERE subjectId=? AND staffId=?', args: [subjectId, req.user.userId] });
      const assigned = assignedRes.rows[0];
      if (!assigned && req.user.role !== 'HOD' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Not authorized to modify this attendance' });
      }

      await db.execute({ sql: 'UPDATE attendance SET presentIds=?, absentIds=?, staffId=? WHERE id=?', args: [JSON.stringify(presentIds || []), JSON.stringify(absentIds || []), req.user.userId, existing.id] });
      return res.json({ success: true, updated: true });
    }

    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO attendance (id,subjectId,staffId,year,date,period,presentIds,absentIds,createdAt) VALUES (?,?,?,?,?,?,?,?,?)', args: [id, subjectId, req.user.userId, parseInt(year), recordDate, parseInt(period), JSON.stringify(presentIds || []), JSON.stringify(absentIds || []), new Date().toISOString()] });
    res.json({ success: true, id, created: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.userId !== studentId) return res.status(403).json({ error: 'Forbidden' });

    const subjectsRes = await db.execute({ sql: `
      SELECT s.id, s.name, s.code,
        COUNT(a.id) as totalClasses,
        SUM(CASE WHEN INSTR(a.presentIds, ?) > 0 THEN 1 ELSE 0 END) as present
      FROM subjects s
      LEFT JOIN attendance a ON a.subjectId=s.id
      WHERE s.year=(SELECT year FROM users WHERE id=?) AND s.isActive=1
      GROUP BY s.id
    `, args: [`"${studentId}"`, studentId] });

    const summary = subjectsRes.rows.map(s => ({
      ...s,
      absent: s.totalClasses - s.present,
      percentage: s.totalClasses > 0 ? Math.round((s.present / s.totalClasses) * 100) : null
    }));

    res.json({ summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/class/:year', requireAuth, async (req, res) => {
  try {
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

    const result = await db.execute({ sql: query, args: params });
    const rows = result.rows.map(r => ({
      ...r,
      presentIds: JSON.parse(r.presentIds),
      absentIds: JSON.parse(r.absentIds)
    }));
    res.json({ attendance: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
