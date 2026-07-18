const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId, role, year, inchargeYear } = req.user;
    const userYear = year || inchargeYear;

    const result = await db.execute({ sql: `
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
    `, args: [userId, role, userYear || -1] });

    res.json({ notifications: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'INSERT OR IGNORE INTO notification_reads (notificationId,userId,readAt) VALUES (?,?,?)', args: [req.params.id, req.user.userId, new Date().toISOString()] });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/read-all/all', requireAuth, async (req, res) => {
  try {
    const { userId, role, year } = req.user;
    const notifsRes = await db.execute({ sql: `
      SELECT id FROM notifications
      WHERE (targetRole IS NULL OR targetRole=?) AND (targetYear IS NULL OR targetYear=?)
    `, args: [role, year || -1] });
    
    const batch = notifsRes.rows.map(n => ({
      sql: 'INSERT OR IGNORE INTO notification_reads (notificationId,userId,readAt) VALUES (?,?,?)',
      args: [n.id, userId, new Date().toISOString()]
    }));
    
    if (batch.length > 0) {
      await db.batch(batch, "write");
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { role, inchargeYear, userId } = req.user;
    if (!['HOD', 'STAFF', 'ADMIN'].includes(role)) return res.status(403).json({ error: 'Not authorized' });

    const { title, body, targetRole, targetYear } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    const finalYear = role === 'STAFF' && inchargeYear ? inchargeYear : (targetYear || null);
    const finalRole = targetRole || 'STUDENT';

    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO notifications (id,title,body,targetRole,targetYear,sentByUserId,createdAt) VALUES (?,?,?,?,?,?,?)', args: [id, title, body, finalRole, finalYear, userId, new Date().toISOString()] });

    const io = global.io;
    if (io) {
      if (finalYear) io.to(`year:${finalYear}`).emit('notification', { title, body });
      else io.emit('notification', { title, body });
    }
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
