# Migration Plan: Server-Side Data + Google Auth (Supabase)

## Overview

Move Daybook from local-only IndexedDB to Supabase (Postgres + Google OAuth). Any Google account can sign in and gets its own isolated data. Data syncs across devices and is backed up server-side. Always-online — no offline support needed. No local data migration; users start fresh on first sign-in.

**Stack change:** Add `@supabase/supabase-js`, remove `idb`. Stay on Vite + Vercel.

---

## Phase 0: Manual Supabase Setup (before writing any code)

1. Create Supabase project → note **Project URL**, **anon key**, **service role key**
2. Authentication > Providers > enable Google → create Google Cloud OAuth 2.0 credentials (Web application type) → paste Client ID + Secret into Supabase
3. Authentication > URL Configuration → add allowed redirect URLs:
   - `https://daybook-lyart.vercel.app`
   - `https://daybook-dev.vercel.app`
   - `http://localhost:5174`
4. Run the SQL schema below in Supabase SQL Editor

---

## Database Schema

```sql
create table ledgers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  opening_balance numeric(15,2) not null default 0,
  setup_date      date not null,
  created_at      bigint not null  -- Unix ms
);
alter table ledgers enable row level security;
create policy "Users own their ledgers" on ledgers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  ledger_id    uuid not null references ledgers(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('credit', 'debit')),
  amount       numeric(15,2) not null,  -- positive = credit, negative = debit
  particulars  text not null default '',
  created_at   bigint not null  -- Unix ms, used for within-day sort order
);
create index transactions_user_ledger_date on transactions(user_id, ledger_id, date);
alter table transactions enable row level security;
create policy "Users own their transactions" on transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key     text not null,
  value   text,
  primary key (user_id, key)
);
alter table user_settings enable row level security;
create policy "Users own their settings" on user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Design notes:
- `user_id` on `transactions` directly (not inherited via ledger join) → RLS evaluated with single-column equality, no join needed
- `ON DELETE CASCADE` on both tables → `deleteLedger()` is a single DELETE, Postgres handles cascade
- `created_at` as `bigint` (Unix ms) → preserves existing sort semantics
- `numeric` columns returned as JS strings by Supabase client → wrap in `Number()` on the way out via `fromRow()`

---

## Environment Variables

| Variable | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Client + Vercel | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Client + Vercel | Public key, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only) | Never expose to client |

Add all three to `.env.local` (gitignored) for local dev. Add to both Vercel environments (`dev` and `main`). `GMAIL_*` vars unchanged.

---

## Files Changed

### New files

**`src/supabase.js`** — Supabase client singleton. The client auto-attaches the session JWT to every request, so no manual token passing is needed within the app.

**`src/components/AuthScreen.jsx`** — Google sign-in screen shown when `session === null`. Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.

### Modified files

**`src/db.js`** — Full rewrite. Same exported function signatures so no component call sites change.
- All IndexedDB/`idb` code removed
- Each function maps to a Supabase query (see table below)
- `toRow(obj)` / `fromRow(row)` helpers handle camelCase ↔ snake_case and `Number()` wrapping
- `calcClosing` unchanged (pure function)
- `getAllLedgersGroupsForRange` refactored to use a single SQL query instead of N per-ledger queries; grouping logic extracted to a shared helper in `src/utils.js` so `send-report.js` can reuse it

| db.js function | Supabase operation |
|---|---|
| `getSetting(key)` | SELECT from `user_settings` WHERE key |
| `setSetting(key, value)` | UPSERT `user_settings` |
| `getAllLedgers()` | SELECT all ledgers ORDER BY created_at |
| `getLedger(id)` | SELECT ledger by id |
| `addLedger(ledger)` | INSERT ledger (client generates UUID) |
| `updateLedger(ledger)` | UPDATE ledger by id |
| `deleteLedger(id)` | DELETE ledger by id (cascade handles transactions) |
| `getLedgerCurrentBalance(id)` | Fetch ledger + all transactions → JS `calcClosing` |
| `addTransaction(tx)` | INSERT transaction |
| `updateTransaction(tx)` | UPDATE transaction by id |
| `deleteTransaction(id)` | DELETE transaction by id |
| `getTransactionsForDate(date, lid)` | SELECT WHERE ledger_id AND date → sort credits-first in JS |
| `getAllDatesWithTransactions(lid)` | SELECT DISTINCT date WHERE ledger_id ORDER BY date DESC |
| `getOpeningBalance(date, lid)` | Fetch all transactions with date < target → cumulative JS reduce |
| `getOpeningBalancesForDates(dates, lid)` | Same fetch → single-pass batch reduce (same algorithm as current) |
| `getAllLedgersGroupsForRange(from, to)` | One query: transactions + ledger join in date range → JS grouping via shared util |

**`src/App.jsx`** — Replace `useEffect init()` with `supabase.auth.onAuthStateChange`:
- New state: `session` (`undefined` = loading, `null` = unauthenticated, object = authenticated)
- `session === undefined` → return null (loading)
- `session === null` → `<AuthScreen />`
- `session` is an object → run existing ledger init logic (unchanged)
- All existing handlers (`handleSelectLedger`, `handleActiveLedgerDeleted`, etc.) unchanged
- Add sign-out button in header calling `supabase.auth.signOut()`

**`src/components/EmailSheet.jsx`** — Two changes:
1. Remove `getAllLedgersGroupsForRange` import (server fetches data now)
2. Add `Authorization: Bearer <token>` header to the POST; send only `{ to, fromDate, toDate }` (no `ledgers` in body)

**`api/send-report.js`** — Three changes:
1. Verify bearer token via Supabase service role client: `supabaseAdmin.auth.getUser(token)`
2. Fetch ledger + transaction data from Supabase for the authenticated user
3. Use shared `buildLedgerGroups(ledgers, transactions)` util to build the groups structure the existing PDF renderer expects (no changes to PDF generation code)

**`package.json`** — Add `@supabase/supabase-js`, remove `idb`

### Unchanged files
`AddTransaction.jsx`, `LedgerSheet.jsx`, `SetupScreen.jsx`, `MainScreen.jsx`, `LedgersScreen.jsx`, `TransactionList.jsx`, `BottomNav.jsx` — all import from `db.js` with unchanged function signatures.

---

## Implementation Order

1. Supabase dashboard setup + SQL schema (Phase 0)
2. Add env vars to `.env.local` and Vercel dashboard
3. `npm install @supabase/supabase-js && npm uninstall idb`
4. Create `src/supabase.js`
5. Rewrite `src/db.js` — test each function group via browser console
6. Create `AuthScreen.jsx`, wire `onAuthStateChange` into `App.jsx` → verify Google sign-in end-to-end
7. Verify `SetupScreen` → ledger visible in Supabase dashboard
8. Verify transaction add / edit / delete round-trip
9. Extract `buildLedgerGroups` to `src/utils.js`
10. Update `EmailSheet.jsx` + `api/send-report.js` → test email report

---

## Verification Checklist

- [ ] Sign in with Google → redirected back, session established, `SetupScreen` shown for new user
- [ ] Create ledger → visible in Supabase `ledgers` table with correct `user_id`
- [ ] Add / edit / delete transactions → reflected in `transactions` table
- [ ] Sign out → `AuthScreen` shown; signing back in restores data
- [ ] Open app on a second device → same data visible after sign-in (sync works)
- [ ] Send email report → PDF received with correct data (server-fetched, not client-sent)
- [ ] RLS: querying with a different user's JWT returns 0 rows
