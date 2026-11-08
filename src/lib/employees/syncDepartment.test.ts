import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncEmployeeDepartment } from './syncDepartment'

function fakeAdmin(opts: { teamId?: string | null; updateError?: { code: string; message: string } | null } = {}) {
  const calls = { update: null as Record<string, unknown> | null, filter: '' }
  const admin = {
    from: (table: string) => {
      if (table === 'teams') {
        return {
          select: () => ({
            ilike: () => ({ maybeSingle: async () => ({ data: opts.teamId ? { id: opts.teamId } : null }) }),
          }),
        }
      }
      return {
        update: (values: Record<string, unknown>) => {
          calls.update = values
          return {
            or: async (filter: string) => {
              calls.filter = filter
              return { error: opts.updateError ?? null }
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient
  return { admin, calls }
}

describe('syncEmployeeDepartment', () => {
  it('writes the department name, and the teams link when one matches', async () => {
    const { admin, calls } = fakeAdmin({ teamId: 't-1' })
    expect(await syncEmployeeDepartment(admin, { email: ' New@Example.com ', department: 'Finance' })).toEqual({ ok: true })
    expect(calls.update).toMatchObject({ team: 'Finance', team_id: 't-1' })
    expect(calls.filter).toBe('email.ilike.new@example.com')
  })

  it('writes the name and clears the link when no teams row matches', async () => {
    const { admin, calls } = fakeAdmin({ teamId: null })
    await syncEmployeeDepartment(admin, { email: 'a@example.com', department: 'CEO Office' })
    expect(calls.update).toMatchObject({ team: 'CEO Office', team_id: null })
  })

  it('clears both for "None"', async () => {
    const { admin, calls } = fakeAdmin({ teamId: 't-1' })
    await syncEmployeeDepartment(admin, { email: 'a@example.com', department: 'None' })
    expect(calls.update).toMatchObject({ team: null, team_id: null })
  })

  it('also matches the employee id when one is given', async () => {
    const { admin, calls } = fakeAdmin()
    const id = '00000000-0000-4000-8000-000000000003'
    await syncEmployeeDepartment(admin, { email: 'a@example.com', employeeId: id, department: 'PnC' })
    expect(calls.filter).toBe(`email.ilike.a@example.com,id.eq.${id}`)
    await syncEmployeeDepartment(admin, { email: 'a@example.com', employeeId: 'not-a-uuid', department: 'PnC' })
    expect(calls.filter).toBe('email.ilike.a@example.com')
  })

  it('reports a failed write without passing the database message on', async () => {
    const { admin } = fakeAdmin({ updateError: { code: '42501', message: 'secret detail' } })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await syncEmployeeDepartment(admin, { email: 'a@example.com', department: 'PnC' })
    expect(result).toEqual({ ok: false, error: 'The employee record could not be updated.' })
    expect(JSON.stringify(errors.mock.calls)).not.toContain('secret detail')
    errors.mockRestore()
  })
})
