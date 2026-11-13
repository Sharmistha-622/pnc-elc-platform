import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGuard,
  mockGetCurrentEmployee,
  mockCreateServerSupabaseClient,
  mockProfileUpdated,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockGetCurrentEmployee: vi.fn(),
  mockCreateServerSupabaseClient: vi.fn(),
  mockProfileUpdated: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/rbac/guard', () => ({
  guard: mockGuard,
  guardResource: vi.fn(),
}))

vi.mock('@/lib/forms/currentEmployee', () => ({
  getCurrentEmployee: mockGetCurrentEmployee,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}))

vi.mock('@/lib/audit/events', () => ({
  auditEmployee: {
    profileUpdated: mockProfileUpdated,
  },
}))

import { updateMyContactDetails } from './profileActions'

describe('updateMyContactDetails', () => {
  const existingRow = {
    first_name: 'Asha',
    last_name: 'Verma',
    contact_number: '+91 90000 11111',
    permanent_address: '10 Permanent Lane, Pune',
    mailing_address: '12 Old Street, Bengaluru',
    mailing_address_same: false,
    emergency_contact_name: 'Rohan Verma',
    emergency_contact_number: '+91 90000 22222',
    emergency_contact_relation: 'Sibling',
  }

  let upsertSpy: ReturnType<typeof vi.fn>
  let eqSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockGuard.mockResolvedValue({
      ok: true,
      caller: {
        userId: 'user-own',
        role: 'employee',
        originalRole: 'employee',
      },
    })

    mockGetCurrentEmployee.mockResolvedValue({
      employee: {
        id: 'emp-own-111',
        name: 'Asha Verma',
        email: 'asha@example.org',
      },
    })

    upsertSpy = vi.fn().mockResolvedValue({ error: null })
    eqSpy = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
    })

    mockCreateServerSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: eqSpy,
        })),
        upsert: upsertSpy,
      })),
    })
  })

  it('updates the caller own phone, current address and emergency contact and logs old/new in metadata only', async () => {
    const res = await updateMyContactDetails({
      phone: '+91 98888 77777',
      currentAddress: '44 New Road, Mumbai',
      emergencyContactName: 'Meera Verma',
      emergencyContactPhone: '+91 98888 66666',
      emergencyContactRelation: 'Parent',
    })

    expect(res.success).toBe(true)
    expect(mockGuard).toHaveBeenCalledWith('self')
    expect(eqSpy).toHaveBeenCalledWith('employee_id', 'emp-own-111')
    expect(upsertSpy).toHaveBeenCalledTimes(1)

    const [savedPayload, options] = upsertSpy.mock.calls[0]
    expect(options).toEqual({ onConflict: 'employee_id' })
    expect(savedPayload).toMatchObject({
      employee_id: 'emp-own-111',
      first_name: 'Asha',
      last_name: 'Verma',
      contact_number: '+91 98888 77777',
      mailing_address: '44 New Road, Mumbai',
      mailing_address_same: false,
      emergency_contact_name: 'Meera Verma',
      emergency_contact_number: '+91 98888 66666',
      emergency_contact_relation: 'Parent',
    })

    expect(mockProfileUpdated).toHaveBeenCalledTimes(1)
    const auditArg = mockProfileUpdated.mock.calls[0][0]
    expect(auditArg.summary).toBe('Employee updated their own contact details.')
    expect(auditArg.summary).not.toContain('98888')
    expect(auditArg.summary).not.toContain('Mumbai')
    expect(auditArg.metadata).toEqual({
      fields: {
        contact_number: {
          old: '+91 90000 11111',
          new: '+91 98888 77777',
        },
        mailing_address: {
          old: '12 Old Street, Bengaluru',
          new: '44 New Road, Mumbai',
        },
        emergency_contact_name: {
          old: 'Rohan Verma',
          new: 'Meera Verma',
        },
        emergency_contact_number: {
          old: '+91 90000 22222',
          new: '+91 98888 66666',
        },
        emergency_contact_relation: {
          old: 'Sibling',
          new: 'Parent',
        },
      },
    })
  })

  it('ignores any browser-supplied employee id and never updates another person record', async () => {
    const res = await updateMyContactDetails({
      id: 'emp-other-999',
      employeeId: 'emp-other-999',
      employee_id: 'emp-other-999',
      phone: '+91 91111 22222',
    })

    expect(res.success).toBe(true)
    expect(eqSpy).toHaveBeenCalledWith('employee_id', 'emp-own-111')
    const [savedPayload] = upsertSpy.mock.calls[0]
    expect(savedPayload.employee_id).toBe('emp-own-111')
    expect(savedPayload.employee_id).not.toBe('emp-other-999')
  })

  it('ignores ID-number and bank fields sent by the browser', async () => {
    const res = await updateMyContactDetails({
      phone: '+91 93333 44444',
      idProofNumber: 'XXXX-XXXX-1234',
      id_proof_number: 'XXXX-XXXX-1234',
      addressProofNumber: 'DL-999999',
      address_proof_number: 'DL-999999',
      bankAccountNumber: '000111222333',
      ifsc: 'HDFC0000123',
      permanentAddress: 'Attempted Permanent Address Overwrite',
      permanent_address: 'Attempted Permanent Address Overwrite',
    })

    expect(res.success).toBe(true)
    const [savedPayload] = upsertSpy.mock.calls[0]
    expect(savedPayload).not.toHaveProperty('id_proof_number')
    expect(savedPayload).not.toHaveProperty('idProofNumber')
    expect(savedPayload).not.toHaveProperty('address_proof_number')
    expect(savedPayload).not.toHaveProperty('addressProofNumber')
    expect(savedPayload).not.toHaveProperty('bankAccountNumber')
    expect(savedPayload).not.toHaveProperty('ifsc')
    expect(savedPayload).not.toHaveProperty('permanent_address')
    expect(savedPayload).not.toHaveProperty('permanentAddress')
  })

  it('refuses callers rejected by guard(self)', async () => {
    mockGuard.mockResolvedValueOnce({
      ok: false,
      error: 'You do not have access to do that.',
    })

    const res = await updateMyContactDetails({
      phone: '+91 98888 77777',
    })

    expect(res).toEqual({
      success: false,
      error: 'You do not have access to do that.',
    })
    expect(upsertSpy).not.toHaveBeenCalled()
    expect(mockProfileUpdated).not.toHaveBeenCalled()
  })
})
