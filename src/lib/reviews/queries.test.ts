import { describe, it, expect } from 'vitest'
import { anonymousPeers, groupPeerAnswers, MIN_PEERS_FOR_ANONYMITY, relationship, type ReviewBlock } from './queries'
import type { UserRole } from '@/lib/role-constants'

const cycle = { employee_id: 'ravi', manager_id: 'meera' }
const as = (role: UserRole, employeeId: string | null, currentManagerOfSubject: string | null = 'meera') =>
  relationship({ role, originalRole: role }, cycle, { employeeId, currentManagerOfSubject })

describe('who reads what on a review', () => {
  it('lets PnC Admin, Super Admin and Exec View read what was written', () => {
    for (const role of ['pnc_admin', 'super_admin', 'exec_view'] as const) {
      expect(as(role, null)).toMatchObject({ admin: true, readsText: true })
    }
  })

  it('gives PnC Ops statuses and actions, never the text', () => {
    expect(as('pnc_ops', null)).toMatchObject({ admin: true, readsText: false, operator: true, closer: false })
  })

  it('lets the manager read their report’s reviews, whatever role they hold', () => {
    expect(as('employee', 'meera')).toMatchObject({ isManager: true, readsText: true, operator: false, closer: false })
    // A new manager since the cycle opened is the manager too.
    expect(as('employee', 'neha', 'neha')).toMatchObject({ isManager: true, readsText: true })
  })

  it('never lets the employee read their own reviews or close their own review', () => {
    expect(as('employee', 'ravi')).toMatchObject({ isSubject: true, readsText: false, isManager: false })
    // Even a PnC Admin under review cannot close it.
    expect(as('pnc_admin', 'ravi')).toMatchObject({ isSubject: true, closer: false })
  })

  it('gives anyone else no standing at all', () => {
    expect(as('employee', 'pia')).toMatchObject({ admin: false, isManager: false, isSubject: false, readsText: false })
    expect(as('fin_admin', null)).toMatchObject({ admin: false, readsText: false })
    expect(as('platform_admin', null)).toMatchObject({ admin: false, readsText: false })
  })

  it('narrows under emulation, never widens', () => {
    const r = relationship({ role: 'pnc_admin', originalRole: 'pnc_ops' }, cycle, { employeeId: null, currentManagerOfSubject: 'meera' })
    expect(r.readsText).toBe(false)
  })
})

describe('who may reveal peer reviewers', () => {
  it('is Super Admin alone', () => {
    expect(as('super_admin', null)).toMatchObject({ revealsPeers: true })
    for (const role of ['pnc_admin', 'pnc_ops', 'exec_view', 'employee', 'fin_admin', 'platform_admin'] as const) {
      expect(as(role, null)).toMatchObject({ revealsPeers: false })
    }
  })

  it('never on their own review, nor on one they manage', () => {
    expect(as('super_admin', 'ravi')).toMatchObject({ isSubject: true, revealsPeers: false })
    expect(as('super_admin', 'meera')).toMatchObject({ isManager: true, revealsPeers: false })
  })

  it('not under emulation as another role', () => {
    const r = relationship({ role: 'pnc_admin', originalRole: 'super_admin' }, cycle, { employeeId: null, currentManagerOfSubject: 'meera' })
    expect(r.revealsPeers).toBe(false)
  })
})

const peer = (answers: [string, string][]): ReviewBlock => ({
  title: 'Peer review',
  submittedAt: '2026-11-01T10:00:00Z',
  answers: answers.map(([label, value]) => ({ label, value })),
})

describe('peer answers, by question', () => {
  const blocks = [
    peer([['Strengths', 'Zeal'], ['Growth', 'Delegation']]),
    peer([['Strengths', 'Attention to detail'], ['Growth', '']]),
    peer([['Strengths', 'Mentoring'], ['Growth', 'Saying no']]),
  ]

  it('lists every answer under its question, sorted by the answer, empty ones left out', () => {
    expect(groupPeerAnswers(blocks)).toEqual([
      { label: 'Strengths', answers: ['Attention to detail', 'Mentoring', 'Zeal'] },
      { label: 'Growth', answers: ['Delegation', 'Saying no'] },
    ])
  })

  it("does not keep one peer's answers in the same position across questions", () => {
    const [strengths, growth] = groupPeerAnswers(blocks)
    // The first peer wrote 'Zeal' and 'Delegation': last in one list, first in the other.
    expect(strengths.answers.indexOf('Zeal')).not.toBe(growth.answers.indexOf('Delegation'))
  })

  it('carries no names, times or titles', () => {
    expect(JSON.stringify(groupPeerAnswers(blocks))).not.toMatch(/2026-11-01|Peer review/)
  })

  it(`shows nothing until ${MIN_PEERS_FOR_ANONYMITY} peers have answered`, () => {
    expect(MIN_PEERS_FOR_ANONYMITY).toBe(3)
    expect(anonymousPeers(blocks.slice(0, 2))).toEqual({ peers: [], peerCount: 0, peersHidden: true })
    expect(anonymousPeers(blocks)).toMatchObject({ peerCount: 3, peersHidden: false })
    expect(anonymousPeers([])).toEqual({ peers: [], peerCount: 0, peersHidden: false })
  })
})
