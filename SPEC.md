# Daybook — Spec

## Overview
A simple daily accounting PWA for personal use. Track a running cash/account balance day by day with credit and debit transactions.

---

## Tech Stack
- **React + Vite** — UI framework and build tool
- **vite-plugin-pwa** — Service worker and manifest generation
- **idb** — Thin IndexedDB wrapper for local persistence
- **CSS Modules** — Scoped, mobile-first styles; no UI framework

---

## Data Model

### `settings` store (key-value)
| Key | Value | Description |
|-----|-------|-------------|
| `openingBalance` | number | One-time setup balance (balance at the very start) |
| `setupDate` | "YYYY-MM-DD" | The date the user set up the app |

### `transactions` store
| Field | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Primary key |
| `date` | "YYYY-MM-DD" | The day this transaction belongs to |
| `type` | "credit" \| "debit" | Direction of money |
| `amount` | number | Positive value in INR |
| `particulars` | string | Free-text description |
| `createdAt` | number | Unix timestamp (for ordering within a day) |

---

## Business Logic

### Opening balance for a given day
- If the day == setupDate → use `settings.openingBalance`
- Otherwise → closing balance of the previous day that has data
  - Walk backwards through dates until a day with transactions is found
  - If no prior day exists → fall back to `settings.openingBalance`

### Closing balance for a given day
```
closingBalance = openingBalance
  + sum(credits for that day)
  - sum(debits for that day)
```

---

## Screens

### 1. Setup Screen (first launch only)
- Shown when `settings.openingBalance` is not set
- Single input: opening balance (numeric, INR)
- "Get Started" button saves to DB and navigates to Today

### 2. Today Screen (Home)
- Header: app name + today's date (e.g. "Mon, 15 Mar 2026")
- Opening balance row
- Scrollable transaction list (newest first within day)
  - Each row: particulars, credit/debit badge, amount (right-aligned)
  - Empty state: "No transactions yet"
- Sticky footer: closing balance
- Floating `+` button (bottom-right) → opens Add Transaction sheet

### 3. Add Transaction Bottom Sheet
- Slide-up modal
- Fields:
  - Amount (numeric input, INR)
  - Credit / Debit toggle (pill selector)
  - Particulars (text input)
- "Save" button — validates non-zero amount, saves to DB, closes sheet
- Tap backdrop or swipe down to dismiss

### 4. History Screen
- Accessed via bottom tab bar
- List of all days that have transactions, newest first
- Each row: date, opening balance, closing balance, transaction count
- Tap a row → Day Detail view

### 5. Day Detail View
- Same layout as Today screen but read-only (no `+` button)
- Back button to return to History

---

## Navigation
Bottom tab bar with two tabs:
- **Today** (home icon)
- **History** (clock/list icon)

---

## PWA Configuration
- `manifest.json`: name "Daybook", short_name "Daybook", theme color, display standalone
- Service worker: cache-first for app shell, network-first for nothing (all local)
- iOS meta tags for standalone mode and status bar
- 192×192 and 512×512 app icons

---

## Currency & Formatting
- All amounts in INR
- Format: `₹1,23,456.00` (Indian numbering system)
- Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`

---

## Constraints
- Mobile-first: designed for 375px–430px width
- No backend, no auth, no sync
- Works fully offline after first load
- Single ledger, single currency
