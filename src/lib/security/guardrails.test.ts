import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

// ============================================================================
// Security guardrails — the review checklist, as tests.
// ----------------------------------------------------------------------------
// Each rule here is one a reviewer would otherwise have to remember on every
// pull request. They read the source tree, so a change that breaks one fails
// CI with the file and the rule named, before anyone has to spot it.
//
// An exemption is a deliberate, reviewed decision: it lives in a list below
// with the reason next to it, so adding one shows up in the diff.
// ============================================================================

const SRC = path.join(process.cwd(), 'src')

function sourceFiles(dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

const files = sourceFiles().map((file) => ({
  file: path.relative(process.cwd(), file),
  text: fs.readFileSync(file, 'utf8'),
}))

function directive(text: string): 'use client' | 'use server' | null {
  const first = text.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '').slice(0, 20)
  if (/^['"]use client['"]/.test(first)) return 'use client'
  if (/^['"]use server['"]/.test(first)) return 'use server'
  return null
}

describe('server actions', () => {
  // A 'use server' file exports functions the browser can call directly, with
  // any arguments, whatever page imported them. The first lines of each must
  // decide whether this caller may proceed.
  const GUARD = /\b(guard|guardResource|requireFeature|platformConfigRefusal|canEditPlatformConfig|profileAccess|isNominatedPeer)\(/

  // Reviewed exceptions: protected some other way, said how.
  const EXEMPT: Record<string, string> = {
    // Process configuration, no personal data. Readable by every staff
    // session at the database ("staff read" in 202610241000_lockdown_rls.sql).
    'src/lib/settings/service.ts:checkSettingsTableExists': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getGeneralSettings': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getGeneralSetting': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getConfirmationRules': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getConfirmationRule': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getAppraisalRules': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getAppraisalRule': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getAppraisalCycles': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getPeerFeedbackSettings': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getRedFlagKeywords': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getActiveRedFlagKeywords': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getNotificationSettings': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getEmailTemplates': 'configuration, RLS staff read',
    'src/lib/settings/service.ts:getDocumentTypes': 'configuration, RLS staff read',
    // The forms module enforces access in the database: every forms table has
    // a `can_manage_forms()` policy, answers have `can_read_form_answers()`,
    // and a respondent can touch only their own submission.
    'src/lib/forms/actions.ts:createForm': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:addSection': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:deleteSection': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:addField': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:deleteField': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:publishVersion': 'RLS + publish_form_version() checks can_manage_forms()',
    'src/lib/forms/actions.ts:archiveForm': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:restoreForm': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:createDraftVersion': 'RLS can_manage_forms()',
    'src/lib/forms/actions.ts:duplicateForm': 'RLS can_manage_forms()',
    'src/lib/forms/requestActions.ts:createFormRequest': 'RLS can_manage_forms()',
    'src/lib/forms/branchingActions.ts:setSectionRule': 'RLS can_manage_forms()',
    'src/lib/forms/branchingActions.ts:clearSectionRule': 'RLS can_manage_forms()',
    'src/lib/forms/respondentActions.ts:saveSubmission': 'RLS: own submission only',
    // Guarded, but by a check specific to them rather than a shared helper.
    'src/lib/documents/uploadDocument.ts:uploadDocument': 'checks canHandleDocuments(originalRole) itself',
    'src/lib/rbac/setUserRole.ts:setUserRole': 'checks canGrantRole against the stored role itself',
    'src/lib/settings/access.ts:canEditPlatformConfig': 'is the guard',
    // Self-scoped: the caller's own record, their manager and their reports.
    'src/lib/profile/profileActions.ts:getMyProfileData': 'self-scoped by session',
  }

  const actions = files
    .filter((f) => directive(f.text) === 'use server')
    .flatMap(({ file, text }) =>
      [...text.matchAll(/export async function (\w+)\s*\(/g)].map((m) => {
        const rest = text.slice(m.index! + m[0].length)
        const end = rest.search(/\n(export |async function |function )/)
        return { id: `${file}:${m[1]}`, body: end === -1 ? rest : rest.slice(0, end) }
      })
    )

  it('finds the server actions', () => {
    expect(actions.length).toBeGreaterThan(50)
  })

  it('guards every exported server action, or names why not', () => {
    const unguarded = actions.filter((a) => !GUARD.test(a.body) && !(a.id in EXEMPT)).map((a) => a.id)
    expect(unguarded, 'add a guard from src/lib/rbac/guard.ts, or an EXEMPT entry with the reason').toEqual([])
  })

  it('keeps no stale exemptions', () => {
    const ids = new Set(actions.map((a) => a.id))
    const stale = Object.keys(EXEMPT).filter((id) => !ids.has(id))
    expect(stale, 'remove EXEMPT entries for actions that no longer exist').toEqual([])
  })

  it('exports nothing but async functions and type declarations', () => {
    // Next compiles every export of a 'use server' file into a callable
    // action. A re-export (`export { x }`, `export type { T }`) or a constant
    // breaks the production build — or, for a re-exported function, quietly
    // publishes it as an action without the guard its own module gives it.
    const offenders = files
      .filter((f) => directive(f.text) === 'use server')
      .filter((f) => /^export\s+(\{|type\s*\{|const |let |var |class |default )/m.test(f.text))
      .map((f) => f.file)
    expect(offenders).toEqual([])
  })

  it('never puts the service-role client behind an unguarded action', () => {
    const risky = actions
      .filter((a) => /createAdminSupabaseClient|onboardingDb\(/.test(a.body) && !GUARD.test(a.body) && !(a.id in EXEMPT))
      .map((a) => a.id)
    expect(risky).toEqual([])
  })
})

describe('client components', () => {
  const client = files.filter((f) => directive(f.text) === 'use client')

  it('never import a server-side Supabase client', () => {
    // The admin client bypasses RLS entirely; the server client reads cookies
    // through next/headers. Neither belongs in a bundle shipped to browsers.
    const offenders = client
      .filter((f) => /from ['"]@\/lib\/supabase\/(admin|server)['"]/.test(f.text))
      .map((f) => f.file)
    expect(offenders).toEqual([])
  })
})

describe('secrets', () => {
  it('reads the service-role key in exactly one place', () => {
    const readers = files.filter((f) => /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(f.text)).map((f) => f.file)
    expect(readers).toEqual(['src/lib/supabase/admin.ts'])
  })

  it('never exposes a secret under NEXT_PUBLIC_', () => {
    // Anything prefixed NEXT_PUBLIC_ is inlined into the browser bundle.
    const allowed = new Set([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_APP_URL',
    ])
    const used = new Set(files.flatMap((f) => [...f.text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map((m) => m[0])))
    const unexpected = [...used].filter((name) => !allowed.has(name))
    expect(unexpected, 'a new NEXT_PUBLIC_ variable must be reviewed: is it really public?').toEqual([])
  })
})

describe('impersonation', () => {
  it('lets no cookie choose who the signed-in user is', () => {
    // `dev-employee-id` let any user act as any employee. Who you are comes
    // from the session; the only override allowed is `dev-role-override`,
    // which `canImpersonate` bounds to a lower rank in the same group.
    const offenders = files.filter((f) => /dev-employee-id/.test(f.text) && !/used to be/.test(f.text)).map((f) => f.file)
    expect(offenders).toEqual([])
  })
})

describe('the database and the app agree', () => {
  // A few rules exist twice, once in TypeScript and once in SQL. If they
  // drift, the app either offers what the database refuses or — worse —
  // the database allows what the app was meant to stop.
  const lockdown = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/202610241000_lockdown_rls.sql'),
    'utf8'
  )

  it('on which email domains are the organisation', async () => {
    const { DEFAULT_ALLOWED_DOMAINS } = await import('@/lib/auth/allowedEmail')
    const sql = lockdown.match(/= any \(array\[([^\]]+)\]\)/)?.[1] ?? ''
    const domains = [...sql.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(domains).toEqual(DEFAULT_ALLOWED_DOMAINS)
  })

  it('on who may write letters, templates and signatories', async () => {
    const { FEATURE_ACCESS } = await import('@/lib/role-constants')
    const block = lockdown.match(/foreach t in array array\['letter_templates', 'authorized_signatories'\][\s\S]*?"pnc write"[\s\S]*?using \(public\.has_role\(([^)]+)\)\)/)?.[1] ?? ''
    const roles = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    expect(roles).toEqual([...FEATURE_ACCESS.lettersEdit].sort())
  })

  it('on who may change master data', async () => {
    const { FEATURE_ACCESS } = await import('@/lib/role-constants')
    const block = lockdown.match(/"data management writes"[\s\S]*?using \(public\.has_role\(([^)]+)\)\)/)?.[1] ?? ''
    const roles = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    expect(roles).toEqual([...FEATURE_ACCESS.masterData].sort())
  })
})
