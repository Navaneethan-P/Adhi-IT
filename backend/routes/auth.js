const express = require('express');
const jwt = require('jsonwebtoken');
const { db, verifyPassword } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/login — Roll Number + Password
router.post('/login', (req, res) => {
  const { rollNo, password } = req.body;
  if (!rollNo || !password) return res.status(400).json({ error: 'Roll number and password required' });

  const user = db.prepare('SELECT * FROM users WHERE rollNo = ? AND isActive = 1 LIMIT 1').get(rollNo.trim());
  if (!user) return res.status(404).json({ error: 'Roll number not found. Contact your Admin.' });

  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Incorrect password. Default is last 4 digits of your roll number.' });
  }

  const payload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    rollNo: user.rollNo,
    year: user.year,
    inchargeYear: user.inchargeYear,
    department: user.department
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, user: { ...payload, id: user.id } });
});

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });

  let decoded;
  try { decoded = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  const { hashPassword, verifyPassword: vp } = require('../db');
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND isActive = 1').get(decoded.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!vp(currentPassword, user.password)) return res.status(401).json({ error: 'Current password is incorrect' });

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  res.json({ success: true, message: 'Password changed successfully' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    const user = db.prepare('SELECT id, name, rollNo, role, year, department, inchargeYear, isActive FROM users WHERE id = ? AND isActive = 1').get(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
