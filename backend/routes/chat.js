const express = require('express');
const { db, uuidv4 } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/history/:year', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (req.user.role === 'STUDENT' && req.user.year !== year) return res.status(403).json({ error: 'Forbidden' });
    
    // In a real app we'd query a messages table, but chat history is in-memory for this prototype via socket.io.
    // If you want persistence, you should create a chat_messages table and query it here.
    res.json({ messages: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
