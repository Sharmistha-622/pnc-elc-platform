// ============================================================================
// The team tree behind the team chart
// ----------------------------------------------------------------------------
// Pure functions, no I/O: the loaders in `getTeamChart.ts` fetch departments
// and people in two queries and hand them here. Teams nest through
// `departments.parent_id`; each person sits in exactly one team, the most
// specific one (`employees.department_id`).
//
// Headcounts roll up: a team counts its own members plus everyone in its
// sub-teams. Teams with nobody in them are left out, so a manager's chart
// shows only the teams their people are in.
// ============================================================================

/** The deepest a team may sit. The database enforces the same limit. */
export const MAX_TEAM_DEPTH = 4

/** A department row, as the loaders read it. */
export interface TeamRecord {
  id: string
  name: string
  parentId: string | null
}

/** A person on the chart. Only general data: never salary, IDs or feedback. */
export interface TeamPerson {
  id: string
  name: string
  /** The team they belong to; null or unknown puts them under "No team". */
  departmentId: string | null
  /** Job title, or the most suitable stand-in (`personSubtitle`). */
  subtitle: string
  /** Work email, when the viewer may see it. */
  email: string | null
  avatarUrl: string | null
  managerId: string | null
}

/** One team on the chart, with its members and sub-teams. */
export interface TeamNode {
  id: string
  name: string
  parentId: string | null
  /** 1 for a top-level team. */
  depth: number
  /** Palette slot, from the top-level team this one sits under. */
  hueIndex: number
  /** People whose team is exactly this one, by name. */
  members: TeamPerson[]
  /** Sub-teams with at least one person in them, by name. */
  children: TeamNode[]
  /** Members plus everyone in every sub-team. */
  headcount: number
}

/** What the chart draws. */
export interface TeamTree {
  teams: TeamNode[]
  /** People whose team is missing or unknown. */
  unassigned: TeamPerson[]
}

/** Header numbers: "X people · Y teams · Z sub-teams". */
export interface TeamTreeStats {
  people: number
  teams: number
  subTeams: number
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/**
 * Teams whose parent is missing, unknown, or part of a loop are treated as
 * top-level, so bad data still renders instead of vanishing.
 */
const topLevelIds = (teams: TeamRecord[]): Set<string> => {
  const byId = new Map(teams.map((t) => [t.id, t]))
  const roots = new Set(teams.filter((t) => !t.parentId || !byId.has(t.parentId)).map((t) => t.id))
  // A loop with no way out: break it at its first member by name.
  for (const team of [...teams].sort(byName)) {
    if (!reachesRoot(team.id, byId, roots)) roots.add(team.id)
  }
  return roots
}

const reachesRoot = (id: string, byId: Map<string, TeamRecord>, roots: Set<string>): boolean => {
  const seen = new Set<string>()
  let current = byId.get(id)
  while (current) {
    if (roots.has(current.id)) return true
    if (seen.has(current.id) || !current.parentId) return false
    seen.add(current.id)
    current = byId.get(current.parentId)
  }
  return false
}

/**
 * Builds the chart's tree.
 *
 * Colours follow a fixed order: the first top-level team on the chart (by
 * name) takes the first hue, the next the second, and so on. Sub-teams take
 * their top-level team's hue. Never random, and the same for the same chart.
 *
 * @param teams - Every department (one query)
 * @param people - Everyone to place on the chart (one query)
 */
export const buildTeamTree = (teams: TeamRecord[], people: TeamPerson[]): TeamTree => {
  const roots = topLevelIds(teams)
  const childrenOf = new Map<string, TeamRecord[]>()
  for (const team of teams) {
    if (roots.has(team.id) || !team.parentId) continue
    const siblings = childrenOf.get(team.parentId) ?? []
    siblings.push(team)
    childrenOf.set(team.parentId, siblings)
  }

  const knownIds = new Set(teams.map((t) => t.id))
  const membersOf = new Map<string, TeamPerson[]>()
  const unassigned: TeamPerson[] = []
  for (const person of people) {
    if (person.departmentId && knownIds.has(person.departmentId)) {
      const list = membersOf.get(person.departmentId) ?? []
      list.push(person)
      membersOf.set(person.departmentId, list)
    } else {
      unassigned.push(person)
    }
  }

  const placed = new Set<string>()

  const toNode = (team: TeamRecord, depth: number): TeamNode | null => {
    if (placed.has(team.id)) return null
    placed.add(team.id)
    const children = (childrenOf.get(team.id) ?? [])
      .sort(byName)
      .map((child) => toNode(child, depth + 1))
      .filter((child): child is TeamNode => child !== null)
    const members = [...(membersOf.get(team.id) ?? [])].sort(byName)
    const headcount = members.length + children.reduce((sum, c) => sum + c.headcount, 0)
    if (headcount === 0) return null
    const parentId = roots.has(team.id) ? null : team.parentId
    return { id: team.id, name: team.name, parentId, depth, hueIndex: 0, members, children, headcount }
  }

  const withHue = (node: TeamNode, hueIndex: number): TeamNode => ({
    ...node,
    hueIndex,
    children: node.children.map((child) => withHue(child, hueIndex)),
  })

  const nodes = teams
    .filter((t) => roots.has(t.id))
    .sort(byName)
    .map((team) => toNode(team, 1))
    .filter((node): node is TeamNode => node !== null)
    .map((node, index) => withHue(node, index))

  return { teams: nodes, unassigned: unassigned.sort(byName) }
}

/** Every team in the tree, depth first, in the order the chart draws them. */
export const flattenTeams = (nodes: TeamNode[]): TeamNode[] =>
  nodes.flatMap((node) => [node, ...flattenTeams(node.children)])

/** People, top-level teams and sub-teams in a tree. */
export const treeStats = (tree: TeamTree, extraPeople = 0): TeamTreeStats => {
  const all = flattenTeams(tree.teams)
  const placed = tree.teams.reduce((sum, t) => sum + t.headcount, 0)
  return {
    people: placed + tree.unassigned.length + extraPeople,
    teams: tree.teams.length,
    subTeams: all.length - tree.teams.length,
  }
}

/** Ids of a team's ancestors in the tree, nearest first. */
export const ancestorIds = (nodes: TeamNode[], teamId: string): string[] => {
  const parentOf = new Map(flattenTeams(nodes).map((n) => [n.id, n.parentId]))
  const ids: string[] = []
  let parent = parentOf.get(teamId) ?? null
  while (parent && !ids.includes(parent)) {
    ids.push(parent)
    parent = parentOf.get(parent) ?? null
  }
  return ids
}

/**
 * Narrows the tree to one team: its whole branch, under the chain of teams
 * above it. Those ancestors keep their headers but not their own members or
 * other sub-teams, and their counts are what remains.
 */
export const filterTree = (tree: TeamTree, teamId: string | null): TeamTree => {
  if (!teamId) return tree
  const keep = (node: TeamNode): TeamNode | null => {
    if (node.id === teamId) return node
    const child = node.children.map(keep).find((c): c is TeamNode => c !== null)
    if (!child) return null
    return { ...node, members: [], children: [child], headcount: child.headcount }
  }
  const teams = tree.teams.map(keep).filter((n): n is TeamNode => n !== null)
  return { teams, unassigned: [] }
}

/** What a search finds, and which teams must open to show it. */
export interface TeamSearchResult {
  /** People whose name or designation matches, in the order the chart draws them. */
  personIds: string[]
  /** Teams whose name matches. */
  teamIds: string[]
  /** Teams to open so every match is visible. */
  expandIds: Set<string>
}

const normalise = (text: string) => text.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').trim()

/**
 * Matches people by name and designation, and teams by name, ignoring case
 * and accents. A blank query matches nothing.
 */
export const searchTree = (tree: TeamTree, query: string): TeamSearchResult => {
  const q = normalise(query)
  const result: TeamSearchResult = { personIds: [], teamIds: [], expandIds: new Set() }
  if (!q) return result
  const matches = (text: string) => normalise(text).includes(q)

  const visit = (node: TeamNode, path: string[]) => {
    if (matches(node.name)) {
      result.teamIds.push(node.id)
      path.forEach((id) => result.expandIds.add(id))
    }
    for (const person of node.members) {
      if (matches(person.name) || matches(person.subtitle)) {
        result.personIds.push(person.id)
        ;[...path, node.id].forEach((id) => result.expandIds.add(id))
      }
    }
    node.children.forEach((child) => visit(child, [...path, node.id]))
  }
  tree.teams.forEach((team) => visit(team, []))
  for (const person of tree.unassigned) {
    if (matches(person.name) || matches(person.subtitle)) result.personIds.push(person.id)
  }
  return result
}

/**
 * Everyone below `rootId` in the reporting line, at any depth, following
 * `managerId`. Loops in the data are ignored rather than followed forever.
 */
export const reportingLine = <T extends { id: string; managerId: string | null }>(
  people: T[],
  rootId: string,
): { people: T[]; directReports: number } => {
  const reportsOf = new Map<string, T[]>()
  for (const person of people) {
    if (!person.managerId || person.id === rootId) continue
    const list = reportsOf.get(person.managerId) ?? []
    list.push(person)
    reportsOf.set(person.managerId, list)
  }
  const seen = new Set<string>([rootId])
  const found: T[] = []
  const queue = [rootId]
  while (queue.length > 0) {
    const managerId = queue.shift()!
    for (const report of reportsOf.get(managerId) ?? []) {
      if (seen.has(report.id)) continue
      seen.add(report.id)
      found.push(report)
      queue.push(report.id)
    }
  }
  return { people: found, directReports: (reportsOf.get(rootId) ?? []).length }
}

/** Why a team cannot move under a new parent, or null when it can. */
export type TeamMoveRefusal = 'self' | 'cycle' | 'too_deep' | 'unknown_parent'

/**
 * Checks a new parent for a team before writing it, so the person editing
 * gets a clear reason. The database trigger `departments_check_tree` holds
 * the same rules for every write.
 *
 * @param teams - Every department
 * @param teamId - The team being moved, or null for a new team
 * @param parentId - Its new parent, or null for top level
 */
export const validateTeamParent = (
  teams: TeamRecord[],
  teamId: string | null,
  parentId: string | null,
): TeamMoveRefusal | null => {
  if (!parentId) return null
  if (teamId && parentId === teamId) return 'self'
  const byId = new Map(teams.map((t) => [t.id, t]))
  if (!byId.has(parentId)) return 'unknown_parent'

  // Walk up from the new parent; meeting the moved team is a cycle.
  let parentDepth = 0
  const seen = new Set<string>()
  let current = byId.get(parentId)
  while (current) {
    if (current.id === teamId) return 'cycle'
    if (seen.has(current.id)) break
    seen.add(current.id)
    parentDepth += 1
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  // Levels in the moved team's own branch, itself included.
  const height = (id: string, guard: Set<string>): number => {
    if (guard.has(id)) return 0
    guard.add(id)
    const kids = teams.filter((t) => t.parentId === id)
    return 1 + Math.max(0, ...kids.map((k) => height(k.id, guard)))
  }
  const branchHeight = teamId ? height(teamId, new Set()) : 1

  return parentDepth + branchHeight > MAX_TEAM_DEPTH ? 'too_deep' : null
}

/** Two letters for an avatar: first and last name, e.g. "Asha Rao" → "AR". */
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toLocaleUpperCase()
}

/**
 * The line under a person's name: their designation, else their employment
 * type ("Intern", "Full-Time Employee (FTE)"), else "Team member".
 */
export const personSubtitle = (designation: string | null | undefined, employmentType: string | null | undefined): string =>
  designation?.trim() || employmentType?.trim() || 'Team member'
