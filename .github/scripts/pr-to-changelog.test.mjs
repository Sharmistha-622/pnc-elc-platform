import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bumpType,
  changesFromBody,
  cleanTitle,
  buildOutputs,
  lintPullRequest,
  preview,
  prose,
  PREVIEW_MARKER,
} from './pr-to-changelog.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEMPLATE = fs.readFileSync(path.join(ROOT, '.github/pull_request_template.md'), 'utf8')

describe('the pull request template', () => {
  // Both of these shipped and broke a real merge (#43). The template explains
  // the rules inside HTML comments, and those comments contain the words
  // "BREAKING CHANGE" and an example bullet.
  it('does not make every PR a major release', () => {
    expect(bumpType({ title: 'fix(users): something', body: TEMPLATE })).toBe('patch')
    expect(bumpType({ title: 'feat(users): something', body: TEMPLATE })).toBe('minor')
  })

  it('does not treat its unfilled placeholder bullet as a change', () => {
    expect(changesFromBody(TEMPLATE)).toEqual([])
  })

  it('falls back to the title when the section is left unfilled', () => {
    const out = buildOutputs({ title: 'fix(users): render roles', body: TEMPLATE })
    expect(out.type).toBe('patch')
    expect(out.changeArgs).toBe("--change 'Fixes: Render roles'")
  })
})

describe('bumpType', () => {
  it('reads the conventional-commit prefix', () => {
    expect(bumpType({ title: 'feat: a thing' })).toBe('minor')
    expect(bumpType({ title: 'feat(scope): a thing' })).toBe('minor')
    expect(bumpType({ title: 'fix: a thing' })).toBe('patch')
    expect(bumpType({ title: 'chore: a thing' })).toBe('patch')
    expect(bumpType({ title: 'docs: a thing' })).toBe('patch')
  })

  it('treats a bang or a real footer as major', () => {
    expect(bumpType({ title: 'feat!: a thing' })).toBe('major')
    expect(bumpType({ title: 'feat(x)!: a thing' })).toBe('major')
    expect(bumpType({ title: 'fix: a thing', body: 'BREAKING CHANGE: it moved' })).toBe('major')
    expect(bumpType({ title: 'fix: a thing', body: 'BREAKING-CHANGE: it moved' })).toBe('major')
  })

  it('ignores the words inside a comment', () => {
    expect(bumpType({ title: 'fix: a thing', body: '<!-- BREAKING CHANGE means major -->' })).toBe(
      'patch'
    )
  })

  it('lets a label win over the title', () => {
    expect(bumpType({ title: 'chore: tidy', labels: ['release:minor'] })).toBe('minor')
    expect(bumpType({ title: 'feat!: big', labels: ['release:patch'] })).toBe('patch')
    expect(bumpType({ title: 'chore: tidy', labels: ['release:nonsense'] })).toBe('patch')
  })
})

describe('changesFromBody', () => {
  const section = (lines) => `Intro\n\n## Changelog\n${lines}\n`

  it('reads bullets under the heading', () => {
    expect(changesFromBody(section('- Fixes: one thing.\n- Security: another.'))).toEqual([
      'Fixes: one thing.',
      'Security: another.',
    ])
  })

  // The section usually runs to the end of the body.
  it('works when nothing follows the section', () => {
    expect(changesFromBody('## Changelog\n- Fixes: at the end.')).toEqual(['Fixes: at the end.'])
  })

  // GitHub's web editor saves descriptions with CRLF line endings.
  it('reads a body with CRLF line endings', () => {
    const body = section('- Fixes: one thing.\n- Security: another.').replace(/\n/g, '\r\n')
    expect(changesFromBody(body)).toEqual(['Fixes: one thing.', 'Security: another.'])
  })

  it('stops at the next heading', () => {
    const body = '## Changelog\n- Fixes: kept.\n\n## Checks\n- Fixes: ignored.'
    expect(changesFromBody(body)).toEqual(['Fixes: kept.'])
  })

  it('skips an empty description', () => {
    expect(changesFromBody(section('- Fixes:\n- Features:   \n- Fixes: real one.'))).toEqual([
      'Fixes: real one.',
    ])
  })

  it('skips a bullet with no category and an unknown one', () => {
    expect(changesFromBody(section('- just a note\n- Nope: wrong category\n- Fixes: kept.'))).toEqual(
      ['Fixes: kept.']
    )
  })

  it('normalises the category casing', () => {
    expect(changesFromBody(section('- security: lowercase.'))).toEqual(['Security: lowercase.'])
  })

  it('returns nothing when there is no section', () => {
    expect(changesFromBody('Just a description.')).toEqual([])
  })
})

describe('cleanTitle', () => {
  it('strips the prefix and capitalises', () => {
    expect(cleanTitle('feat(rbac): add roles')).toBe('Add roles')
    expect(cleanTitle('fix!: a thing')).toBe('A thing')
    expect(cleanTitle('no prefix here')).toBe('No prefix here')
  })

  it('never produces an empty title', () => {
    expect(cleanTitle('')).toBe('Untitled change')
    expect(cleanTitle('feat:')).toBe('Feat:')
  })
})

describe('buildOutputs', () => {
  it('skips entirely on the opt-out label', () => {
    expect(buildOutputs({ title: 'docs: typo', labels: ['no-changelog'] })).toEqual({ skip: 'true' })
  })

  it('shell-quotes an apostrophe so the run step survives it', () => {
    const out = buildOutputs({
      title: 'fix: x',
      body: "## Changelog\n- Fixes: it's fixed.",
    })
    expect(out.changeArgs).toBe("--change 'Fixes: it'\\''s fixed.'")
  })
})

// Each of these is a real pull request that put a wrong entry on main.
describe('regressions from real merges', () => {
  // #44's own description explained the bug it fixed, and so contained the
  // words mid-sentence. Matched anywhere, they released it as 2.00.00.
  it('does not read a breaking change out of prose that mentions one (#44)', () => {
    const body = [
      '## What this changes',
      '',
      '- The template explains the rules inside HTML comments, and those comments contain the words "BREAKING CHANGE". bumpType scanned the raw body.',
      '',
      '## Changelog',
      '',
      '- Fixes: the template no longer makes every PR a major release.',
    ].join('\n')
    expect(bumpType({ title: 'fix(ci): stop the PR template breaking the changelog workflow', body })).toBe(
      'patch'
    )
  })

  // #46 was named by GitHub after a long commit subject: no type, and cut off.
  it('refuses a title GitHub generated and truncated (#46)', () => {
    const { errors } = lintPullRequest({
      title: 'Segment the sidenav into role-aware groups, and close the gates behin…',
    })
    expect(errors.some((e) => e.includes('conventional-commit type'))).toBe(true)
    expect(errors.some((e) => e.includes('cut off'))).toBe(true)
  })

  it('refuses a title named after the branch (#47)', () => {
    expect(lintPullRequest({ title: 'Claude/cool feynman xwono8' }).errors).not.toEqual([])
  })
})

describe('the breaking-change footer', () => {
  it('counts only at the start of a line', () => {
    expect(bumpType({ title: 'fix: x', body: 'Intro.\n\nBREAKING CHANGE: the route moved' })).toBe('major')
    expect(bumpType({ title: 'fix: x', body: 'This is not a BREAKING CHANGE: honestly' })).toBe('patch')
    expect(bumpType({ title: 'fix: x', body: 'breaking change: lower case is prose' })).toBe('patch')
  })

  it('ignores one quoted in a code block', () => {
    const body = 'Example:\n\n```\nfeat!: something\n\nBREAKING CHANGE: example only\n```\n'
    expect(bumpType({ title: 'docs: explain footers', body })).toBe('patch')
  })

  it('reads one written in a CRLF description', () => {
    expect(bumpType({ title: 'fix: x', body: 'Intro.\r\n\r\nBREAKING CHANGE: moved\r\n' })).toBe('major')
  })
})

describe('prose', () => {
  it('drops an unclosed fence to the end, as Markdown renders it', () => {
    expect(prose('kept\n```\n- Fixes: inside\n')).toBe('kept\n')
  })

  it('leaves inline code alone', () => {
    expect(changesFromBody('## Changelog\n- Fixes: `foo()` no longer throws.')).toEqual([
      'Fixes: `foo()` no longer throws.',
    ])
  })

  it('ignores bullets quoted in a code block inside the section', () => {
    const body = '## Changelog\n\n- Fixes: real.\n\n```md\n- Fixes: example\n```\n'
    expect(changesFromBody(body)).toEqual(['Fixes: real.'])
  })
})

describe('lintPullRequest', () => {
  const ok = { title: 'fix(users): render roles', body: '## Changelog\n- Fixes: roles render.' }

  it('passes a well-formed pull request', () => {
    expect(lintPullRequest(ok)).toEqual({ errors: [], warnings: [] })
  })

  it('passes the real template with only a title filled in', () => {
    const { errors } = lintPullRequest({ title: 'fix(users): render roles', body: TEMPLATE })
    expect(errors).toEqual([])
  })

  it('refuses an unknown type and a capitalised one', () => {
    expect(lintPullRequest({ ...ok, title: 'fet: typo' }).errors[0]).toContain('not a known type')
    expect(lintPullRequest({ ...ok, title: 'Fix: capitalised' }).errors[0]).toContain('conventional-commit type')
  })

  it('refuses a type with nothing after it', () => {
    expect(lintPullRequest({ ...ok, title: 'fix:' }).errors[0]).toContain('nothing after it')
  })

  it('refuses a bullet that would be dropped', () => {
    const { errors } = lintPullRequest({
      ...ok,
      body: '## Changelog\n- Feature: singular\n- just a note\n- Fixes: kept.',
    })
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('Feature: singular')
  })

  it('does not count an unfilled placeholder as a problem', () => {
    expect(lintPullRequest({ ...ok, body: '## Changelog\n- Fixes:\n- Features: real.' }).errors).toEqual([])
  })

  it('refuses a changelog.json edit unless labelled for it', () => {
    expect(lintPullRequest({ ...ok, changelogEdited: true }).errors[0]).toContain('changelog-edit')
    expect(lintPullRequest({ ...ok, changelogEdited: true, labels: ['changelog-edit'] }).errors).toEqual([])
    // A correction PR records no note of its own, so it is usually no-changelog too.
    expect(
      lintPullRequest({ title: 'whatever', changelogEdited: true, labels: ['no-changelog'] }).errors
    ).toHaveLength(1)
  })

  it('asks nothing else of a no-changelog pull request', () => {
    expect(lintPullRequest({ title: 'Some branch name…', labels: ['no-changelog'] })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('refuses a release label that means nothing', () => {
    expect(lintPullRequest({ ...ok, labels: ['release:huge'] }).errors[0]).toContain('release:huge')
  })

  it('warns, without failing, on a major release and on a missing section', () => {
    const major = lintPullRequest({ ...ok, title: 'feat!: drop the v1 API' })
    expect(major.errors).toEqual([])
    expect(major.warnings[0]).toContain('**major**')
    expect(lintPullRequest({ title: 'fix: x' }).warnings[0]).toContain('no `## Changelog` bullets')
  })
})

describe('preview', () => {
  it('shows the exact version and note the recorder will write', () => {
    const { markdown, ok } = preview({
      title: 'feat(nav): group the sidebar',
      body: '## Changelog\n- Improvements: the sidebar is grouped.',
      current: '1.05.03',
    })
    expect(ok).toBe(true)
    expect(markdown.startsWith(PREVIEW_MARKER)).toBe(true)
    expect(markdown).toContain('**1.06.00**, a minor release from 1.05.03')
    expect(markdown).toContain('> **Group the sidebar**')
    expect(markdown).toContain('> - Improvements: the sidebar is grouped.')
  })

  it('agrees with what the recorder is given', () => {
    const pr = { title: 'fix: a thing', body: "## Changelog\n- Fixes: it's fixed." }
    const out = buildOutputs(pr)
    expect(out.changeArgs).toBe("--change 'Fixes: it'\\''s fixed.'")
    expect(preview({ ...pr, current: '1.00.00' }).markdown).toContain("> - Fixes: it's fixed.")
  })

  it('fails and says why', () => {
    const { markdown, ok } = preview({ title: 'Claude/some branch', current: '1.00.00' })
    expect(ok).toBe(false)
    expect(markdown).toContain('**Fix before merging:**')
  })

  it('says when nothing will be recorded', () => {
    const { markdown, ok } = preview({ title: 'chore: tooling', labels: ['no-changelog'] })
    expect(ok).toBe(true)
    expect(markdown).toContain('records no release note')
  })
})
