const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireInchargeOrHOD } = require('../middleware/auth');
const router = express.Router();

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const sid = req.params.studentId;
    if (req.user.role === 'STUDENT' && req.user.userId !== sid) return res.status(403).json({ error: 'Forbidden' });
    const feeRes = await db.execute({ sql: 'SELECT * FROM fee_payments WHERE studentId=?', args: [sid] });
    res.json({ fee: feeRes.rows[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/year/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });

    const result = await db.execute({ sql: 'SELECT u.*, f.totalFee, f.paidAmount, f.lastPaymentDate, f.notes FROM users u LEFT JOIN fee_payments f ON u.id=f.studentId WHERE u.role=? AND u.year=? AND u.isActive=1 ORDER BY u.rollNo', args: ['STUDENT', year] });
    res.json({ students: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/student/:studentId', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const { totalFee, paidAmount, lastPaymentDate, notes } = req.body;
    const sid = req.params.studentId;

    if (req.user.role === 'STAFF') {
      const studentRes = await db.execute({ sql: 'SELECT year FROM users WHERE id=?', args: [sid] });
      const student = studentRes.rows[0];
      if (!student || student.year !== req.user.inchargeYear) return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const existingRes = await db.execute({ sql: 'SELECT id FROM fee_payments WHERE studentId=?', args: [sid] });
    if (existingRes.rows[0]) {
      await db.execute({ sql: 'UPDATE fee_payments SET totalFee=?,paidAmount=?,lastPaymentDate=?,notes=?,updatedBy=?,updatedAt=? WHERE studentId=?', args: [totalFee, paidAmount, lastPaymentDate, notes, req.user.userId, new Date().toISOString(), sid] });
    } else {
      await db.execute({ sql: 'INSERT INTO fee_payments (id,studentId,totalFee,paidAmount,lastPaymentDate,notes,updatedBy,updatedAt) VALUES (?,?,?,?,?,?,?,?)', args: [uuidv4(), sid, totalFee, paidAmount, lastPaymentDate, notes, req.user.userId, new Date().toISOString()] });
    }
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
      
      batch.push({
        sql: `INSERT INTO fee_payments (id,studentId,totalFee,paidAmount,lastPaymentDate,notes,updatedBy,updatedAt)
              VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(studentId) DO UPDATE SET
                totalFee=excluded.totalFee, paidAmount=excluded.paidAmount,
                lastPaymentDate=excluded.lastPaymentDate, notes=excluded.notes,
                updatedBy=excluded.updatedBy, updatedAt=excluded.updatedAt`,
        args: [uuidv4(), student.id, r.totalFee || 0, r.paidAmount || 0, r.lastPaymentDate || null, r.notes || null, req.user.userId, new Date().toISOString()]
      });
      updated++;
    }
    
    if (batch.length > 0) {
      await db.batch(batch, "write");
    }

    res.json({ success: true, updated, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/download-template/:year', requireAuth, requireInchargeOrHOD, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const studentsRes = await db.execute({ sql: 'SELECT u.name, u.rollNo, f.totalFee, f.paidAmount, f.lastPaymentDate, f.notes FROM users u LEFT JOIN fee_payments f ON u.id=f.studentId WHERE u.role=? AND u.year=? AND u.isActive=1 ORDER BY u.rollNo', args: ['STUDENT', year] });
    const csv = ['rollNo,name,totalFee,paidAmount,lastPaymentDate,notes', ...studentsRes.rows.map(s =>
      `${s.rollNo || ''},${s.name},${s.totalFee || 0},${s.paidAmount || 0},${s.lastPaymentDate || ''},${s.notes || ''}`
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fees-year${year}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
