import { describe, expect, it } from 'vitest'

import { NO_TEAM_HUE, TEAM_HUE_ORDER, panelTint, teamHue } from './teamPalette'
import {
  ancestorIds,
  buildTeamTree,
  departmentIdByName,
  filterTree,
  flattenTeams,
  initialsOf,
  personSubtitle,
  reportingLine,
  searchTree,
  treeStats,
  validateTeamParent,
  type TeamNode,
  type TeamPerson,
  type TeamRecord,
} from './teamTree'

// Made-up teams and people only: the repository is public.
const TEAMS: TeamRecord[] = [
  { id: 'ceo', name: 'CEO Office', parentId: null },
  { id: 'alumni', name: 'Alumni Growth', parentId: 'ceo' },
  { id: 'platform', name: 'Platform Dev', parentId: 'ceo' },
  { id: 'pnc', name: 'PnC', parentId: null },
  { id: 'ai', name: 'AI Lab', parentId: null },
  { id: 'finance', name: 'Finance', parentId: null },
]

const person = (id: string, name: string, departmentId: string | null, extra: Partial<TeamPerson> = {}): TeamPerson => ({
  id,
  name,
  departmentId,
  subtitle: 'Team member',
  email: null,
  avatarUrl: null,
  managerId: 'me',
  ...extra,
})

const PEOPLE: TeamPerson[] = [
  person('varun', 'Varun Iyer', 'ceo', { subtitle: 'Chief of Staff' }),
  person('aarti', 'Aarti Menon', 'alumni'),
  person('kabir', 'Kabir Sethi', 'platform', { subtitle: 'Software Engineer' }),
  person('dev', 'Dev Malhotra', 'platform', { subtitle: 'Engineering Lead' }),
  person('ishita', 'Ishita Bose', 'platform'),
  person('tanvi', 'Tanvi Joshi', 'platform', { managerId: 'dev' }),
  person('ritika', 'Ritika Das', 'pnc'),
]

const find = (nodes: TeamNode[], id: string): TeamNode => {
  const node = flattenTeams(nodes).find((n) => n.id === id)
  if (!node) throw new Error(`no team ${id}`)
  return node
}

describe('buildTeamTree', () => {
  const tree = buildTeamTree(TEAMS, PEOPLE)

  it('splits a team with sub-teams into nested teams, and a leaf team holds its people', () => {
    expect(tree.teams.map((t) => t.name)).toEqual(['CEO Office', 'PnC'])
    const ceo = find(tree.teams, 'ceo')
    expect(ceo.children.map((c) => c.name)).toEqual(['Alumni Growth', 'Platform Dev'])
    expect(find(tree.teams, 'pnc').children).toEqual([])
    expect(find(tree.teams, 'pnc').members.map((m) => m.name)).toEqual(['Ritika Das'])
  })

  it('keeps a parent team’s own members above its sub-teams', () => {
    expect(find(tree.teams, 'ceo').members.map((m) => m.name)).toEqual(['Varun Iyer'])
  })

  it('orders members by name', () => {
    expect(find(tree.teams, 'platform').members.map((m) => m.name)).toEqual([
      'Dev Malhotra',
      'Ishita Bose',
      'Kabir Sethi',
      'Tanvi Joshi',
    ])
  })

  it('leaves out teams with nobody in them', () => {
    expect(flattenTeams(tree.teams).map((t) => t.id)).not.toContain('ai')
    expect(flattenTeams(tree.teams).map((t) => t.id)).not.toContain('finance')
  })

  it('records depth from the top', () => {
    expect(find(tree.teams, 'ceo').depth).toBe(1)
    expect(find(tree.teams, 'platform').depth).toBe(2)
  })

  it('puts people with no team, or an unknown one, under unassigned', () => {
    const t = buildTeamTree(TEAMS, [person('a', 'Zara Khan', null), person('b', 'Om Rao', 'deleted-team')])
    expect(t.teams).toEqual([])
    expect(t.unassigned.map((p) => p.name)).toEqual(['Om Rao', 'Zara Khan'])
  })

  it('renders a third level with no special case', () => {
    const teams = [...TEAMS, { id: 'qa', name: 'Platform QA', parentId: 'platform' }]
    const people = [...PEOPLE.filter((p) => p.id !== 'kabir'), person('kabir', 'Kabir Sethi', 'qa')]
    const t = buildTeamTree(teams, people)
    const qa = find(t.teams, 'qa')
    expect(qa.depth).toBe(3)
    expect(qa.parentId).toBe('platform')
    expect(find(t.teams, 'platform').children.map((c) => c.id)).toEqual(['qa'])
  })

  it('gives top-level teams hues in the order they appear on the chart', () => {
    // AI Lab and Finance have nobody, so they take no slot.
    expect(find(tree.teams, 'ceo').hueIndex).toBe(0)
    expect(find(tree.teams, 'pnc').hueIndex).toBe(1)
    const onlyPnc = buildTeamTree(TEAMS, [person('ritika', 'Ritika Das', 'pnc')])
    expect(onlyPnc.teams[0].hueIndex).toBe(0)
  })

  it('gives the same hues every time for the same data', () => {
    const again = buildTeamTree([...TEAMS].reverse(), [...PEOPLE].reverse())
    expect(flattenTeams(again.teams).map((t) => [t.id, t.hueIndex])).toEqual(
      flattenTeams(tree.teams).map((t) => [t.id, t.hueIndex]),
    )
  })

  it('gives sub-teams their top-level team’s hue', () => {
    expect(find(tree.teams, 'alumni').hueIndex).toBe(find(tree.teams, 'ceo').hueIndex)
  })

  it('treats a team whose parent is unknown as top level', () => {
    const t = buildTeamTree([{ id: 'x', name: 'Orphan', parentId: 'gone' }], [person('a', 'Asha Rao', 'x')])
    expect(t.teams.map((n) => [n.name, n.depth, n.parentId])).toEqual([['Orphan', 1, null]])
  })

  it('draws every team once even when the data holds a loop', () => {
    const looped: TeamRecord[] = [
      { id: 'a', name: 'Alpha', parentId: 'b' },
      { id: 'b', name: 'Beta', parentId: 'a' },
      { id: 'c', name: 'Gamma', parentId: 'b' },
    ]
    const t = buildTeamTree(looped, [person('1', 'Asha Rao', 'a'), person('2', 'Bina Shah', 'b'), person('3', 'Chetan Roy', 'c')])
    expect(flattenTeams(t.teams).map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
    expect(t.teams.map((n) => n.id)).toEqual(['a'])
    expect(find(t.teams, 'a').headcount).toBe(3)
  })
})

describe('headcount roll-up', () => {
  it('counts a team’s own members plus every sub-team, at every level', () => {
    const teams = [...TEAMS, { id: 'qa', name: 'Platform QA', parentId: 'platform' }]
    const people = [...PEOPLE, person('neha', 'Neha Kulkarni', 'qa'), person('om', 'Om Rao', 'qa')]
    const t = buildTeamTree(teams, people)
    expect(find(t.teams, 'qa').headcount).toBe(2)
    expect(find(t.teams, 'platform').headcount).toBe(4 + 2)
    expect(find(t.teams, 'alumni').headcount).toBe(1)
    expect(find(t.teams, 'ceo').headcount).toBe(1 + 1 + 6)
    expect(find(t.teams, 'pnc').headcount).toBe(1)
  })

  it('totals people, teams and sub-teams, with the viewer added on top', () => {
    const tree = buildTeamTree(TEAMS, [...PEOPLE, person('x', 'Zara Khan', null)])
    expect(treeStats(tree, 1)).toEqual({ people: 7 + 1 + 1, teams: 2, subTeams: 2 })
  })
})

describe('filterTree', () => {
  const tree = buildTeamTree(TEAMS, PEOPLE)

  it('keeps one team’s branch under the teams above it', () => {
    const t = filterTree(tree, 'platform')
    expect(t.teams.map((n) => n.id)).toEqual(['ceo'])
    const ceo = t.teams[0]
    expect(ceo.members).toEqual([])
    expect(ceo.children.map((c) => c.id)).toEqual(['platform'])
    expect(ceo.headcount).toBe(4)
    expect(t.unassigned).toEqual([])
  })

  it('keeps a top-level team whole', () => {
    const t = filterTree(tree, 'ceo')
    expect(t.teams).toHaveLength(1)
    expect(t.teams[0]).toBe(find(tree.teams, 'ceo'))
  })

  it('returns the tree untouched with no filter', () => {
    expect(filterTree(tree, null)).toBe(tree)
  })
})

describe('searchTree', () => {
  const tree = buildTeamTree(TEAMS, PEOPLE)

  it('matches names, ignoring case, and opens the teams above them', () => {
    const r = searchTree(tree, 'TANVI')
    expect(r.personIds).toEqual(['tanvi'])
    expect([...r.expandIds].sort()).toEqual(['ceo', 'platform'])
  })

  it('matches designations', () => {
    expect(searchTree(tree, 'engineer').personIds).toEqual(['dev', 'kabir'])
  })

  it('matches team names and opens their ancestors', () => {
    const r = searchTree(tree, 'alumni')
    expect(r.teamIds).toEqual(['alumni'])
    expect([...r.expandIds]).toEqual(['ceo'])
  })

  it('ignores accents', () => {
    const t = buildTeamTree(TEAMS, [person('z', 'Zoë Dsouza', 'pnc')])
    expect(searchTree(t, 'zoe').personIds).toEqual(['z'])
  })

  it('finds nothing for a blank query', () => {
    const r = searchTree(tree, '   ')
    expect(r.personIds).toEqual([])
    expect(r.teamIds).toEqual([])
  })
})

describe('ancestorIds', () => {
  it('lists the teams above, nearest first', () => {
    const teams = [...TEAMS, { id: 'qa', name: 'Platform QA', parentId: 'platform' }]
    const t = buildTeamTree(teams, [person('a', 'Asha Rao', 'qa')])
    expect(ancestorIds(t.teams, 'qa')).toEqual(['platform', 'ceo'])
    expect(ancestorIds(t.teams, 'ceo')).toEqual([])
  })
})

describe('reportingLine', () => {
  const line = [
    { id: 'me', managerId: null },
    { id: 'a', managerId: 'me' },
    { id: 'b', managerId: 'me' },
    { id: 'c', managerId: 'a' },
    { id: 'd', managerId: 'c' },
    { id: 'other', managerId: 'someone-else' },
  ]

  it('finds direct and indirect reports at any depth', () => {
    const r = reportingLine(line, 'me')
    expect(r.people.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(r.directReports).toBe(2)
  })

  it('stops at a loop in the data', () => {
    const looped = [
      { id: 'me', managerId: 'x' },
      { id: 'x', managerId: 'me' },
      { id: 'y', managerId: 'x' },
    ]
    expect(reportingLine(looped, 'me').people.map((p) => p.id).sort()).toEqual(['x', 'y'])
  })

  it('finds nobody under someone with no reports', () => {
    expect(reportingLine(line, 'd')).toEqual({ people: [], directReports: 0 })
  })
})

describe('validateTeamParent (cycle prevention)', () => {
  // CEO Office > Platform Dev > Platform QA > Release, plus PnC and a two-level
  // branch Ops > Ops Desk.
  const teams: TeamRecord[] = [
    ...TEAMS,
    { id: 'qa', name: 'Platform QA', parentId: 'platform' },
    { id: 'release', name: 'Release', parentId: 'qa' },
    { id: 'ops', name: 'Ops', parentId: null },
    { id: 'desk', name: 'Ops Desk', parentId: 'ops' },
  ]

  it('refuses a team as its own parent', () => {
    expect(validateTeamParent(teams, 'ceo', 'ceo')).toBe('self')
  })

  it('refuses a team under its own child or grandchild', () => {
    expect(validateTeamParent(teams, 'ceo', 'platform')).toBe('cycle')
    expect(validateTeamParent(teams, 'platform', 'release')).toBe('cycle')
  })

  it('refuses a fifth level', () => {
    expect(validateTeamParent(teams, null, 'release')).toBe('too_deep')
  })

  it('refuses moving a branch so it ends deeper than four levels', () => {
    expect(validateTeamParent(teams, 'ops', 'qa')).toBe('too_deep')
    expect(validateTeamParent(teams, 'pnc', 'release')).toBe('too_deep')
  })

  it('allows a move that ends exactly four levels deep', () => {
    expect(validateTeamParent(teams, 'ops', 'platform')).toBeNull()
    expect(validateTeamParent(teams, null, 'qa')).toBeNull()
  })

  it('allows top level, and refuses an unknown parent', () => {
    expect(validateTeamParent(teams, 'platform', null)).toBeNull()
    expect(validateTeamParent(teams, 'platform', 'gone')).toBe('unknown_parent')
  })
})

describe('departmentIdByName (before the team-tree migration)', () => {
  const idFor = departmentIdByName(TEAMS)

  it('matches a department name ignoring case and spaces', () => {
    expect(idFor('  ceo office ')).toBe('ceo')
    expect(idFor('PnC')).toBe('pnc')
  })

  it('matches nothing for blank, None or an unknown name', () => {
    expect(idFor(null)).toBeNull()
    expect(idFor('')).toBeNull()
    expect(idFor('None')).toBeNull()
    expect(idFor('Operations')).toBeNull()
  })
})

describe('person display', () => {
  it('takes initials from the first and last name', () => {
    expect(initialsOf('Varun Iyer')).toBe('VI')
    expect(initialsOf('  Asha  K  Rao ')).toBe('AR')
    expect(initialsOf('Madonna')).toBe('M')
    expect(initialsOf('')).toBe('?')
  })

  it('falls back from designation to employment type to a plain label', () => {
    expect(personSubtitle('Engineering Lead', 'Intern')).toBe('Engineering Lead')
    expect(personSubtitle('  ', 'Intern')).toBe('Intern')
    expect(personSubtitle(null, null)).toBe('Team member')
  })
})

describe('teamPalette', () => {
  it('assigns hues in a fixed order and wraps past the end', () => {
    expect(teamHue(0).header).toContain('indigo')
    expect(teamHue(1).header).toContain('orange')
    expect(teamHue(TEAM_HUE_ORDER.length)).toBe(teamHue(0))
  })

  it('tints deeper levels darker, capped at level 3', () => {
    const hue = teamHue(0)
    expect(panelTint(hue, 1)).toContain('bg-indigo-50')
    expect(panelTint(hue, 2)).toContain('bg-indigo-100')
    expect(panelTint(hue, 3)).toContain('bg-indigo-200')
    expect(panelTint(hue, 4)).toBe(panelTint(hue, 3))
    expect(NO_TEAM_HUE.header).toContain('slate')
  })
})
