# Daybook — Spec

## Overview
A simple daily accounting PWA for personal use on iPhone. Track a running cash/account balance day by day with credit and debit transactions across multiple named ledgers. All data is stored locally — no backend, no sync. A serverless function on Vercel handles email report delivery.

**Production URL:** https://daybook-lyart.vercel.app
**Dev/Preview URL:** https://daybook-dev.vercel.app
**Repo:** https://github.com/Rishi-Kumar/daybook.git

### Branching & Deployment Workflow
- **`dev` branch** → auto-deploys to the Dev/Preview URL above (Vercel branch alias)
- **`main` branch** → auto-deploys to Production
- Workflow: make changes on `dev` → test at preview URL → merge to `main` to ship to prod

---

## Tech Stack

### Client
- **React + Vite** — UI framework and build tool
- **vite-plugin-pwa** — Service worker and manifest generation
- **idb** — Thin IndexedDB wrapper for local persistence (DB version 3)
- **CSS Modules** — Scoped, mobile-first styles; no UI framework
- **uuid** — Transaction ID generation

### Server (Vercel Serverless Functions, `/api`)
- **Nodemailer** — Email delivery via Gmail SMTP
- **jsPDF + jspdf-autotable** — Server-side PDF report generation

### Deployment
- **Vercel** — Hosting + serverless functions
- **Environment variables:** `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Gmail App Password)

---

## Data Model

### `settings` store (key-value, IndexedDB)
| Key | Value | Description |
|-----|-------|-------------|
| `activeLedgerId` | string | ID of the currently selected ledger |
| `reportEmail` | string | Last-used recipient email address for report delivery |

### `ledgers` store (IndexedDB, keyPath: `id`)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Primary key |
| `name` | string | Display name (e.g. "Cash") |
| `openingBalance` | number (signed) | Balance at the start of this ledger |
| `setupDate` | "YYYY-MM-DD" | The date the ledger was created |
| `createdAt` | number | Unix timestamp ms |

### `transactions` store (IndexedDB, keyPath: `id`)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Primary key |
| `ledgerId` | string | Foreign key to ledger |
| `date` | "YYYY-MM-DD" | The day this transaction belongs to |
| `type` | "credit" \| "debit" | Direction of money (derived from sign of amount) |
| `amount` | number (signed) | Positive for credit, negative for debit |
| `particulars` | string | Free-text description |
| `createdAt` | number | Unix timestamp ms (for ordering within a day) |

**Indexes:**
- `transactions.by_date` — Index on `date`
- `transactions.by_ledger_date` — Compound index on `[ledgerId, date]`

### DB Migration History
- **v1→v2:** Introduced `ledgers` store; created a default ledger from legacy `openingBalance`/`setupDate` settings; added `ledgerId` to all transactions
- **v2→v3:** Debit amounts converted from positive to negative; `type` field retained but now derived from sign

---

## Business Logic

### Opening balance for a given day
- Walk backwards through dates to find the most recent prior day with transactions
- If no prior day exists → use `ledger.openingBalance`
- `getOpeningBalancesForDates(dates, ledgerId)` batch function: 2 DB reads total for any number of dates; builds a cumulative balance array then resolves each query date in O(n)

### Closing balance for a given day
```
closingBalance = openingBalance + sum(signed amounts for that day)
```

### Transaction sort order within a day
Credits first, then debits. Within each group, sorted by `createdAt` ascending (order added).

### Closing balance row display
- Shown at month boundaries and at the final date in the query range
- Month-end closing balance rows include an "End of MMM YYYY" label (except the final row)
- Closing balance text is green if positive, red if negative

---

## Screens

### 1. Setup Screen (first launch only)
- Shown when no ledgers exist
- Ledger Name input (defaults to "Cash")
- Opening Balance input with +/− sign toggle (allows negative balances)
- "Get Started" button creates the ledger and navigates to the Transactions tab

### 2. Transactions Screen (Transactions tab)
- Header: app name + date range, envelope icon (email report) top-right
  - Email button disabled when loading or no transactions in range
- Date range picker: From / To date inputs (stacked vertically), defaults to last 7 days
- Transactions grouped by day in ascending date order
- Each day group:
  - Sticky date header
  - Opening Balance row (shown on the first day of the range)
  - All transactions for that day (credits first, then debits)
  - Closing Balance row (shown at month-end and the last day in range)
- Each transaction row:
  - +/− sign badge (colour-coded green/red)
  - Particulars
  - Amount right-aligned
  - No delete button (read-only in history view context)
  - Long-press (500 ms) or right-click → opens Edit sheet
- Empty state when no transactions in range

### 3. Add / Edit Transaction Bottom Sheet
- Slide-up modal with drag handle; triggered by the center `+` nav button (add) or long-press/right-click on a row (edit)
- × close button in header; tapping the backdrop also dismisses
- Fields in order:
  1. Date (date input, defaults to today; capped at today — no future dates)
  2. Particulars (text input, auto-focused on open; Enter submits)
  3. +/− sign toggle (pill selector)
  4. Amount (numeric input; Enter submits)
  5. Ledger picker (only shown when 2+ ledgers exist)
- Save button label: "Save" (add mode) or "Update" (edit mode)
- Delete button appears in edit mode only, with a confirmation dialog
- Validates amount > 0; shows inline error if invalid

### 4. Ledgers Screen (Ledgers tab)
- Header: "Ledgers" title, "New" button top-right
- Cards listing all ledgers, each showing:
  - Ledger name
  - Active indicator dot (if currently selected)
  - Current balance (negative shown in red)
- Tapping a card sets it as the active ledger and switches to the Transactions tab
- Long-press (500 ms) or right-click on a card → opens Edit Ledger sheet

### 5. Add / Edit Ledger Bottom Sheet
- Slide-up modal with drag handle
- Fields: Name (required, auto-focused), Opening Balance with +/− toggle
- "Create Ledger" (add) or "Save Changes" (edit) button
- Delete button in edit mode with confirmation (cascades all transactions for that ledger)

### 6. Email Report
- Triggered by the envelope icon in the Transactions screen header
- Slide-up bottom sheet (EmailSheet component):
  - Email input pre-filled with last-used address (persisted in IndexedDB as `reportEmail`)
  - "Send Report" button — disabled while empty or sending
  - Success state: green checkmark + "Report sent to {address}" + Done button
  - Error state: inline error message
- On send: POSTs `{ to, ledgers, fromDate, toDate }` to `/api/send-report`
  - `ledgers` contains all ledgers that have transactions in the date range
- `/api/send-report` serverless function:
  - Generates HTML email body
  - Generates a PDF attachment via jsPDF + jspdf-autotable:
    - One section per ledger; each ledger after the first starts on a new page
    - Header: "Daybook Report", date range, generated timestamp
    - Per-ledger section: ledger name heading, table with Date | Particulars | Credit | Debit columns
    - Opening Balance and Closing Balance rows highlighted in light gray + bold
    - Credit amounts in green (#158b3d), debit amounts in red (#b91c1c)
    - Page break guard: if `y > 265 mm`, new page added and `y` resets to 14 mm
  - Sends via Nodemailer + Gmail SMTP
  - Returns `{ ok: true }` on success, `{ error: string }` on failure

---

## Navigation
Bottom tab bar with three items:
- **Transactions tab** (list icon, left) — shows the Transactions Screen for the active ledger
- **+ button** (circular, center action) — opens the Add Transaction sheet, switches to Transactions tab
- **Ledgers tab** (book icon, right) — shows the Ledgers Screen

---

## Currency & Formatting
- All amounts in INR
- No currency symbol displayed anywhere (neither in-app nor in reports)
- No `+`/`−` prefix on amounts in history; colour conveys direction
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

## Tests

### E2E (Playwright, `/e2e/cuj.spec.js`)
7 critical user journeys:
1. First-time setup — create ledger, land on main screen
2. Add credit transaction — appears in list, closing balance increases
3. Add debit transaction — appears in list, closing balance decreases
4. Edit transaction — long-press/right-click, change amount, balance recalculates
5. Delete transaction — right-click → confirm, removed from list
6. Tab navigation — switch between Transactions and Ledgers tabs
7. Email report — add transaction, send to test address, verify success state

### Unit (Vitest, `/src/__tests__/utils.test.js`)
- `formatCurrency()` — INR formatting with 2 decimals, handles negatives
- `formatDateDMY()` — YYYY-MM-DD → DD/MM/YYYY
- `formatMonthEnd()` — returns "End of MMM YYYY"
- `toDateStr()` — Date object → YYYY-MM-DD
- `formatDateLong()` — human-readable date string

---

## Constraints
- Mobile-first: designed for 375px–430px (iPhone)
- Client data: IndexedDB only — no backend, no auth, no sync
- Works fully offline after first load (email feature requires connectivity)
- Multiple ledgers, single currency (INR)
