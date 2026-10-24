import { describe, it, expect } from 'vitest'
import { addDays, istToday, monthWindow } from './dates'

describe('istToday', () => {
  it('is already tomorrow in India before UTC midnight', () => {
    // 20:00 UTC on 31 Oct is 01:30 IST on 1 Nov.
    expect(istToday(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-01')
  })

  it('agrees with UTC once both sides of midnight have passed', () => {
    expect(istToday(new Date('2026-10-31T10:00:00Z'))).toBe('2026-10-31')
  })
})

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08')
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
  })
})

describe('monthWindow', () => {
  it('runs from the 1st to the next 1st', () => {
    expect(monthWindow('2026-10-24')).toEqual({ from: '2026-10-01', to: '2026-11-01' })
  })

  it('rolls December into January', () => {
    expect(monthWindow('2026-12-31')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })
})
