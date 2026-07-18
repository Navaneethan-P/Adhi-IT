const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'campusos-it-secret-2024';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireHOD(req, res, next) {
  if (req.user.role !== 'HOD') return res.status(403).json({ error: 'HOD access required' });
  next();
}

function requireStaffOrHOD(req, res, next) {
  if (!['STAFF', 'HOD'].includes(req.user.role)) return res.status(403).json({ error: 'Staff or HOD access required' });
  next();
}

function requireInchargeOrHOD(req, res, next) {
  if (req.user.role === 'HOD') return next();
  if (req.user.role === 'STAFF' && req.user.inchargeYear) return next();
  return res.status(403).json({ error: 'Incharge or HOD access required' });
}

module.exports = { requireAuth, requireHOD, requireStaffOrHOD, requireInchargeOrHOD, JWT_SECRET };
