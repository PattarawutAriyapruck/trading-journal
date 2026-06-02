const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tj-secret-change-in-production';

module.exports = function(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.userId = jwt.verify(h.slice(7), JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
