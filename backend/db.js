const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

// In production (Fly.io), use the persistent /data volume.
// In development, keep the DB next to the source files.
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/campusos.db'
  : path.join(__dirname, 'campusos.db');
const db = new DatabaseSync(DB_PATH);

function uuidv4() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function initDB() {
  db.exec(`
    -- Users: rollNo is the login identifier
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rollNo TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('STUDENT','STAFF','HOD','ADMIN')),
      year INTEGER,
      department TEXT DEFAULT 'IT',
      inchargeYear INTEGER,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    -- Subjects
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      year INTEGER NOT NULL,
      semester INTEGER DEFAULT 1,
      credits INTEGER DEFAULT 3,
      hoursPerWeek INTEGER DEFAULT 4,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    -- Staff–Subject assignments (many-to-many: same staff can handle multiple years)
    CREATE TABLE IF NOT EXISTS subject_staff (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      staffId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(subjectId, staffId)
    );

    -- Timetable per year (JSON config includes periods + break slots)
    CREATE TABLE IF NOT EXISTS timetable (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL UNIQUE,
      config TEXT NOT NULL DEFAULT '{}',
      publishedBy TEXT REFERENCES users(id),
      publishedAt TEXT DEFAULT (datetime('now'))
    );

    -- Exams
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IA1','IA2','SEMESTER')),
      subjectId TEXT NOT NULL REFERENCES subjects(id),
      year INTEGER NOT NULL,
      examDate TEXT,
      maxMarks REAL DEFAULT 50,
      isPublished INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    -- Marks per student per exam
    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY,
      examId TEXT NOT NULL REFERENCES exams(id),
      studentId TEXT NOT NULL REFERENCES users(id),
      marks REAL,
      enteredAt TEXT DEFAULT (datetime('now')),
      UNIQUE(examId, studentId)
    );

    -- Attendance per period per subject per date
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL REFERENCES subjects(id),
      staffId TEXT REFERENCES users(id),
      year INTEGER NOT NULL,
      date TEXT NOT NULL,
      period INTEGER NOT NULL,
      presentIds TEXT DEFAULT '[]',
      absentIds TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT (datetime('now')),
      UNIQUE(subjectId, date, period)
    );

    -- Fee payments per student per semester
    CREATE TABLE IF NOT EXISTS fee_payments (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL REFERENCES users(id),
      semester INTEGER NOT NULL,
      totalFee REAL DEFAULT 0,
      paidAmount REAL DEFAULT 0,
      dueDate TEXT,
      notes TEXT,
      updatedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(studentId, semester)
    );

    -- Announcements stored as history
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      targetRole TEXT,
      targetYear INTEGER,
      sentByUserId TEXT REFERENCES users(id),
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      notificationId TEXT NOT NULL REFERENCES notifications(id),
      userId TEXT NOT NULL REFERENCES users(id),
      readAt TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(notificationId, userId)
    );

    -- Coding scores
    CREATE TABLE IF NOT EXISTS coding_scores (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL REFERENCES users(id) UNIQUE,
      leetcode INTEGER DEFAULT 0,
      hackerrank INTEGER DEFAULT 0,
      contestRating INTEGER DEFAULT 0,
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    -- Global settings (timetable_config, etc.)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedDatabase();
}

function seedDatabase() {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role='ADMIN' LIMIT 1").get();
  if (existingAdmin) return;

  console.log('Seeding clean Adhi-IT database...');

  const insertUser = db.prepare(
    `INSERT INTO users (id, name, rollNo, password, role, year, department, inchargeYear) VALUES (?,?,?,?,?,?,?,?)`
  );

  // Admin: rollNo = ADMIN001, password = 2005
  const adminId = uuidv4();
  insertUser.run(adminId, 'Super Admin', 'ADMIN001', hashPassword('2005'), 'ADMIN', null, 'IT', null);

  // Demo student: rollNo = 410123205040, password = last 4 digits = 5040
  const demoStudentId = uuidv4();
  insertUser.run(demoStudentId, 'Demo Student', '410123205040', hashPassword('5040'), 'STUDENT', 4, 'IT', null);

  // Default timetable config (8 periods, breaks defined by admin)
  const defaultTTConfig = {
    periods: 8,
    breakAfter: [2, 5, 6], // Break between period 2-3, 5-6 (lunch), 6-7
    periodTimes: [
      '08:00 - 08:50',
      '08:50 - 09:40',
      '09:40 - 09:50', // Break 1
      '09:50 - 10:40',
      '10:40 - 11:30',
      '11:30 - 12:20',
      '12:20 - 01:00', // Lunch
      '01:00 - 01:50',
      '01:50 - 02:40',
      '02:40 - 02:50', // Break 2
      '02:50 - 03:40',
      '03:40 - 04:30'
    ]
  };
  db.prepare(`INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO NOTHING`)
    .run('timetable_config', JSON.stringify(defaultTTConfig));

  // Welcome notification
  db.prepare(`INSERT INTO notifications (id,title,body,targetRole,sentByUserId,createdAt) VALUES (?,?,?,?,?,?)`)
    .run(uuidv4(), 'Welcome to Adhi-IT', 'System initialized. Contact Admin to get started.', 'STUDENT', adminId, new Date().toISOString());

  console.log('');
  console.log('  ╔════════════════════════════════════════════╗');
  console.log('  ║  Adhi-IT — Clean Database Ready           ║');
  console.log('  ║                                            ║');
  console.log('  ║  Admin  Roll: ADMIN001   Pass: 2005       ║');
  console.log('  ║  Student Roll: 410123205040  Pass: 5040   ║');
  console.log('  ║                                            ║');
  console.log('  ║  Admin Dashboard: http://localhost:3001/admin ║');
  console.log('  ╚════════════════════════════════════════════╝');
  console.log('');
}

module.exports = { db, initDB, uuidv4, hashPassword, verifyPassword };
