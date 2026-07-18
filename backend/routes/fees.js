const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth, requireInchargeOrHOD } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/fees/student/:studentId ──────────────────────────────────────────
router.get('/student/:studentId', requireAuth, (req, res) => {
  const sid = req.params.studentId;
  if (req.user.role === 'STUDENT' && req.user.userId !== sid) return res.status(403).json({ error: 'Forbidden' });
  const fee = db.prepare('SELECT * FROM fee_payments WHERE studentId=?').get(sid);
  res.json({ fee: fee || null });
});

// ── GET /api/fees/year/:year ───────────────────────────────────────────────────
router.get('/year/:year', requireAuth, requireInchargeOrHOD, (req, res) => {
  const year = parseInt(req.params.year);
  if (req.user.role === 'STAFF' && req.user.inchargeYear !== year) return res.status(403).json({ error: 'Not authorized for this year' });

  const students = db.prepare('SELECT u.*, f.totalFee, f.paidAmount, f.lastPaymentDate, f.notes FROM users u LEFT JOIN fee_payments f ON u.id=f.studentId WHERE u.role=? AND u.year=? AND u.isActive=1 ORDER BY u.rollNo').all('STUDENT', year);
  res.json({ students });
});

// ── PUT /api/fees/student/:studentId ──────────────────────────────────────────
router.put('/student/:studentId', requireAuth, requireInchargeOrHOD, (req, res) => {
  const { totalFee, paidAmount, lastPaymentDate, notes } = req.body;
  const sid = req.params.studentId;

  // Check year permission
  if (req.user.role === 'STAFF') {
    const student = db.prepare('SELECT year FROM users WHERE id=?').get(sid);
    if (!student || student.year !== req.user.inchargeYear) return res.status(403).json({ error: 'Not authorized for this student' });
  }

  const existing = db.prepare('SELECT id FROM fee_payments WHERE studentId=?').get(sid);
  if (existing) {
    db.prepare('UPDATE fee_payments SET totalFee=?,paidAmount=?,lastPaymentDate=?,notes=?,updatedBy=?,updatedAt=? WHERE studentId=?')
      .run(totalFee, paidAmount, lastPaymentDate, notes, req.user.userId, new Date().toISOString(), sid);
  } else {
    db.prepare('INSERT INTO fee_payments (id,studentId,totalFee,paidAmount,lastPaymentDate,notes,updatedBy,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
      .run(uuidv4(), sid, totalFee, paidAmount, lastPaymentDate, notes, req.user.userId, new Date().toISOString());
  }
  res.json({ success: true });
});

// ── POST /api/fees/bulk-upload ─────────────────────────────────────────────────
// Accepts JSON array: [{rollNo, totalFee, paidAmount, lastPaymentDate, notes}]
router.post('/bulk-upload', requireAuth, requireInchargeOrHOD, (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records[] required' });

  let updated = 0, skipped = 0;
  const upsert = db.prepare(`
    INSERT INTO fee_payments (id,studentId,totalFee,paidAmount,lastPaymentDate,notes,updatedBy,updatedAt)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(studentId) DO UPDATE SET
      totalFee=excluded.totalFee, paidAmount=excluded.paidAmount,
      lastPaymentDate=excluded.lastPaymentDate, notes=excluded.notes,
      updatedBy=excluded.updatedBy, updatedAt=excluded.updatedAt
  `);

  const tx = db.transaction(() => {
    records.forEach(r => {
      const student = db.prepare('SELECT id FROM users WHERE rollNo=? AND role=?').get(r.rollNo, 'STUDENT');
      if (!student) { skipped++; return; }
      upsert.run(uuidv4(), student.id, r.totalFee || 0, r.paidAmount || 0, r.lastPaymentDate || null, r.notes || null, req.user.userId, new Date().toISOString());
      updated++;
    });
  });
  tx();

  res.json({ success: true, updated, skipped });
});

// ── GET /api/fees/download-template ───────────────────────────────────────────
router.get('/download-template/:year', requireAuth, requireInchargeOrHOD, (req, res) => {
  const year = parseInt(req.params.year);
  const students = db.prepare('SELECT u.name, u.rollNo, f.totalFee, f.paidAmount, f.lastPaymentDate, f.notes FROM users u LEFT JOIN fee_payments f ON u.id=f.studentId WHERE u.role=? AND u.year=? AND u.isActive=1 ORDER BY u.rollNo').all('STUDENT', year);

  const csv = ['rollNo,name,totalFee,paidAmount,lastPaymentDate,notes', ...students.map(s =>
    `${s.rollNo || ''},${s.name},${s.totalFee || 0},${s.paidAmount || 0},${s.lastPaymentDate || ''},${s.notes || ''}`
  )].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="fees-year${year}.csv"`);
  res.send(csv);
});

module.exports = router;
