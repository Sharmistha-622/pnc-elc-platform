import { describe, it, expect } from 'vitest'
import { departmentOf } from './department'

describe('departmentOf', () => {
  it('reads the department name on the employee record', () => {
    expect(departmentOf({ team: 'CEO Office', teams: null })).toBe('CEO Office')
  })

  it('prefers it over the older teams link', () => {
    expect(departmentOf({ team: 'Finance', teams: { name: 'Accounts' } })).toBe('Finance')
  })

  it('falls back to the teams link for records written before team was', () => {
    expect(departmentOf({ team: null, teams: { name: 'Tech & Product' } })).toBe('Tech & Product')
    expect(departmentOf({ team: '', teams: [{ name: 'Growth' }] })).toBe('Growth')
  })

  it('treats empty, blank and "None" as no department', () => {
    expect(departmentOf({ team: '  ', teams: null })).toBeNull()
    expect(departmentOf({ team: 'None' })).toBeNull()
    expect(departmentOf({})).toBeNull()
    expect(departmentOf(null)).toBeNull()
  })
})
