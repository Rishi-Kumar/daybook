# Ledgers Feature — Implementation Plan

## Context
The app currently supports a single implicit ledger. The user wants multiple named ledgers with their own opening balance and transactions. Navigation uses a bottom tab bar: **Transactions** tab (shows active ledger via MainScreen) and **Ledgers** tab (list/manage all ledgers). Tapping a ledger in the Ledgers tab sets it active and jumps to Transactions. Existing data auto-migrates to "Default".

User decisions:
- **Navigation**: Bottom tab — Transactions | Ledgers
- **Ops**: Create, Rename/edit balance, Delete (with all transactions)
- **Migration**: Auto-migrate existing data into "Default" ledger
- **Add tx ledger**: Picker in Add Transaction sheet (defaults to active ledger, switchable)
- **Email report**: Scoped to the active ledger

---

## Architecture Overview

```
App.jsx  (tab: 'transactions' | 'ledgers', activeLedgerId)
  ├── MainScreen (ledgerId=activeLedgerId)   ← Transactions tab
  ├── LedgersScreen (onSelect → sets active + switches tab)  ← Ledgers tab
  └── BottomNav (tabs: 'transactions', 'ledgers')
```

`activeLedgerId` lives in `App.jsx` state. Persisted to `settings` store as `activeLedgerId` so the last-used ledger is remembered on next open.

---

## Step 1 — DB Layer (`src/db.js`)

### Schema: DB_VERSION 1 → 2

**New `ledgers` store** (`keyPath: 'id'`):
```
{ id, name, openingBalance, setupDate, createdAt }
```

**`transactions` store**: add compound index `by_ledger_date` on `['ledgerId', 'date']`. Keep existing `by_date` index.

**`settings` store**: new key `activeLedgerId` (persisted active ledger).

### Migration (`oldVersion === 1`)
Inside `upgrade(db, oldVersion, newVersion, tx)`:
1. Create `ledgers` store
2. Add `by_ledger_date` compound index to existing `transactions` store via `tx.objectStore('transactions').createIndex(...)`
3. Read `openingBalance` + `setupDate` from `tx.objectStore('settings')`
4. Create Default ledger: `tx.objectStore('ledgers').add({ id: crypto.randomUUID(), name: 'Default', openingBalance, setupDate, createdAt: Date.now() })`
5. Stamp all existing transactions: `getAll` → `put` each with `ledgerId` added

### New ledger functions
- `getAllLedgers()` — getAll, sort by createdAt asc
- `getLedger(id)` — db.get
- `addLedger(ledger)` — db.add
- `updateLedger(ledger)` — db.put
- `deleteLedger(id)` — delete all txs via compound index range `[id,'']→[id,'\uffff']`, then delete ledger
- `getLedgerCurrentBalance(ledgerId)` — load `ledger.openingBalance`, getAll txs via compound index, accumulate. Used for balance display on ledger cards.

### Modified transaction functions (add `ledgerId` param)
- `getTransactionsForDate(date, ledgerId)` — `IDBKeyRange.only([ledgerId, date])` on `by_ledger_date`
- `getAllDatesWithTransactions(ledgerId)` — range query on compound index, extract unique dates
- `getOpeningBalance(date, ledgerId)` — read balance from ledger record instead of settings; filter prior txs by ledgerId
- `getOpeningBalancesForDates(dates, ledgerId)` — same batch algorithm, scoped to ledger

---

## Step 2 — `src/App.jsx`

```js
const [ready, setReady] = useState(false)
const [tab, setTab] = useState('transactions')
const [activeLedgerId, setActiveLedgerId] = useState(null)
```

On mount:
1. `getAllLedgers()` → if empty → show `SetupScreen`
2. Load `getSetting('activeLedgerId')` → if found + exists in ledgers → use it; else → use first ledger
3. Set `activeLedgerId`, `ready = true`

Render (when ready + has ledgers):
```jsx
<>
  <div className="screen-area">
    {tab === 'transactions' && <MainScreen ledgerId={activeLedgerId} />}
    {tab === 'ledgers' && (
      <LedgersScreen
        activeLedgerId={activeLedgerId}
        onSelect={(id) => {
          setActiveLedgerId(id)
          setSetting('activeLedgerId', id)
          setTab('transactions')
        }}
      />
    )}
  </div>
  <BottomNav active={tab} onChange={setTab} />
</>
```

---

## Step 3 — `src/components/SetupScreen.jsx`

Add "Ledger Name" text input (autofocused, default `"Default"`, above Opening Balance).

On submit: `addLedger({ id: newId(), name, openingBalance: amount, setupDate: today(), createdAt: Date.now() })` then `setSetting('activeLedgerId', ledger.id)`. Remove old `setSetting('openingBalance')` and `setSetting('setupDate')` calls.

---

## Step 4 — `src/components/BottomNav.jsx`

Replace the two existing tabs (Today / History — now unused) with:
- **Transactions** tab: list icon
- **Ledgers** tab: book/layers icon

Tab keys: `'transactions'` and `'ledgers'`.

---

## Step 5 — NEW `src/components/LedgersScreen.jsx` + `.module.css`

Props: `activeLedgerId`, `onSelect(id)`

On mount: `getAllLedgers()` + `getLedgerCurrentBalance(id)` for each.

Layout:
```
┌─────────────────────────────┐
│  DAYBOOK             [+ New]│
├─────────────────────────────┤
│  ┌─────────────────────────┐│
│  │ ● Default         [›]   ││  ← ● = active indicator
│  │   1,23,456.78           ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │   Savings         [›]   ││
│  │   45,000.00             ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

- Tapping a card: `onSelect(ledger.id)` (switches to Transactions tab with that ledger active)
- Long-press card (500ms): open `LedgerSheet` in edit mode
- `[+ New]`: open `LedgerSheet` in create mode
- Active ledger indicated by accent dot or highlighted card border

After create/edit/delete: reload ledger list.

---

## Step 6 — NEW `src/components/LedgerSheet.jsx` + `.module.css`

Single bottom sheet for create and edit (mirrors `AddTransaction` style).

Props: `ledger` (null = create mode), `onClose`, `onSaved`

Fields: Name (text, autofocused), Opening Balance (number)

- **Create mode**: "Create Ledger" button → `addLedger(...)` → `onSaved()`
- **Edit mode**: "Save Changes" button → `updateLedger(...)` → `onSaved()`; Delete section with two-step confirm (same pattern as `AddTransaction`) → `deleteLedger(id)` → `onSaved()`
- **Delete active ledger**: after delete, `onSaved()` triggers LedgersScreen reload; App auto-selects first remaining ledger if active was deleted (handle in `onSelect` callback by checking remaining ledgers)

---

## Step 7 — `src/components/MainScreen.jsx`

Add `ledgerId` prop.

**Header**: fetch `getLedger(ledgerId)` on mount/ledgerId change; show ledger name in header.

**All DB calls gain `ledgerId`:**
- `getAllDatesWithTransactions(ledgerId)`
- `getTransactionsForDate(date, ledgerId)`
- `getOpeningBalancesForDates(inRange, ledgerId)`

Pass `ledgerId` to `AddTransaction`. Pass `ledgerName` to `EmailSheet`.

Re-run `load()` when `ledgerId` changes (add to `useCallback` deps).

---

## Step 8 — `src/components/AddTransaction.jsx`

Add `ledgerId` prop. On mount, load `getAllLedgers()` into state.

Add ledger picker above Date field (styled like the credit/debit toggle — a select or segmented control):
```jsx
<select value={txLedgerId} onChange={e => setTxLedgerId(e.target.value)}>
  {allLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
</select>
```

State: `const [txLedgerId, setTxLedgerId] = useState(ledgerId)`

On `addTransaction`: include `ledgerId: txLedgerId`.
On `updateTransaction`: `{ ...transaction, ... }` already preserves existing `ledgerId`.

---

## Step 9 — `src/components/EmailSheet.jsx`

Add `ledgerName` prop. Include in POST body: `{ to, groups, fromDate, toDate, ledgerName }`.

---

## Step 10 — `src/utils.js`

`generatePrintReport` options: add `ledgerName = ''`. Render in report header as `<span>Ledger: ${ledgerName}</span>` when present.

---

## Step 11 — `api/send-report.js`

Destructure `ledgerName` from body. Pass to `generatePrintReport` and `generatePDF`. Update:
- PDF title: `${ledgerName} — Daybook Report`
- Email subject: `Daybook Report — ${ledgerName}`
- Filename: `daybook-${ledgerName}-${fromDate}-to-${toDate}.pdf`

---

## Files Summary

| File | Action |
|---|---|
| `src/db.js` | Modify — schema v2, migration, ledger CRUD, scoped tx functions |
| `src/App.jsx` | Modify — tab state + activeLedgerId, SetupScreen fallback, persist active ledger |
| `src/components/BottomNav.jsx` | Modify — swap tabs for Transactions/Ledgers |
| `src/components/SetupScreen.jsx` | Modify — name field, addLedger instead of setSetting |
| `src/components/MainScreen.jsx` | Modify — ledgerId prop, scoped DB calls, ledger name in header |
| `src/components/AddTransaction.jsx` | Modify — ledgerId prop, ledger picker, stamp on new txs |
| `src/components/EmailSheet.jsx` | Modify — ledgerName prop |
| `src/utils.js` | Modify — ledgerName in report header |
| `api/send-report.js` | Modify — ledgerName in PDF/email/filename |
| `src/components/LedgersScreen.jsx` | **New** |
| `src/components/LedgersScreen.module.css` | **New** |
| `src/components/LedgerSheet.jsx` | **New** |
| `src/components/LedgerSheet.module.css` | **New** |

Unchanged: `TransactionList.jsx`, `main.jsx`, build config.

---

## Implementation Order
1. `db.js` — foundation
2. `App.jsx` + `BottomNav.jsx` — navigation skeleton
3. `SetupScreen.jsx` — fresh-install flow
4. `LedgersScreen` + `LedgerSheet` — ledger CRUD
5. `MainScreen.jsx` — ledger-scoped transactions
6. `AddTransaction.jsx` — ledger picker
7. `EmailSheet` + `utils.js` + `api/send-report.js` — scoped reports

---

## Verification
- Fresh install: Setup → create first ledger (with name) → Transactions tab shows it
- Existing user: On upgrade, Default ledger appears with all prior transactions and correct balance; last-used ledger restored
- Ledgers tab: shows all ledgers with current balance, active ledger highlighted; create/edit/delete all work
- Tapping a ledger in Ledgers tab: switches to Transactions tab showing that ledger
- Add transaction: ledger picker defaults to active, can switch; transaction saved to selected ledger
- Delete ledger: all its transactions gone, other ledgers unaffected; if active was deleted, first remaining becomes active
- Email report: subject, PDF title, and filename include ledger name
