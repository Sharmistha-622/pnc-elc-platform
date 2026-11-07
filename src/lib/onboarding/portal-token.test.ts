import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

// The invitation token is the candidate's key to their own portal. Staff
// screens address a record by its id, and the link reaches the candidate only
// by email, so no dashboard file names the token and every onboarding API
// response passes through the token redaction.

const ROOT = process.cwd()

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return files(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

describe('the portal link stays with the candidate', () => {
  it('is not named by any dashboard screen', () => {
    const offenders = files(path.join(ROOT, 'src/app/(dashboard)'))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('invitation_token'))
      .map((f) => path.relative(ROOT, f))
    expect(offenders).toEqual([])
  })

  it('is removed from every onboarding API response', () => {
    for (const route of ['src/app/api/onboarding/route.ts', 'src/app/api/onboarding/[id]/route.ts']) {
      const source = fs.readFileSync(path.join(ROOT, route), 'utf8')
      expect(source, route).toMatch(/redactPortalToken|withoutPortalToken/)
    }
  })

  it('is never part of what a signature records', () => {
    const route = fs.readFileSync(path.join(ROOT, 'src/app/api/onboarding/token/[token]/route.ts'), 'utf8')
    expect(route).toContain('buildSignatureMetadata(req.headers')
    expect(route).not.toContain('body.signature_metadata')
  })
})
