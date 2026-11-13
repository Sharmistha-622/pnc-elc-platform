export interface AuthorizedSignatory {
  id: string
  name: string
  designation: string
  email?: string | null
  signature_url?: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by?: string | null
}

export type CreateSignatoryInput = {
  name: string
  designation: string
  email?: string | null
  signature_url?: string | null
  is_default?: boolean
  is_active?: boolean
}

export type UpdateSignatoryInput = Partial<CreateSignatoryInput>

export const DEFAULT_SIGNATORIES: AuthorizedSignatory[] = [
  {
    id: 'sig-1',
    name: 'Signatory One',
    designation: 'People & Culture Lead, NavGurukul',
    email: 'signatory.one@example.org',
    signature_url: null,
    is_default: true,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'system',
  },
  {
    id: 'sig-2',
    name: 'Signatory Two',
    designation: 'People & Culture Lead, NavGurukul',
    email: 'signatory.two@example.org',
    signature_url: null,
    is_default: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'system',
  },
  {
    id: 'sig-3',
    name: 'Signatory Three',
    designation: 'Executive Director, NavGurukul',
    email: 'signatory.three@example.org',
    signature_url: null,
    is_default: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'system',
  },
]
