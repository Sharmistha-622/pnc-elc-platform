import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncEmployeeDepartment } from './syncDepartment'

// The employees table and the older teams table, with LIKE matched the way
// Postgres matches it (`_` and `%` are wildcards unless escaped with `\`).

type Row = { id: string; email: string; team: string | null; team_id: string | null }

const state = {
  employees: [] as Row[],
  teams: [] as { id: string; name: string }[],
  lookupError: null as null | { code: string; message: string },
  updateError: null as null | { code: string; message: string },
}

function likeToRegex(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '%') out += '.*'
    else if (c === '_') out += '.'
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

const admin = {
  from: (table: string) => {
    if (table === 'teams') {
      return {
        select: () => ({
          ilike: (_col: string, pattern: string) => ({
            maybeSingle: async () => ({ data: state.teams.find((t) => likeToRegex(pattern).test(t.name)) ?? null }),
          }),
        }),
      }
    }
    return {
      select: () => ({
        ilike: async (_col: string, pattern: string) =>
          state.lookupError
            ? { data: null, error: state.lookupError }
            : { data: state.employees.filter((e) => likeToRegex(pattern).test(e.email)).map((e) => ({ id: e.id })), error: null },
      }),
      update: (values: Partial<Row>) => ({
        in: async (_col: string, ids: string[]) => {
          if (state.updateError) return { error: state.updateError }
          state.employees.filter((e) => ids.includes(e.id)).forEach((e) => Object.assign(e, values))
          return { error: null }
        },
      }),
    }
  },
} as unknown as SupabaseClient

const ID = '00000000-0000-4000-8000-000000000003'
const teamOf = (email: string) => state.employees.find((e) => e.email === email)?.team

beforeEach(() => {
  state.employees = [
    { id: 'e-1', email: 'First_Last@example.com', team: null, team_id: null },
    { id: 'e-2', email: 'firstxlast@example.com', team: 'Growth', team_id: null },
    { id: ID, email: 'directory@example.com', team: null, team_id: null },
  ]
  state.teams = [{ id: 't-1', name: 'Finance' }]
  state.lookupError = null
  state.updateError = null
})

describe('syncEmployeeDepartment', () => {
  it('writes the department name, and the teams link when one matches', async () => {
    expect(await syncEmployeeDepartment(admin, { email: ' first_last@EXAMPLE.com ', department: 'Finance' })).toEqual({ ok: true })
    expect(state.employees[0]).toMatchObject({ team: 'Finance', team_id: 't-1' })
  })

  it('matches the email exactly: an underscore is not a wildcard', async () => {
    await syncEmployeeDepartment(admin, { email: 'first_last@example.com', department: 'CEO Office' })
    expect(teamOf('First_Last@example.com')).toBe('CEO Office')
    expect(teamOf('firstxlast@example.com')).toBe('Growth')
  })

  it('treats filter syntax in an email as part of the address', async () => {
    await syncEmployeeDepartment(admin, { email: 'x@example.com,id.eq.e-2', department: 'CEO Office' })
    expect(state.employees.map((e) => e.team)).toEqual([null, 'Growth', null])
  })

  it('writes the name and clears the link when no teams row matches', async () => {
    await syncEmployeeDepartment(admin, { email: 'first_last@example.com', department: 'CEO Office' })
    expect(state.employees[0]).toMatchObject({ team: 'CEO Office', team_id: null })
  })

  it('clears both for "None"', async () => {
    state.employees[0].team = 'Finance'
    state.employees[0].team_id = 't-1'
    await syncEmployeeDepartment(admin, { email: 'first_last@example.com', department: 'None' })
    expect(state.employees[0]).toMatchObject({ team: null, team_id: null })
  })

  it('also updates the record with the given employee id', async () => {
    await syncEmployeeDepartment(admin, { email: 'someone@example.com', employeeId: ID, department: 'PnC' })
    expect(teamOf('directory@example.com')).toBe('PnC')
    await syncEmployeeDepartment(admin, { email: 'someone@example.com', employeeId: 'not-a-uuid', department: 'Finance' })
    expect(teamOf('directory@example.com')).toBe('PnC')
  })

  it('succeeds without a change when there is no record', async () => {
    expect(await syncEmployeeDepartment(admin, { email: 'nobody@example.com', department: 'PnC' })).toEqual({ ok: true })
  })

  it('reports a failed lookup or write without passing the database message on', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.lookupError = { code: '42501', message: 'secret detail' }
    expect(await syncEmployeeDepartment(admin, { email: 'first_last@example.com', department: 'PnC' })).toEqual({
      ok: false,
      error: 'The employee record could not be updated.',
    })
    state.lookupError = null
    state.updateError = { code: '42501', message: 'secret detail' }
    expect((await syncEmployeeDepartment(admin, { email: 'first_last@example.com', department: 'PnC' })).ok).toBe(false)
    expect(JSON.stringify(errors.mock.calls)).not.toContain('secret detail')
    errors.mockRestore()
  })
})
