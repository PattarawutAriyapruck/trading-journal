# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build process or dependencies. Open `trading-journal-app.html` directly in any modern browser.

## Architecture

The entire app lives in a single file: [`trading-journal-app.html`](trading-journal-app.html) (~1550 lines).

**Stack:** Vanilla HTML/CSS/JavaScript — no framework, no bundler, no npm. External resources are Google Fonts only (Space Grotesk, JetBrains Mono).

**State:** A single global object `A` holds all application logic and state. `A.s` is the state tree, persisted to `localStorage` under key `tj_v3`.

```
State shape (A.s):
{
  accounts:     [{id, name, cap, created}],
  records:      [{id, accId, date, pnl, strat, asset, notes, at}],
  transactions: [{id, accId, date, amount, type:'deposit'|'withdrawal', notes, at}],
  targets:      [{id, accId, target, deadline, note, created}],  // profit targets
  active:       <accountId>,
  strategies:   [string],
  assets:       [string],
  view:         'dashboard' | 'records' | 'calendar' | 'accounts' | 'settings',
  filter:       {q, strat, asset},
  sort:         {col, dir},
  sel:          Set<id>,         // bulk-selected record IDs
  calYear:      number,
  calMonth:     number           // 0-indexed
}
```

**Data flow:** `User Action → A.* method → mutate A.s → A.save() → A.render() → DOM update`

## Key Methods of A

| Method group | Purpose |
|---|---|
| `A.load()` / `A.save()` | Read/write localStorage |
| `A.addAcc`, `A.delAcc`, `A.setAcc` | Account CRUD |
| `A.addRec`, `A.updRec`, `A.delRec` | Record CRUD |
| `A.netTx(accId)` | Net deposit/withdrawal for an account (deposits − withdrawals) |
| `A.openTx`, `A.submitTx`, `A.delTx`, `A.confDelTx` | Transaction (deposit/withdrawal) CRUD |
| `A.addTarget`, `A.updTarget`, `A.delTarget` | Profit target CRUD |
| `A.openTarget`, `A.submitTarget`, `A.confDelTarget` | Profit target modal open/submit/confirm-delete |
| `A.addStrat`, `A.delStrat`, `A.addAsset`, `A.delAsset` | Settings management |
| `A.stats()` | Computes all analytics — aggregates records by date first, then computes P&L, win rate, streaks, risk metrics, cumData |
| `A.lineChart`, `A.barChart` | Inline SVG chart generation |
| `A.calPrev`, `A.calNext`, `A.calToday`, `A.calTip` | Calendar navigation and tooltip |
| `A.vDash`, `A.vRecs`, `A.vCalendar`, `A.vAcc`, `A.vSettings` | View renderers |
| `F.*` (Formatters) | `pnl()`, `$()`, `pct()`, `date()`, `ds()` |

## Capital Formula

```
Current Capital = account.cap (initial) + netTx(accId) + total_pnl
Return %        = total_pnl / account.cap × 100   ← trading performance only, unaffected by deposits
```

`netTx` is computed fresh on every render from `A.s.transactions` — it is never stored on the account object.

## stats() Aggregation

`stats()` first groups `records` by date into daily totals before computing any metric. Two records on the same date are treated as one trading day. This affects win rate, streaks, best/worst day, charts, and everything else. Individual `records` are still returned as `s.recs` for use in table views.

## Design System

CSS variables (all in `:root`):
- `--p` / `--p15` / `--p30`: green (profit, primary actions, deposit)
- `--r` / `--r15` / `--r30`: red (loss, destructive actions)
- `--a` / `--a15`: amber (warning, withdrawal)
- `--bg`: `#030303`; `--rad`: `3px`; `--ink`: body text; `--dim`: muted text

Button variants: `.btn-deposit` (green), `.btn-withdraw` (amber), `.btn-danger` (red), `.btn-ghost` (dim).

## Responsive System

The app is fully responsive across mobile, tablet, and desktop with portrait/landscape support.

**Breakpoints:**
| Range | Behaviour |
|---|---|
| `≤ 767px` | Mobile: bottom nav, hidden top tabs, bottom-sheet modals |
| `≤ 767px` + landscape | Compact 44px bottom nav, tighter padding, 2-col chart row restored |
| `≤ 414px` | Narrow phone tweaks (smaller Add Record button) |
| `≤ 360px` | Very small phones: single-column account cards |
| `768–1023px` | Tablet: full top nav tabs, no bottom nav |
| `≥ 1024px` | Desktop: unchanged |

**Bottom Navigation (`.nav-bottom`, `.nb-tab`, `.nb-ico`):**
- Hidden on tablet/desktop; shown only at `≤ 767px`
- Fixed to bottom, 56px tall (44px in landscape)
- Contains 5 tabs with inline SVG icons: Dash, Records, Calendar, Accounts, Settings
- Active state synced in `A.render()` via `document.querySelectorAll('.nav-tab,.nb-tab')`
- Includes `padding-bottom: env(safe-area-inset-bottom)` for iPhone home indicator

**Mobile nav bar:** Top tabs (`nav-tabs`) hidden; dot + account selector + Add Record button remain.  
**Logo text** (`nav-logo-txt` span): hidden at `≤ 767px`, leaving only the animated dot.

**Touch & input conventions:**
- `@media(hover:none)` forces `.td-act` (Edit/Del row buttons) always visible — hover-only is inaccessible on touch.
- `font-size: 16px` on all `input/select/textarea` at `≤ 767px` prevents iOS auto-zoom on focus.
- Buttons: `min-height: 40px` on mobile; modal footer buttons stretch full-width (`flex:1`).
- Touch targets: `min-height: 44px` on modal action buttons.

**Modals on mobile:** `.mbk` aligns to `flex-end` (bottom sheet), modal gets `border-radius: 6px 6px 0 0` and `max-width: 100%`. In landscape, reverts to centered with `border-radius: 3px`.

**Safe areas:** `viewport-fit=cover` in the meta viewport tag. Bottom nav and `.main` padding account for `env(safe-area-inset-bottom)` and lateral insets.

## Important Conventions

- IDs are generated via `Date.now()` — no UUID library.
- All user-supplied strings rendered into HTML must go through `esc()` to prevent XSS.
- Charts are pure SVG strings built in JavaScript — no chart library.
- Modal close: click-outside and Escape key both trigger dismissal (wired in `A.init()` via `querySelectorAll('.mbk')`).
- CSV export iterates `s.recs` (individual records), not `cumData` (day aggregates).
- When deleting an account (`A.delAcc`), both `records` and `transactions` for that account are purged.
- Calendar heat-map intensity is relative to the month's max absolute P&L, computed inside `vCalendar()`.
- When deleting an account (`A.delAcc`), `targets` for that account are **not** purged — targets are currently global and survive account deletion. If account-scoped cleanup is needed, add a `targets` filter inside `delAcc`.

## Profit Target System

Targets live in `A.s.targets` (persisted to localStorage). Each target is scoped to an `accId`.

**Progress calculation (inside `vDash`):**
```
pct      = clamp(0, 100, tot / target.target × 100)
pacePct  = (elapsedDays / totalDays) × 100   ← time elapsed since target was created
```

**Bar color logic:**
| Condition | Color |
|---|---|
| `pct >= 100` (achieved) | Green |
| `isOverdue` (deadline passed, not achieved) | Red |
| `pct >= pacePct − 5` (on pace) | Green |
| `pct >= pacePct − 20` (slightly behind) | Amber |
| otherwise (far behind) | Red |

**Pace marker:** A white tick is rendered inside the progress track at `pacePct` position, showing where you *should* be today relative to total duration.

**Badges:** `ACHIEVED` (green), `OVERDUE` (red), `TODAY` / `Xd LEFT` (amber, last 7 days).
