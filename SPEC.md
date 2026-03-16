# Daybook — Spec

## Overview
A simple daily accounting PWA for personal use on iPhone. Track a running cash/account balance day by day with credit and debit transactions. All data is stored locally — no backend, no sync.

**Production URL:** https://daybook-lyart.vercel.app
**Repo:** https://github.com/Rishi-Kumar/daybook.git

---

## Tech Stack
- **React + Vite** — UI framework and build tool
- **vite-plugin-pwa** — Service worker and manifest generation
- **idb** — Thin IndexedDB wrapper for local persistence
- **CSS Modules** — Scoped, mobile-first styles; no UI framework
- **uuid** — Transaction ID generation
- **Vercel** — Deployment

---

## Data Model

### `settings` store (key-value, IndexedDB)
| Key | Value | Description |
|-----|-------|-------------|
| `openingBalance` | number | One-time setup balance (balance at the very start) |
| `setupDate` | "YYYY-MM-DD" | The date the user set up the app |

### `transactions` store (IndexedDB, indexed by `date`)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Primary key |
| `date` | "YYYY-MM-DD" | The day this transaction belongs to |
| `type` | "credit" \| "debit" | Direction of money |
| `amount` | number | Positive value |
| `particulars` | string | Free-text description |
| `createdAt` | number | Unix timestamp ms (for ordering within a day) |

---

## Business Logic

### Opening balance for a given day
- Walk backwards through dates to find the most recent prior day with transactions
- If no prior day exists → use `settings.openingBalance`

### Closing balance for a given day
```
closingBalance = openingBalance
  + sum(credits for that day)
  - sum(debits for that day)
```

### Transaction sort order within a day
Credits first, then debits. Within each group, sorted by `createdAt` ascending (order added).

---

## Screens

### 1. Setup Screen (first launch only)
- Shown when `settings.openingBalance` is not set
- Single input: opening balance (numeric)
- "Get Started" button saves to DB and navigates to Today

### 2. Today Screen (Home tab)
- Header: app name + today's date
- Opening balance row
- Scrollable transaction list (credits first, then debits, each group in insertion order)
  - Each row: CR/DR badge (colour-coded), particulars, amount right-aligned
  - Tap to view; long-press to edit
  - Empty state: "No transactions yet"
- Sticky footer: closing balance
- Floating `+` button (bottom-right) → opens Add/Edit Transaction sheet

### 3. Add / Edit Transaction Bottom Sheet
- Slide-up modal (edit triggered by long-press on a transaction row)
- Fields in order:
  1. Date (date input, defaults to today)
  2. Particulars (text input)
  3. Credit / Debit toggle (pill selector)
  4. Amount (numeric input)
- "Save" / "Update" button — validates non-zero amount, saves to DB, closes sheet
- Edit mode also shows a "Delete" button
- Tap backdrop or swipe down to dismiss

### 4. History Screen (History tab)
- Header: "Daybook" app name label + "History" title on next line, print button top-right
- Date range picker: From / To date inputs (stacked vertically)
  - Defaults to last 7 days
- Transactions grouped by day in ascending date order
- Each day group:
  - Sticky date header
  - Opening Balance row
  - All transactions for that day (credits first, then debits)
  - Closing Balance row
- CR/DR badge on each transaction row (colour-coded green/red)
- Amount shown without `+`/`−` signs; colour conveys direction
- Empty state when no transactions in range
- Print button disabled when no transactions in range

### 5. Print Report
- Triggered from History screen print button
- Opens a new browser tab with a self-contained HTML report
- Print dialog auto-triggered after 100ms (iOS Safari delay required for DOM parse)
- Report contents:
  - Top bar: ← Back button (`window.close()`), share/print icon (`window.print()`)
  - Header: title, date range, generated timestamp
  - One section per day: date heading + table with columns Particulars | Credit | Debit
  - Opening and closing balance rows in the table
    - Positive balance → shown in Credit column
    - Negative balance → shown in Debit column (absolute value)
  - Top bar hidden at `@media print`
- iOS "Save as PDF" available via native print dialog

---

## Navigation
Bottom tab bar with two tabs:
- **Today** (home icon)
- **History** (clock/list icon)

---

## Currency & Formatting
- All amounts in INR
- No currency symbol displayed anywhere (neither in-app nor in reports)
- No `+`/`−` prefix on amounts; colour conveys direction
- Format: Indian numbering system with 2 decimal places
  - `Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
- Positive amounts: green (`var(--credit)`)
- Negative / debit amounts: red (`var(--debit)`)

---

## PWA Configuration
- `manifest.json`: name "Daybook", short_name "Daybook", `display: standalone`
- Service worker via vite-plugin-pwa: cache-first for app shell
- iOS meta tags for standalone mode and status bar style
- 192×192 and 512×512 app icons

---

## Constraints
- Mobile-first: designed for 375px–430px (iPhone)
- No backend, no auth, no sync — IndexedDB only
- Works fully offline after first load
- Single ledger, single currency
