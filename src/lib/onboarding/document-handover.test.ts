import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ uploads: [] as string[], folders: [] as string[][] }))

function table(name: string) {
  const q: Record<string, unknown> = {}
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    update: () => q,
    insert: async () => ({ error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => void) =>
      resolve(
        name === 'document_types'
          ? {
              data: [
                { name: 'aadhaar', display_name: 'Aadhaar Card', destination: 'verification_docs' },
                { name: 'bank_proof', display_name: 'Bank Account Proof', destination: 'verification_docs' },
                { name: 'resume', display_name: 'Resume / CV', destination: 'verification_docs' },
              ],
              error: null,
            }
          : { data: null, error: null },
      ),
  })
  return q
}

vi.mock('./db', () => ({
  onboardingDb: () => ({
    from: table,
    storage: { from: () => ({ download: async () => ({ data: new Blob(['file']), error: null }) }) },
  }),
}))
vi.mock('@/lib/dpdp/portal', () => ({ getDriveCopyTypes: async () => ['resume', 'aadhaar'] }))
vi.mock('@/lib/documents/drive', () => ({
  findOrCreatePath: async (path: string[]) => {
    state.folders.push(path)
    return 'folder-1'
  },
  uploadFile: async ({ name }: { name: string }) => {
    state.uploads.push(name)
    return { url: 'https://drive.example.com/file' }
  },
}))

import { carryDocumentsToEmployee } from './document-handover'
import type { OnboardingDocument } from './types'

const doc = (key: string): OnboardingDocument =>
  ({ id: key, document_type: key, document_type_key: key, status: 'verified', storage_reference: `r/${key}.pdf`, file_name: `${key}.pdf` }) as unknown as OnboardingDocument

beforeEach(() => {
  state.uploads = []
  state.folders = []
})

describe('carryDocumentsToEmployee', () => {
  it('copies allowed types to the employee folder, and never an identity or bank document', async () => {
    const result = await carryDocumentsToEmployee([doc('aadhaar'), doc('bank_proof'), doc('resume')], { id: '00000000-aaaa', name: 'Asha Example' })
    expect(result.carried).toBe(3)
    expect(result.copiedToDrive).toBe(1)
    expect(state.uploads).toHaveLength(1)
    expect(state.uploads[0]).toMatch(/Resume/)
    expect(state.folders).toEqual([['Team Member', 'Asha Example (00000000)']])
  })
})
