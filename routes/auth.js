const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'tj-secret-change-in-production';

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0];
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const r = await db.execute({ sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)', args: [email.toLowerCase(), hash] });
    const userId = Number(r.lastInsertRowid);

    const now = new Date().toISOString().split('T')[0];
    const accId = Date.now();
    await db.execute({ sql: 'INSERT INTO accounts (id, user_id, name, cap, created) VALUES (?, ?, ?, ?, ?)', args: [accId, userId, 'Main Account', 10000, now] });
    await db.execute({ sql: 'INSERT INTO user_settings (user_id, active_acc) VALUES (?, ?)', args: [userId, accId] });

    res.json({ token: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = (await db.execute({ sql: 'SELECT id, password_hash FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0];
    if (!user || !bcrypt.compareSync(password, String(user.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: jwt.sign({ userId: Number(user.id) }, JWT_SECRET, { expiresIn: '30d' }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
