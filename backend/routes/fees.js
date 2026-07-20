const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireInchargeOrHOD } = require('../middleware/auth');
const router = express.Router();

// Schema: fee_payments(id, studentId, semester, totalFee, paidAmount, dueDate, notes, updatedAt)

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const sid = req.params.studentId;
    if (req.user.role === 'STUDENT' && req.user.userId !== sid) return res.status(403).json({ error: 'Forbidden' });
    const feeRes = await db.execute({ sql: 'SELECT * FROM fee_payments WHERE studentId=? ORDER BY semester', args: [sid] });
    res.json({ fees: feeRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/year/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });
    const result = await db.execute({
      sql: `SELECT u.id, u.name, u.rollNo, u.year,
               COALESCE(SUM(f.totalFee), 0) as totalFee,
               COALESCE(SUM(f.paidAmount), 0) as paidAmount,
               COALESCE(SUM(f.totalFee) - SUM(f.paidAmount), 0) as pendingAmount
             FROM users u
             LEFT JOIN fee_payments f ON u.id=f.studentId
             WHERE u.role='STUDENT' AND u.year=? AND u.isActive=1
             GROUP BY u.id ORDER BY u.rollNo`,
      args: [year]
    });
    res.json({ students: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/student/:studentId', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const { totalFee, paidAmount, semester, dueDate, notes } = req.body;
    const sid = req.params.studentId;
    const sem = parseInt(semester) || 1;

    if (req.user.role === 'STAFF') {
      const studentRes = await db.execute({ sql: 'SELECT year FROM users WHERE id=?', args: [sid] });
      const student = studentRes.rows[0];
      if (!student || student.year !== req.user.inchargeYear) return res.status(403).json({ error: 'Not authorized for this student' });
    }

    await db.execute({
      sql: `INSERT INTO fee_payments (id,studentId,semester,totalFee,paidAmount,dueDate,notes,updatedAt)
            VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(studentId,semester) DO UPDATE SET
              totalFee=excluded.totalFee, paidAmount=excluded.paidAmount,
              dueDate=excluded.dueDate, notes=excluded.notes, updatedAt=excluded.updatedAt`,
      args: [uuidv4(), sid, sem, totalFee || 0, paidAmount || 0, dueDate || null, notes || null, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bulk-upload', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records[] required' });
    let updated = 0, skipped = 0;
    const batch = [];
    for (const r of records) {
      const studentRes = await db.execute({ sql: 'SELECT id FROM users WHERE rollNo=? AND role=?', args: [r.rollNo, 'STUDENT'] });
      const student = studentRes.rows[0];
      if (!student) { skipped++; continue; }
      const sem = parseInt(r.semester) || 1;
      batch.push({
        sql: `INSERT INTO fee_payments (id,studentId,semester,totalFee,paidAmount,dueDate,notes,updatedAt)
              VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(studentId,semester) DO UPDATE SET
                totalFee=excluded.totalFee, paidAmount=excluded.paidAmount,
                dueDate=excluded.dueDate, notes=excluded.notes, updatedAt=excluded.updatedAt`,
        args: [uuidv4(), student.id, sem, r.totalFee || 0, r.paidAmount || 0, r.dueDate || null, r.notes || null, new Date().toISOString()]
      });
      updated++;
    }
    if (batch.length > 0) await db.batch(batch, "write");
    res.json({ success: true, updated, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/download-template/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const studentsRes = await db.execute({
      sql: `SELECT u.name, u.rollNo, f.semester, f.totalFee, f.paidAmount, f.dueDate, f.notes
            FROM users u LEFT JOIN fee_payments f ON u.id=f.studentId
            WHERE u.role='STUDENT' AND u.year=? AND u.isActive=1 ORDER BY u.rollNo, f.semester`,
      args: [year]
    });
    const csv = ['rollNo,name,semester,totalFee,paidAmount,dueDate,notes', ...studentsRes.rows.map(s =>
      `${s.rollNo || ''},${s.name},${s.semester || 1},${s.totalFee || 0},${s.paidAmount || 0},${s.dueDate || ''},${s.notes || ''}`
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fees-year${year}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
