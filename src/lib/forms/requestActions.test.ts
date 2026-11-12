import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  guardOk: true,
  employee: {
    id: 'emp-1',
    name: 'Ananya Sen',
    email: 'ananya.sen@example.org' as string | null,
  },
  insertedRequests: [] as Record<string, unknown>[],
  sentEmails: [] as { template: string; data: Record<string, string>; to: string }[],
  redirectTo: null as string | null,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    state.redirectTo = url
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () =>
    state.guardOk
      ? { ok: true, caller: { userId: 'u-1', email: 'admin@example.org', role: 'pnc_admin' } }
      : { ok: false, error: 'Forbidden' }
  ),
}))

function makeDb() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'u-1' } } }),
    },
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      Object.assign(q, {
        select: () => q,
        eq: () => q,
        in: () => q,
        is: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === 'form_versions') {
            return { data: { id: 'ver-1', status: 'published', form_id: 'form-1' }, error: null }
          }
          if (table === 'forms') {
            return { data: { name: 'Quarterly Pulse Survey', archived_at: null }, error: null }
          }
          if (table === 'employees') {
            return { data: state.employee, error: null }
          }
          return { data: null, error: null }
        },
        insert: async (payload: Record<string, unknown>) => {
          if (table === 'form_requests') state.insertedRequests.push(payload)
          return { error: null }
        },
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      })
      return q
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => makeDb()),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: vi.fn(() => makeDb()),
}))

vi.mock('@/lib/email/sendEmail', () => ({
  escapeHtml: (s: string) => s,
  sendEmail: vi.fn(async (template: string, data: Record<string, string>, to: string) => {
    state.sentEmails.push({ template, data, to })
    return { success: true, messageId: 'msg-form-1' }
  }),
}))

import { createFormRequest } from './requestActions'

function makeFormData(over: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('formId', over.formId ?? 'form-1')
  fd.set('versionId', over.versionId ?? 'ver-1')
  fd.set('respondentId', over.respondentId ?? 'emp-1')
  fd.set('subjectId', over.subjectId ?? '')
  fd.set('expiresInDays', over.expiresInDays ?? '7')
  return fd
}

beforeEach(() => {
  state.guardOk = true
  state.employee = {
    id: 'emp-1',
    name: 'Ananya Sen',
    email: 'ananya.sen@example.org',
  }
  state.insertedRequests.length = 0
  state.sentEmails.length = 0
  state.redirectTo = null
})

describe('createFormRequest ("Send this form", #162)', () => {
  it('sends one form_assigned email linking to My Forms when the person has an email', async () => {
    await expect(createFormRequest(makeFormData())).rejects.toThrow(
      'REDIRECT:/data-management/forms/form-1?sent=1'
    )

    expect(state.insertedRequests).toHaveLength(1)
    const createdId = String(state.insertedRequests[0].id)

    expect(state.sentEmails).toHaveLength(1)
    expect(state.sentEmails[0].template).toBe('form_assigned')
    expect(state.sentEmails[0].to).toBe('ananya.sen@example.org')
    expect(state.sentEmails[0].data.recipient_name).toBe('Ananya Sen')
    expect(state.sentEmails[0].data.form_name).toBe('Quarterly Pulse Survey')
    expect(state.sentEmails[0].data.form_url).toContain(`/my-forms/${createdId}`)
  })

  it('sends no email when the person has no email address', async () => {
    state.employee = {
      id: 'emp-1',
      name: 'Ananya Sen',
      email: null,
    }

    await expect(createFormRequest(makeFormData())).rejects.toThrow(
      'REDIRECT:/data-management/forms/form-1?sent=1'
    )

    expect(state.insertedRequests).toHaveLength(1)
    expect(state.sentEmails).toHaveLength(0)
  })
})
