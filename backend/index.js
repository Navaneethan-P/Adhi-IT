const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

async function startServer() {
  await initDB();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
  });

  // Make io globally available to routes
  global.io = io;
  app.set('io', io);

  // Allow requests from file:// (null origin) for the local admin dashboard
  app.use(cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));

  // ─── API Routes ────────────────────────────────────────────────────────────────
  app.use('/api/auth',          require('./routes/auth'));
  app.use('/api/admin',         require('./routes/admin'));
  app.use('/api/app',           require('./routes/app'));
  app.use('/api/attendance',    require('./routes/attendance'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/hod',           require('./routes/hod'));
  app.use('/api/academics',     require('./routes/academics'));
  app.use('/api/chat',          require('./routes/chat'));
  app.use('/api/coding',        require('./routes/coding'));
  app.use('/api/fees',          require('./routes/fees'));
  app.use('/api/timetable',     require('./routes/timetable'));

  // ─── Serve PC Admin Dashboard ─────────────────────────────────────────────────
  const adminPath = path.join(__dirname, 'public/admin');
  app.use('/admin', express.static(adminPath));

  // ─── Serve React Mobile App ───────────────────────────────────────────────────
  const distPath = path.join(__dirname, '../app/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ─── Socket.IO ────────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    socket.on('join-room', (room) => socket.join(room));
  });

  // ─── Start ────────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════════╗');
    console.log('  ║   Adhi-IT — Campus OS Backend                           ║');
    console.log(`  ║   API running at http://localhost:${PORT}                    ║`);
    console.log('  ║                                                          ║');
    console.log('  ║   Admin Dashboard: open the file below in browser       ║');
    console.log('  ║   backend/public/admin/index.html                       ║');
    console.log('  ║   Admin Roll: ADMIN001  Password: 2005                  ║');
    console.log('  ╚══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

startServer().catch(console.error);
