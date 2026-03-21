import { formatCurrency, formatDateLong, formatDateDMY, formatMonthEnd, toDateStr } from '../../src/utils.js'

describe('formatCurrency', () => {
  it('formats a positive integer with 2 decimal places', () => {
    expect(formatCurrency(1000)).toBe('1,000.00')
  })

  it('formats a decimal amount', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('0.00')
  })

  it('formats a negative amount (debit)', () => {
    expect(formatCurrency(-500)).toBe('-500.00')
  })
})

describe('formatDateDMY', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDateDMY('2026-03-21')).toBe('21/03/2026')
  })

  it('preserves zero-padding', () => {
    expect(formatDateDMY('2026-01-05')).toBe('05/01/2026')
  })
})

describe('formatMonthEnd', () => {
  it('returns "End of MMM YYYY" from a date string', () => {
    expect(formatMonthEnd('2026-02-28')).toBe('End of Feb 2026')
  })

  it('works for any day in the month', () => {
    expect(formatMonthEnd('2026-03-10')).toBe('End of Mar 2026')
  })
})

describe('toDateStr', () => {
  it('formats a date object as YYYY-MM-DD', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('zero-pads month and day', () => {
    expect(toDateStr(new Date(2026, 8, 3))).toBe('2026-09-03')
  })
})

describe('formatDateLong', () => {
  it('returns a human-readable date string', () => {
    const result = formatDateLong('2026-03-21')
    expect(result).toContain('2026')
    expect(result).toContain('Mar')
  })
})
