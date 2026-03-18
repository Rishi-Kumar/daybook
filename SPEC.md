# Daybook — Spec

## Overview
A simple daily accounting PWA for personal use on iPhone. Track a running cash/account balance day by day with credit and debit transactions. All data is stored locally — no backend, no sync. A serverless function on Vercel handles email report delivery.

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
- **idb** — Thin IndexedDB wrapper for local persistence
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
| `openingBalance` | number | One-time setup balance (balance at the very start) |
| `setupDate` | "YYYY-MM-DD" | The date the user set up the app |
| `reportEmail` | string | Last-used recipient email address for report delivery |

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
- `getOpeningBalancesForDates(dates)` batch function: 2 DB reads total for any number of dates; builds a cumulative balance array then resolves each query date in O(n)

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
- Single numeric input: opening balance (no currency prefix, spinner arrows hidden)
- "Get Started" button saves balance + setup date to DB, then navigates to Today

### 2. Today Screen (Home tab)
- Header: app name + today's date
- Opening balance row
- Scrollable transaction list (credits first, then debits, each group in insertion order)
  - Each row: CR/DR badge (colour-coded), particulars, amount right-aligned, trash icon delete button
  - Long-press (500 ms) or right-click to open the Edit sheet
  - Tapping the trash icon deletes immediately (no confirmation)
  - Empty state: "No transactions yet"
- Sticky footer: closing balance
- Floating `+` button (bottom-right) → opens Add/Edit Transaction sheet

### 3. Add / Edit Transaction Bottom Sheet
- Slide-up modal with drag handle; edit triggered by long-press or right-click on a transaction row
- × close button in header; tapping the backdrop also dismisses
- Fields in order:
  1. Date (date input, defaults to today; capped at today — no future dates)
  2. Particulars (text input, auto-focused on open; Enter submits)
  3. Credit / Debit toggle (pill selector)
  4. Amount (numeric input; Enter submits)
- Save button label reflects the type: "Save Credit" / "Save Debit" (add mode) or "Update Credit" / "Update Debit" (edit mode)
- Validates amount > 0; shows inline error if invalid
- Delete is handled inline in the transaction list row — the sheet itself has no Delete button

### 4. History Screen (History tab)
- Header: "Daybook" app name + "History" title, email button top-right
  - Email button disabled when loading or no transactions in range
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
- Transaction list rendered in **readOnly** mode — no inline delete button, no edit gesture
- Empty state when no transactions in range

### 5. Email Report
- Triggered by the envelope icon in the History screen header
- Slide-up bottom sheet (EmailSheet component):
  - Email input pre-filled with last-used address (persisted in IndexedDB as `reportEmail`)
  - "Send Report" button — disabled while empty or sending
  - Success state: green checkmark + "Report sent to {address}" + Done button
  - Error state: inline error message
- On send: POSTs `{ to, groups, fromDate, toDate }` to `/api/send-report`
- `/api/send-report` serverless function:
  - Generates HTML email body via `generatePrintReport(..., { forEmail: true })` (shared with client)
  - Generates a PDF attachment via jsPDF + jspdf-autotable
  - PDF layout: plain header (title, date range, generated timestamp), thin rule, gray uppercase day headings, one table per day (Particulars | Credit | Debit), opening/closing balance rows highlighted in light gray + bold, credit amounts in green, debit amounts in red
  - Internal "tag" field (`'balance'` | `'credit'` | `'debit'`) is appended as a 4th element per body row for `didParseCell` styling; it is stripped before passing to autoTable and never appears as a column
  - Page break guard: if `y > 265 mm`, a new page is added and `y` resets to 14 mm
  - Sends via Nodemailer + Gmail SMTP (`GMAIL_USER` / `GMAIL_APP_PASSWORD`)
  - Returns `{ ok: true }` on success, `{ error: string }` on failure

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
- Client data: IndexedDB only — no backend, no auth, no sync
- Works fully offline after first load (email feature requires connectivity)
- Single ledger, single currency
