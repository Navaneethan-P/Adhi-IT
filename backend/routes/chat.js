const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/chat/:year ────────────────────────────────────────────────────────
router.get('/:year', requireAuth, (req, res) => {
  const year = req.params.year === 'all' ? null : parseInt(req.params.year);
  const msgs = year === null
    ? db.prepare('SELECT * FROM chat_messages ORDER BY createdAt DESC LIMIT 100').all()
    : db.prepare('SELECT * FROM chat_messages WHERE year=? OR year IS NULL ORDER BY createdAt DESC LIMIT 100').all(year);
  res.json({ messages: msgs.reverse() });
});

// ── POST /api/chat ─────────────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  const { content, year } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const id = uuidv4();
  const msg = { id, senderId: req.user.userId, senderName: req.user.name, senderRole: req.user.role, year: year || null, content, createdAt: new Date().toISOString() };
  db.prepare('INSERT INTO chat_messages (id,senderId,senderName,senderRole,year,content,createdAt) VALUES (?,?,?,?,?,?,?)').run(id, msg.senderId, msg.senderName, msg.senderRole, msg.year, msg.content, msg.createdAt);
  const io = req.app.get('io');
  if (io) {
    if (year) io.to(`year:${year}`).emit('chat-message', msg);
    else io.emit('chat-message', msg);
  }
  res.json({ success: true, message: msg });
});

module.exports = router;
