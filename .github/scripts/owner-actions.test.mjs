import { describe, it, expect, vi } from 'vitest'
import { ownerActionFiles, buildIssue, hasWork, marker, run, SKIP_LABEL } from './owner-actions.mjs'

const file = (filename, status = 'added') => ({ filename, status })

describe('ownerActionFiles', () => {
  it('sorts migrations and functions, and ignores everything else', () => {
    const g = ownerActionFiles([
      file('supabase/migrations/202611050900_b.sql'),
      file('supabase/migrations/202611050800_a.sql'),
      file('supabase/migrations/README.md', 'modified'),
      file('supabase/vault/migrations/0006_x.sql'),
      file('supabase/vault/functions/submit-bank/index.ts', 'modified'),
      file('supabase/vault/functions/README.md', 'modified'),
      file('supabase/archive/migrations/old.sql'),
      file('supabase/tests/rls_probe.sql', 'modified'),
      file('src/app/page.tsx', 'modified'),
    ])
    expect(g.core.map((f) => f.path)).toEqual([
      'supabase/migrations/202611050800_a.sql',
      'supabase/migrations/202611050900_b.sql',
    ])
    expect(g.vault.map((f) => f.path)).toEqual(['supabase/vault/migrations/0006_x.sql'])
    expect(g.functions).toEqual(['submit-bank'])
    expect(g.shared).toBe(false)
  })

  it('needs nothing applied for a deleted file', () => {
    expect(hasWork(ownerActionFiles([file('supabase/migrations/202611050800_a.sql', 'removed')]))).toBe(false)
  })

  it('treats a change to shared function code as every function', () => {
    const g = ownerActionFiles([file('supabase/vault/functions/_shared/vault.ts', 'modified')])
    expect(g.shared).toBe(true)
    expect(buildIssue({ prNumber: 9, groups: g }).body).toContain('All of them')
  })

  it('flags an edited migration', () => {
    const g = ownerActionFiles([file('supabase/migrations/202611050800_a.sql', 'modified')])
    expect(buildIssue({ prNumber: 9, groups: g }).body).toContain('an existing file was edited')
  })
})

describe('buildIssue', () => {
  it('files nothing when nothing needs applying', () => {
    expect(buildIssue({ prNumber: 1, groups: ownerActionFiles([file('docs/x.md')]) })).toBeNull()
  })

  it('lists every step, vault-dev before the vault', () => {
    const issue = buildIssue({
      prNumber: 74,
      groups: ownerActionFiles([
        file('supabase/migrations/202611050800_a.sql'),
        file('supabase/vault/migrations/0006_x.sql'),
        file('supabase/vault/functions/approve-bank/index.ts', 'modified'),
      ]),
    })
    expect(issue.title).toBe('Apply #74 to production: 1 core migration, 1 vault migration, vault functions')
    expect(issue.labels).toEqual(['owner-action', 'migration'])
    expect(issue.body).toContain(marker(74))
    expect(issue.body).toContain('- [ ] `supabase/migrations/202611050800_a.sql`')
    expect(issue.body.indexOf('on **vault-dev**')).toBeLessThan(issue.body.indexOf('on **vault**'))
    expect(issue.body).toContain('`approve-bank`')
  })

  it('labels a functions-only change without `migration`', () => {
    const issue = buildIssue({
      prNumber: 3,
      groups: ownerActionFiles([file('supabase/vault/functions/read-salary/index.ts', 'modified')]),
    })
    expect(issue.labels).toEqual(['owner-action'])
  })
})

function fakeGithub({ files = [], existing = [], failAssignee = false } = {}) {
  const create = vi.fn(async (args) => {
    if (failAssignee && args.assignees) throw Object.assign(new Error('invalid assignee'), { status: 422 })
    return { data: { number: 101 } }
  })
  const createLabel = vi.fn(async () => {
    throw Object.assign(new Error('exists'), { status: 422 })
  })
  const listFiles = Symbol('listFiles')
  const listForRepo = Symbol('listForRepo')
  return {
    create,
    createLabel,
    github: {
      paginate: vi.fn(async (method) => (method === listFiles ? files : existing)),
      rest: { pulls: { listFiles }, issues: { listForRepo, create, createLabel } },
    },
  }
}

const context = (pr) => ({ payload: { pull_request: pr }, repo: { owner: 'o', repo: 'r' } })
const core = { info: vi.fn(), warning: vi.fn() }
const migration = [file('supabase/migrations/202611050800_a.sql')]

describe('run', () => {
  it('files an assigned issue for a merged pull request', async () => {
    const f = fakeGithub({ files: migration })
    const n = await run({ github: f.github, context: context({ number: 5, merged: true, labels: [] }), core, assignee: 'someone' })
    expect(n).toBe(101)
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ assignees: ['someone'], labels: ['owner-action', 'migration'] }))
  })

  it(`skips a pull request labelled ${SKIP_LABEL}`, async () => {
    const f = fakeGithub({ files: migration })
    await run({ github: f.github, context: context({ number: 5, merged: true, labels: [{ name: SKIP_LABEL }] }), core })
    expect(f.create).not.toHaveBeenCalled()
  })

  it('skips a pull request closed without merging', async () => {
    const f = fakeGithub({ files: migration })
    await run({ github: f.github, context: context({ number: 5, merged: false, labels: [] }), core })
    expect(f.create).not.toHaveBeenCalled()
  })

  it('never files twice for one pull request', async () => {
    const f = fakeGithub({ files: migration, existing: [{ number: 80, body: `x ${marker(5)} y` }] })
    await run({ github: f.github, context: context({ number: 5, merged: true, labels: [] }), core })
    expect(f.create).not.toHaveBeenCalled()
  })

  it('still files, unassigned, when the assignee cannot be assigned', async () => {
    const f = fakeGithub({ files: migration, failAssignee: true })
    const n = await run({ github: f.github, context: context({ number: 5, merged: true, labels: [] }), core, assignee: 'gone' })
    expect(n).toBe(101)
    expect(f.create).toHaveBeenCalledTimes(2)
    expect(f.create.mock.calls[1][0].assignees).toBeUndefined()
    expect(f.create.mock.calls[1][0].body).toContain('could not be assigned')
  })
})
