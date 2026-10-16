import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bumpType, changesFromBody, cleanTitle, buildOutputs } from './pr-to-changelog.mjs'

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
