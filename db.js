const { createClient } = require('@libsql/client');

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL || 'file:trading-journal.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS accounts (
      id      INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name    TEXT    NOT NULL,
      cap     REAL    NOT NULL DEFAULT 0,
      created TEXT    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS records (
      id      INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      acc_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date    TEXT    NOT NULL,
      pnl     REAL    NOT NULL,
      strat   TEXT    NOT NULL DEFAULT '',
      asset   TEXT    NOT NULL DEFAULT '',
      notes   TEXT    NOT NULL DEFAULT '',
      at      TEXT    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id      INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      acc_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date    TEXT    NOT NULL,
      amount  REAL    NOT NULL,
      type    TEXT    NOT NULL CHECK(type IN ('deposit','withdrawal')),
      notes   TEXT    NOT NULL DEFAULT '',
      at      TEXT    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS targets (
      id       INTEGER PRIMARY KEY,
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      acc_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      target   REAL    NOT NULL,
      deadline TEXT    NOT NULL DEFAULT '',
      note     TEXT    NOT NULL DEFAULT '',
      created  TEXT    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      strategies TEXT    NOT NULL DEFAULT '["Scalping","Swing","Breakout","Trend Following","Day Trading","News"]',
      assets     TEXT    NOT NULL DEFAULT '["BTC/USDT","ETH/USDT","S&P 500","Gold","EUR/USD","GBP/USD"]',
      active_acc INTEGER
    )`,
  ];

  for (const sql of tables) {
    await db.execute(sql);
  }
}

module.exports = { db, initDb };
