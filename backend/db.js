const { createClient } = require('@libsql/client');
const crypto = require('crypto');
require('dotenv').config();

// Connect to Turso Cloud Database (or local for fallback if specified)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./campusos.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

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

async function initDB() {
  console.log('Initializing ADHI-IT Database schema...');
  // Users
  await db.execute(`
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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Subjects
  await db.execute(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      year INTEGER NOT NULL,
      semester INTEGER DEFAULT 1,
      credits INTEGER DEFAULT 3,
      hoursPerWeek INTEGER DEFAULT 4,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Staff-Subject assignments
  await db.execute(`
    CREATE TABLE IF NOT EXISTS subject_staff (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      staffId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(subjectId, staffId)
    );
  `);

  // Timetable
  await db.execute(`
    CREATE TABLE IF NOT EXISTS timetable (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL UNIQUE,
      config TEXT NOT NULL DEFAULT '{}',
      publishedBy TEXT REFERENCES users(id),
      publishedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Exams
  await db.execute(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IA1','IA2','SEMESTER')),
      subjectId TEXT NOT NULL REFERENCES subjects(id),
      year INTEGER NOT NULL,
      examDate TEXT,
      maxMarks REAL DEFAULT 50,
      isPublished INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Marks
  await db.execute(`
    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY,
      examId TEXT NOT NULL REFERENCES exams(id),
      studentId TEXT NOT NULL REFERENCES users(id),
      marks REAL,
      enteredAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(examId, studentId)
    );
  `);

  // Attendance
  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL REFERENCES subjects(id),
      staffId TEXT REFERENCES users(id),
      year INTEGER NOT NULL,
      date TEXT NOT NULL,
      period INTEGER NOT NULL,
      presentIds TEXT DEFAULT '[]',
      absentIds TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(subjectId, date, period)
    );
  `);

  // Fee payments
  await db.execute(`
    CREATE TABLE IF NOT EXISTS fee_payments (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL REFERENCES users(id),
      semester INTEGER NOT NULL,
      totalFee REAL DEFAULT 0,
      paidAmount REAL DEFAULT 0,
      dueDate TEXT,
      notes TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(studentId, semester)
    );
  `);

  // Notifications
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      targetRole TEXT,
      targetYear INTEGER,
      sentByUserId TEXT REFERENCES users(id),
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notificationId TEXT NOT NULL REFERENCES notifications(id),
      userId TEXT NOT NULL REFERENCES users(id),
      readAt TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(notificationId, userId)
    );
  `);

  // Coding scores
  await db.execute(`
    CREATE TABLE IF NOT EXISTS coding_scores (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL REFERENCES users(id) UNIQUE,
      leetcode INTEGER DEFAULT 0,
      hackerrank INTEGER DEFAULT 0,
      contestRating INTEGER DEFAULT 0,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Global settings
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await seedDatabase();
}

async function seedDatabase() {
  const adminCheck = await db.execute("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
  if (adminCheck.rows.length > 0) return;

  console.log('Seeding initial ADHI-IT Admin account...');

  const adminId = uuidv4();
  await db.execute({
    sql: 'INSERT INTO users (id, name, rollNo, password, role, department) VALUES (?, ?, ?, ?, ?, ?)',
    args: [adminId, 'Super Admin', 'ADMIN001', hashPassword('2005'), 'ADMIN', 'IT']
  });

  const defaultTTConfig = {
    periods: 8,
    breakAfter: [2, 5, 6],
    periodTimes: [
      '08:00 - 08:50', '08:50 - 09:40', '09:40 - 09:50', '09:50 - 10:40',
      '10:40 - 11:30', '11:30 - 12:20', '12:20 - 01:00', '01:00 - 01:50',
      '01:50 - 02:40', '02:40 - 02:50', '02:50 - 03:40', '03:40 - 04:30'
    ]
  };
  await db.execute({
    sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
    args: ['timetable_config', JSON.stringify(defaultTTConfig)]
  });

  console.log('');
  console.log('  ╔════════════════════════════════════════════╗');
  console.log('  ║  ADHI-IT — Database Ready                  ║');
  console.log('  ║                                            ║');
  console.log('  ║  Admin  Roll: ADMIN001   Pass: 2005        ║');
  console.log('  ║                                            ║');
  console.log('  ╚════════════════════════════════════════════╝');
  console.log('');
}

module.exports = { db, initDB, uuidv4, hashPassword, verifyPassword };
