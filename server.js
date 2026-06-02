const express = require('express');
const path = require('path');
const { initDb } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/data'));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'trading-journal-app.html')));

const PORT = process.env.PORT || 3001;

initDb()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Trading Journal → http://localhost:${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
