import { describe, it, expect } from 'vitest'
import { noticeChecklist, checklistPasses, diffLines, fillTemplate, nextVersion, noticeText, PRIVACY_SECTIONS } from './notices'

const complete = Object.fromEntries(PRIVACY_SECTIONS.map((s) => [s.key, `${s.label}: enough words here.`]))

describe('noticeChecklist', () => {
  it('passes a privacy notice with every Rule 3 element and a contact', () => {
    expect(checklistPasses(noticeChecklist('employee', complete, { contactSet: true }))).toBe(true)
  })

  it('fails when a Rule 3 element is missing', () => {
    const rest = { ...complete, withdraw_how: '' }
    const items = noticeChecklist('candidate', rest, { contactSet: true })
    expect(checklistPasses(items)).toBe(false)
    expect(items.find((i) => i.key === 'withdraw_how')?.ok).toBe(false)
  })

  it('fails when the privacy contact is blank', () => {
    expect(checklistPasses(noticeChecklist('employee', complete, { contactSet: false }))).toBe(false)
  })

  it('needs every Rule 7 placeholder in the message to affected people', () => {
    const body = '{{description}} {{consequences}} {{mitigation}} {{safety_steps}} {{contact}}'
    expect(checklistPasses(noticeChecklist('breach_individual', { body }, { contactSet: false }))).toBe(true)
    expect(checklistPasses(noticeChecklist('breach_individual', { body: '{{description}}' }, { contactSet: false }))).toBe(false)
  })
})

describe('diffLines', () => {
  it('marks added, removed and unchanged lines', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd')).toEqual([
      { op: 'same', text: 'a' },
      { op: 'del', text: 'b' },
      { op: 'same', text: 'c' },
      { op: 'add', text: 'd' },
    ])
  })

  it('treats a first version as all added', () => {
    expect(diffLines('', 'x\ny').every((l) => l.op === 'add')).toBe(true)
  })
})

describe('notice helpers', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(fillTemplate('{{a}} and {{b}}', { a: 'one' })).toBe('one and {{b}}')
  })

  it('numbers versions upward', () => {
    expect(nextVersion([])).toBe(1)
    expect(nextVersion([{ version: 1 }, { version: 3 }])).toBe(4)
  })

  it('renders sections as text in reading order', () => {
    expect(noticeText('employee', { purposes: 'P', data_items: 'D' })).toMatch(/itemised[\s\S]*specified purposes/i)
  })
})
