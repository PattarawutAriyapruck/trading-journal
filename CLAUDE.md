# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

### Local Development
```bash
npm install
node server.js   # runs on http://localhost:3001
```

### Production
Deployed on **Railway** — auto-deploys on every `git push` to `main`.

## Architecture

**Frontend:** Single file [`trading-journal-app.html`](trading-journal-app.html) — Vanilla HTML/CSS/JavaScript, no framework.

**Backend:** Node.js + Express REST API with Turso (SQLite) database.

```
Trading-Journal-App/
├── trading-journal-app.html   ← entire frontend (UI + logic)
├── server.js                  ← Express entry point, serves static + API
├── db.js                      ← Turso/libsql client + schema init
├── middleware/
│   └── auth.js                ← JWT verification middleware
├── routes/
│   ├── auth.js                ← POST /api/auth/register, /api/auth/login
│   └── data.js                ← all CRUD endpoints
├── package.json
├── favicon.svg
└── manifest.json
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `JWT_SECRET` | Secret for signing JWT tokens (30-day expiry) |

## REST API

All `/api/*` routes (except auth) require `Authorization: Bearer <token>` header.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account → returns JWT |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/load` | Load all user data in one call |
| POST/PUT/DELETE | `/api/accounts/:id` | Account CRUD |
| POST/PUT | `/api/records`, DELETE `/api/records/:id` | Record CRUD |
| DELETE | `/api/records` (body: `{ids:[]}`) | Bulk delete records |
| POST/DELETE | `/api/transactions/:id` | Transaction CRUD |
| POST/PUT/DELETE | `/api/targets/:id` | Profit target CRUD |
| PUT | `/api/settings` | Save strategies, assets, active account |
| DELETE | `/api/reset` | Wipe all user data, recreate Main Account |

## Database Schema (Turso/SQLite)

```sql
users         (id, email UNIQUE, password_hash, created_at)
accounts      (id, user_id → users, name, cap, created)
records       (id, user_id → users, acc_id → accounts, date, pnl, strat, asset, notes, at)
transactions  (id, user_id → users, acc_id → accounts, date, amount, type, notes, at)
targets       (id, user_id → users, acc_id → accounts, target, deadline, note, created)
user_settings (user_id → users, strategies JSON, assets JSON, active_acc)
```

All tables have `ON DELETE CASCADE` from users. Data is fully isolated per user.

## Frontend State (A.s)

```
{
  accounts:     [{id, name, cap, created}],
  records:      [{id, accId, date, pnl, strat, asset, notes, at}],
  transactions: [{id, accId, date, amount, type:'deposit'|'withdrawal', notes, at}],
  targets:      [{id, accId, target, deadline, note, created}],
  active:       <accountId>,
  strategies:   [string],
  assets:       [string],
  view:         'dashboard' | 'records' | 'calendar' | 'accounts' | 'settings',
  filter:       {q, strat, asset},
  sort:         {col, dir},
  sel:          Set<id>,
  calYear:      number,
  calMonth:     number   // 0-indexed
}
```

**Data flow:** `User Action → A.* method (async) → apiFetch() → server → DB → update A.s → A.render()`

**Auth:** JWT stored in `localStorage` under key `tj_token`. `apiFetch()` injects it automatically. 401 response → `A.showLogin()`.

## Key Frontend Methods

| Method | Purpose |
|---|---|
| `A.load()` | Fetch all data from `/api/load`, populate `A.s`, hide login screen |
| `A.save()` | Fire-and-forget PUT `/api/settings` (strategies, assets, active account) |
| `A.showLogin()`, `A.doLogin()`, `A.doRegister()`, `A.logout()` | Auth flow |
| `A.addAcc`, `A.delAcc`, `A.setAcc` | Account CRUD (async API calls) |
| `A.addRec`, `A.updRec`, `A.delRec` | Record CRUD (async API calls) |
| `A.netTx(accId)` | Net deposit/withdrawal computed from `A.s.transactions` |
| `A.openTx`, `A.submitTx`, `A.delTx` | Transaction CRUD |
| `A.addTarget`, `A.updTarget`, `A.delTarget` | Profit target CRUD |
| `A.addStrat`, `A.delStrat`, `A.addAsset`, `A.delAsset` | Settings (calls `A.save()`) |
| `A.stats()` | Computes all analytics — aggregates by date first |
| `A.lineChart`, `A.barChart` | Inline SVG chart generation |
| `A.calPrev`, `A.calNext`, `A.calToday` | Calendar navigation |
| `A.vDash`, `A.vRecs`, `A.vCalendar`, `A.vAcc`, `A.vSettings` | View renderers |
| `F.*` | Formatters: `pnl()`, `$()`, `pct()`, `date()`, `ds()` |

## Capital Formula

```
Current Capital = account.cap (initial) + netTx(accId) + total_pnl
Return %        = total_pnl / account.cap × 100   ← unaffected by deposits
```

## Design System

CSS variables in `:root`:
- `--p` / `--p15` / `--p30`: green (profit, primary, deposit)
- `--r` / `--r15` / `--r30`: red (loss, destructive)
- `--a` / `--a15`: amber (warning, withdrawal)
- `--bg`: `#030303` · `--rad`: `3px` · `--ink`: body text · `--dim`: muted text

Button variants: `.btn-deposit` (green), `.btn-withdraw` (amber), `.btn-danger` (red), `.btn-ghost` (dim).

## Responsive Breakpoints

| Range | Behaviour |
|---|---|
| `≤ 767px` | Mobile: bottom nav, hidden top tabs, bottom-sheet modals |
| `≤ 767px` landscape | Compact 44px nav, 2-col chart row |
| `≤ 414px` | Narrow phone tweaks |
| `≤ 360px` | Single-column account cards |
| `768–1023px` | Tablet: top nav, no bottom nav |
| `≥ 1024px` | Desktop |

## Important Conventions

- IDs generated via `Date.now()` — no UUID library
- All user strings rendered into HTML go through `esc()` to prevent XSS
- Charts are pure SVG strings — no chart library
- `A.stats()` aggregates records by date into daily totals before all metrics
- CSV export iterates `s.recs` (individual records), not day aggregates
- Login screen (`#ls`) is a fixed overlay — hidden after successful `A.load()`
- Turso Row objects must be explicitly mapped by column name (not spread `{...r}`) — named proxy properties are not enumerable

## Profit Target System

Each target scoped to `accId`. Progress in `vDash()`:
```
pct     = clamp(0, 100, tot / target.target × 100)
pacePct = (elapsedDays / totalDays) × 100
```

Bar color: green (achieved or on pace), amber (slightly behind), red (overdue or far behind). White pace marker tick at `pacePct` position.

Badges: `ACHIEVED` (green), `OVERDUE` (red), `TODAY` / `Xd LEFT` (amber, last 7 days).
