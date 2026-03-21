import { test, expect } from '@playwright/test'
import { createLedgerAndGoToMain } from './helpers.js'

// ── CUJ 1: First-time setup ─────────────────────────────────────────────────

test('CUJ 1: first-time setup creates ledger and shows main screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Your daily cash ledger')).toBeVisible()

  await page.getByPlaceholder('Cash').fill('Savings')
  await page.getByPlaceholder('0.00').fill('5000')
  await page.getByRole('button', { name: 'Get Started' }).click()

  await expect(page.getByText('Savings')).toBeVisible()
  await expect(page.getByLabel('Add transaction')).toBeVisible()
})

// ── CUJ 2: Add credit transaction ───────────────────────────────────────────

test('CUJ 2: add credit transaction appears in list and increases closing balance', async ({ page }) => {
  await createLedgerAndGoToMain(page, { balance: '1000' })

  await page.getByLabel('Add transaction').click()
  await page.getByPlaceholder('What is this for?').fill('Sales income')
  await page.getByPlaceholder('0.00').fill('500')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Sales income')).toBeVisible()
  await expect(page.getByText('1,500.00')).toBeVisible() // closing balance
})

// ── CUJ 3: Add debit transaction ─────────────────────────────────────────────

test('CUJ 3: add debit transaction appears in list and decreases closing balance', async ({ page }) => {
  await createLedgerAndGoToMain(page, { balance: '1000' })

  await page.getByLabel('Add transaction').click()
  await page.getByRole('button', { name: '+' }).click() // toggle to −
  await page.getByPlaceholder('What is this for?').fill('Rent')
  await page.getByPlaceholder('0.00').fill('300')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Rent')).toBeVisible()
  await expect(page.getByText('700.00')).toBeVisible() // closing balance
})

// ── CUJ 4: Edit transaction ──────────────────────────────────────────────────

test('CUJ 4: editing a transaction recalculates the closing balance', async ({ page }) => {
  await createLedgerAndGoToMain(page, { balance: '1000' })

  // Add a transaction
  await page.getByLabel('Add transaction').click()
  await page.getByPlaceholder('What is this for?').fill('Old entry')
  await page.getByPlaceholder('0.00').fill('200')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Old entry')).toBeVisible()

  // Right-click to edit
  await page.getByText('Old entry').click({ button: 'right' })
  await expect(page.getByText('Edit Transaction')).toBeVisible()
  await page.getByPlaceholder('0.00').fill('800')
  await page.getByRole('button', { name: 'Update' }).click()

  await expect(page.getByText('1,800.00')).toBeVisible() // closing balance
})

// ── CUJ 5: Delete transaction ────────────────────────────────────────────────

test('CUJ 5: deleting a transaction removes it from the list', async ({ page }) => {
  await createLedgerAndGoToMain(page, { balance: '1000' })

  // Add a transaction
  await page.getByLabel('Add transaction').click()
  await page.getByPlaceholder('What is this for?').fill('To delete')
  await page.getByPlaceholder('0.00').fill('400')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('To delete')).toBeVisible()

  // Right-click → delete
  await page.getByText('To delete').click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete transaction' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText('To delete')).not.toBeVisible()
})

// ── CUJ 6: Tab navigation ────────────────────────────────────────────────────

test('CUJ 6: switching between Transactions and Ledgers tabs works', async ({ page }) => {
  await createLedgerAndGoToMain(page)

  // Switch to Ledgers tab
  await page.getByRole('button', { name: 'Ledgers' }).click()
  await expect(page.getByText('Cash')).toBeVisible()

  // Switch back to Transactions
  await page.getByRole('button', { name: 'Transactions' }).click()
  await expect(page.getByLabel('Add transaction')).toBeVisible()
})

// ── CUJ 7: Email report ──────────────────────────────────────────────────────

test('CUJ 7: email report sheet sends and shows success state', async ({ page }) => {
  await createLedgerAndGoToMain(page, { balance: '1000' })

  // Add a transaction so the email button is enabled
  await page.getByLabel('Add transaction').click()
  await page.getByPlaceholder('What is this for?').fill('Sale')
  await page.getByPlaceholder('0.00').fill('100')
  await page.getByRole('button', { name: 'Save' }).click()

  // Intercept the API — no real SMTP needed
  await page.route('/api/send-report', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  )

  await page.getByLabel('Email report').click()
  await page.getByPlaceholder('you@example.com').fill('test@example.com')
  await page.getByRole('button', { name: 'Send Report' }).click()

  await expect(page.getByText('Report sent to')).toBeVisible()
  await expect(page.getByText('test@example.com')).toBeVisible()
})
