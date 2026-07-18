const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/notifications — User's notifications (stored history)
router.get('/', requireAuth, (req, res) => {
  const { userId, role, year, inchargeYear } = req.user;
  const userYear = year || inchargeYear;

  const notifs = db.prepare(`
    SELECT n.*, nr.readAt IS NOT NULL as isRead,
           u.name as senderName
    FROM notifications n
    LEFT JOIN notification_reads nr ON n.id=nr.notificationId AND nr.userId=?
    LEFT JOIN users u ON n.sentByUserId=u.id
    WHERE 
      (n.targetRole IS NULL OR n.targetRole=?)
      AND (n.targetYear IS NULL OR n.targetYear=?)
    ORDER BY n.createdAt DESC
    LIMIT 100
  `).all(userId, role, userYear || -1);

  res.json({ notifications: notifs });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO notification_reads (notificationId,userId,readAt) VALUES (?,?,?)')
    .run(req.params.id, req.user.userId, new Date().toISOString());
  res.json({ success: true });
});

// PUT /api/notifications/read-all
router.put('/read-all/all', requireAuth, (req, res) => {
  const { userId, role, year } = req.user;
  const notifs = db.prepare(`
    SELECT id FROM notifications
    WHERE (targetRole IS NULL OR targetRole=?) AND (targetYear IS NULL OR targetYear=?)
  `).all(role, year || -1);
  const insert = db.prepare('INSERT OR IGNORE INTO notification_reads (notificationId,userId,readAt) VALUES (?,?,?)');
  const tx = db.transaction(() => notifs.forEach(n => insert.run(n.id, userId, new Date().toISOString())));
  tx();
  res.json({ success: true });
});

// POST /api/notifications — Staff/HOD/Incharge broadcast
router.post('/', requireAuth, (req, res) => {
  const { role, inchargeYear, userId } = req.user;
  if (!['HOD', 'STAFF', 'ADMIN'].includes(role)) return res.status(403).json({ error: 'Not authorized' });

  const { title, body, targetRole, targetYear } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  // Incharge can only send to their year
  const finalYear = role === 'STAFF' && inchargeYear ? inchargeYear : (targetYear || null);
  const finalRole = targetRole || 'STUDENT';

  const id = uuidv4();
  db.prepare('INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(id, title, body, finalRole, finalYear, userId, new Date().toISOString());

  const io = global.io;
  if (io) {
    if (finalYear) io.to(`year:${finalYear}`).emit('notification', { title, body });
    else io.emit('notification', { title, body });
  }
  res.json({ success: true, id });
});

module.exports = router;
