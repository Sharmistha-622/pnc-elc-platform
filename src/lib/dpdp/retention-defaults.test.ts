import { describe, it, expect } from 'vitest'
import { RETENTION_DEFAULTS } from './retention-defaults'
import { DELETE_FLOOR_DAYS, GRIEVANCE_MAX_DAYS, STATUTORY_FLOORS, statutoryFloorDays } from './constants'
import { RETENTION_RULE_IDS } from './types'

describe('retention defaults', () => {
  it('seed every rule exactly once', () => {
    expect(RETENTION_DEFAULTS.map((r) => r.id).sort()).toEqual([...RETENTION_RULE_IDS].sort())
  })

  it('never seed a period below its statutory floor', () => {
    for (const r of RETENTION_DEFAULTS) {
      expect(r.floorDays, r.id).toBe(statutoryFloorDays(r.id))
      if (r.periodDays !== null) expect(r.periodDays, r.id).toBeGreaterThanOrEqual(r.floorDays)
    }
  })

  it('pin the statutory floors from the brief', () => {
    expect(STATUTORY_FLOORS.logs?.value).toBe(365)
    expect(STATUTORY_FLOORS.statutory_registers?.value).toBe(1825)
    expect(STATUTORY_FLOORS.social_security_registers?.value).toBe(1825)
    expect(STATUTORY_FLOORS.payroll_tax?.value).toBe(2190)
  })

  it('leave POSH files to counsel', () => {
    const posh = RETENTION_DEFAULTS.find((r) => r.id === 'posh_case_files')!
    expect(posh.periodDays).toBeNull()
    expect(posh.action).toBe('report_only')
  })

  it('keep the locked legal values', () => {
    expect(DELETE_FLOOR_DAYS.value).toBe(365)
    expect(GRIEVANCE_MAX_DAYS.value).toBe(90)
  })
})
