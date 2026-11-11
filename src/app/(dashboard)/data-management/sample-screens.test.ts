import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readScreen = (relPath: string) =>
  readFileSync(resolve(process.cwd(), relPath), 'utf8')

describe('Data Management screens (#159)', () => {
  it('Import History shows an honest empty state ("Not available yet") and no sample rows', () => {
    const src = readScreen('src/app/(dashboard)/data-management/import-history/page.tsx')
    expect(src).toContain('Not available yet')
    expect(src).not.toContain('SAMPLE_HISTORY')
    expect(src).not.toContain('@navgurukul.org')
  })

  it('Record History shows an honest empty state ("Not available yet") and no sample rows', () => {
    const src = readScreen('src/app/(dashboard)/data-management/record-history/page.tsx')
    expect(src).toContain('Not available yet')
    expect(src).not.toContain('SAMPLE_TIMELINE')
    expect(src).not.toContain('@navgurukul.org')
  })

  it('Rollback Center shows an honest empty state ("Not available yet") and no sample rows', () => {
    const src = readScreen('src/app/(dashboard)/data-management/rollback/page.tsx')
    expect(src).toContain('Not available yet')
    expect(src).not.toContain('SAMPLE_BATCHES')
    expect(src).not.toContain('@navgurukul.org')
  })

  it('Audit Logs never falls back to sample rows when the log is empty', () => {
    const src = readScreen('src/app/(dashboard)/data-management/audit-logs/page.tsx')
    expect(src).not.toContain('SAMPLE_LOGS')
    expect(src).not.toContain('@navgurukul.org')
    expect(src).toContain('useState<any[]>([])')
    expect(src).toContain('No audit logs recorded yet.')
  })

  it('default settings and signatories do not hard-code @navgurukul.org people', () => {
    const settingsTypes = readScreen('src/lib/settings/types.ts')
    const signatoriesTypes = readScreen('src/lib/signatories/types.ts')
    const sendEmail = readScreen('src/lib/email/sendEmail.ts')
    expect(settingsTypes).not.toContain('@navgurukul.org')
    expect(signatoriesTypes).not.toContain('@navgurukul.org')
    expect(sendEmail).not.toContain('@navgurukul.org')
  })
})

