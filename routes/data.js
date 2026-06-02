const router = require('express').Router();
const { db } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const q = (sql, args = []) => db.execute({ sql, args });

// ── Load all ──────────────────────────────────────────────────────────────
router.get('/load', async (req, res) => {
  try {
    const uid = req.userId;
    const [accs, recs, txns, tgts, cfg] = await Promise.all([
      q('SELECT id, name, cap, created FROM accounts WHERE user_id = ? ORDER BY created', [uid]),
      q('SELECT id, acc_id as accId, date, pnl, strat, asset, notes, at FROM records WHERE user_id = ? ORDER BY date', [uid]),
      q('SELECT id, acc_id as accId, date, amount, type, notes, at FROM transactions WHERE user_id = ? ORDER BY date', [uid]),
      q('SELECT id, acc_id as accId, target, deadline, note, created FROM targets WHERE user_id = ?', [uid]),
      q('SELECT strategies, assets, active_acc FROM user_settings WHERE user_id = ?', [uid]),
    ]);
    const s = cfg.rows[0] || {};
    res.json({
      accounts:     accs.rows.map(r => ({ id: Number(r.id), name: String(r.name), cap: +r.cap, created: String(r.created) })),
      records:      recs.rows.map(r => ({ id: Number(r.id), accId: Number(r.accId), date: String(r.date), pnl: +r.pnl, strat: String(r.strat||''), asset: String(r.asset||''), notes: String(r.notes||''), at: String(r.at) })),
      transactions: txns.rows.map(t => ({ id: Number(t.id), accId: Number(t.accId), date: String(t.date), amount: +t.amount, type: String(t.type), notes: String(t.notes||''), at: String(t.at) })),
      targets:      tgts.rows.map(t => ({ id: Number(t.id), accId: Number(t.accId), target: +t.target, deadline: String(t.deadline||''), note: String(t.note||''), created: String(t.created) })),
      strategies:   JSON.parse(String(s.strategies || 'null')) || ['Scalping','Swing','Breakout','Trend Following','Day Trading','News'],
      assets:       JSON.parse(String(s.assets || 'null')) || ['BTC/USDT','ETH/USDT','S&P 500','Gold','EUR/USD','GBP/USD'],
      activeAcc:    s.active_acc ? Number(s.active_acc) : (accs.rows[0] ? Number(accs.rows[0].id) : null),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Accounts ──────────────────────────────────────────────────────────────
router.post('/accounts', async (req, res) => {
  try {
    const { name, cap, created } = req.body;
    const id = Date.now();
    await q('INSERT INTO accounts (id, user_id, name, cap, created) VALUES (?, ?, ?, ?, ?)', [id, req.userId, name.trim(), +cap, created]);
    res.json({ id, name: name.trim(), cap: +cap, created });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/accounts/:id', async (req, res) => {
  try {
    const { name, cap } = req.body;
    const r = await q('UPDATE accounts SET name=?, cap=? WHERE id=? AND user_id=?', [name.trim(), +cap, +req.params.id, req.userId]);
    r.rowsAffected ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const count = Number((await q('SELECT COUNT(*) as c FROM accounts WHERE user_id=?', [req.userId])).rows[0].c);
    if (count <= 1) return res.status(400).json({ error: 'Cannot delete the last account' });
    await q('DELETE FROM accounts WHERE id=? AND user_id=?', [+req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Records ───────────────────────────────────────────────────────────────
router.post('/records', async (req, res) => {
  try {
    const { date, pnl, strat, asset, notes, accId } = req.body;
    const id = Date.now(); const at = new Date().toISOString();
    await q('INSERT INTO records (id,user_id,acc_id,date,pnl,strat,asset,notes,at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, req.userId, accId, date, +pnl, strat||'', asset||'', notes||'', at]);
    res.json({ id, accId, date, pnl: +pnl, strat: strat||'', asset: asset||'', notes: notes||'', at });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/records/:id', async (req, res) => {
  try {
    const { date, pnl, strat, asset, notes } = req.body;
    const r = await q('UPDATE records SET date=?,pnl=?,strat=?,asset=?,notes=? WHERE id=? AND user_id=?',
      [date, +pnl, strat||'', asset||'', notes||'', +req.params.id, req.userId]);
    r.rowsAffected ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/records/:id', async (req, res) => {
  try {
    await q('DELETE FROM records WHERE id=? AND user_id=?', [+req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/records', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    const ph = ids.map(() => '?').join(',');
    await q(`DELETE FROM records WHERE id IN (${ph}) AND user_id=?`, [...ids.map(Number), req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Transactions ──────────────────────────────────────────────────────────
router.post('/transactions', async (req, res) => {
  try {
    const { date, amount, type, notes, accId } = req.body;
    const id = Date.now(); const at = new Date().toISOString();
    await q('INSERT INTO transactions (id,user_id,acc_id,date,amount,type,notes,at) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.userId, accId, date, +amount, type, notes||'', at]);
    res.json({ id, accId, date, amount: +amount, type, notes: notes||'', at });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    await q('DELETE FROM transactions WHERE id=? AND user_id=?', [+req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Targets ───────────────────────────────────────────────────────────────
router.post('/targets', async (req, res) => {
  try {
    const { target, deadline, note, accId, created } = req.body;
    const id = Date.now();
    await q('INSERT INTO targets (id,user_id,acc_id,target,deadline,note,created) VALUES (?,?,?,?,?,?,?)',
      [id, req.userId, accId, +target, deadline||'', note||'', created]);
    res.json({ id, accId, target: +target, deadline: deadline||'', note: note||'', created });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/targets/:id', async (req, res) => {
  try {
    const { target, deadline, note } = req.body;
    const r = await q('UPDATE targets SET target=?,deadline=?,note=? WHERE id=? AND user_id=?',
      [+target, deadline||'', note||'', +req.params.id, req.userId]);
    r.rowsAffected ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/targets/:id', async (req, res) => {
  try {
    await q('DELETE FROM targets WHERE id=? AND user_id=?', [+req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Settings ──────────────────────────────────────────────────────────────
router.put('/settings', async (req, res) => {
  try {
    const { strategies, assets, activeAcc } = req.body;
    await q('INSERT OR REPLACE INTO user_settings (user_id,strategies,assets,active_acc) VALUES (?,?,?,?)',
      [req.userId, JSON.stringify(strategies), JSON.stringify(assets), activeAcc||null]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Reset ─────────────────────────────────────────────────────────────────
router.delete('/reset', async (req, res) => {
  try {
    const uid = req.userId;
    await db.batch([
      { sql: 'DELETE FROM records WHERE user_id=?',      args: [uid] },
      { sql: 'DELETE FROM transactions WHERE user_id=?', args: [uid] },
      { sql: 'DELETE FROM targets WHERE user_id=?',      args: [uid] },
      { sql: 'DELETE FROM accounts WHERE user_id=?',     args: [uid] },
    ], 'write');
    const now = new Date().toISOString().split('T')[0];
    const accId = Date.now();
    await db.batch([
      { sql: 'INSERT INTO accounts (id,user_id,name,cap,created) VALUES (?,?,?,?,?)', args: [accId, uid, 'Main Account', 10000, now] },
      { sql: 'UPDATE user_settings SET active_acc=?, strategies=?, assets=? WHERE user_id=?',
        args: [accId, '["Scalping","Swing","Breakout","Trend Following","Day Trading","News"]', '["BTC/USDT","ETH/USDT","S&P 500","Gold","EUR/USD","GBP/USD"]', uid] },
    ], 'write');
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
