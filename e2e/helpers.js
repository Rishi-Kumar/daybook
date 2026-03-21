/**
 * Handles the first-time setup screen and lands on the main transactions view.
 */
export async function createLedgerAndGoToMain(page, { name = 'Cash', balance = '1000' } = {}) {
  await page.goto('/')
  await page.getByPlaceholder('Cash').fill(name)
  await page.getByPlaceholder('0.00').fill(balance)
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.waitForSelector('text=Transactions')
}

/**
 * Opens the Add Transaction sheet, fills it in, and saves.
 */
export async function addTransaction(page, { particulars, amount, debit = false } = {}) {
  await page.getByLabel('Add transaction').click()
  if (debit) await page.getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('What is this for?').fill(particulars)
  await page.getByPlaceholder('0.00').fill(amount)
  await page.getByRole('button', { name: debit ? 'Save' : 'Save' }).click()
}
