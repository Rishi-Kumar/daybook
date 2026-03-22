# Daybook — Product Spec

## What it is
A personal cash book for iPhone. Track daily transactions across one or more named accounts (ledgers), see running balances, and email yourself a report.

---

## First Launch

The user is prompted to set up their first ledger:
- Enter a name (defaults to "Cash")
- Enter the opening balance — the amount they're starting with (can be negative)
- Tap **Get Started**

This only happens once. Subsequent launches go straight to the Transactions screen.

---

## Navigation

Three items in a bottom bar:
- **Transactions** (left) — view and manage transactions for the active ledger
- **+** (centre, raised circular button) — add a new transaction
- **Ledgers** (right) — manage ledgers

---

## Transactions Screen

Shows a date range of transactions for the currently active ledger.

**Date range:** Defaults to the last 7 days. The user can change the From and To dates freely.

**Layout:** Transactions are grouped by day, in chronological order. Each day group shows:
- Opening balance for that day
- All transactions (credits listed before debits)
- Closing balance — shown at the end of each month and at the final day in the range. Month-end closing rows are labelled "End of MMM YYYY".

**Each transaction row shows:**
- A +/− badge (green for credit, red for debit)
- Description (particulars)
- Amount (right-aligned)

**Editing:** Long-press or right-click a transaction to open the edit sheet.

**Empty state:** A message when there are no transactions in the selected range.

---

## Adding / Editing a Transaction

Opens as a slide-up sheet. Tapping the backdrop or the × button dismisses it without saving.

**Fields:**
1. **Date** — defaults to today; cannot be set to a future date
2. **Description** — free text; auto-focused when the sheet opens
3. **+/−** — toggles between credit and debit
4. **Amount** — must be greater than zero
5. **Ledger** — only shown when there are two or more ledgers; lets the user pick which ledger the transaction belongs to

**Saving:** The button is labelled "Save" when adding, "Update" when editing. Pressing Enter in any field submits the form.

**Deleting:** In edit mode, a Delete button appears. Tapping it asks for confirmation before removing the transaction.

---

## Ledgers Screen

Lists all ledgers. Each card shows the ledger name and its current balance. The active ledger is marked with a dot.

- **Tap a card** → makes it the active ledger and switches to the Transactions screen
- **Long-press or right-click a card** → opens the edit sheet for that ledger
- **New button (top-right)** → opens the add ledger sheet

---

## Adding / Editing a Ledger

Opens as a slide-up sheet.

**Fields:**
- **Name** (required)
- **Opening balance** with a +/− toggle

**Deleting a ledger** (edit mode only): requires confirmation. Permanently removes the ledger and all its transactions.

---

## Email Report

Triggered by the envelope icon in the Transactions screen header. The button is disabled when there are no transactions in the current date range.

A sheet slides up with an email address field (pre-filled with the last address used). Tapping **Send Report** emails a PDF report covering all ledgers that have transactions in the selected date range.

The PDF contains one section per ledger. Each section shows a table of transactions grouped by day, with opening and closing balances. Credit amounts are green, debit amounts are red.

On success, the sheet shows a confirmation. On failure, it shows an error message.

---

## Amounts & Display

- All amounts are in INR
- No currency symbol is shown anywhere
- Amounts are formatted in the Indian numbering system (e.g. 1,00,000.00)
- Colour conveys direction: green = credit/positive, red = debit/negative
- No + or − prefix on amounts

---

## General Behaviour

- **All data is stored on-device.** Nothing is sent to a server except when emailing a report.
- **Works offline** after the first load. The email feature requires an internet connection.
- Designed for iPhone.
