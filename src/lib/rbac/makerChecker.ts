// ============================================================================
// Maker ≠ checker (segregation of duties)
// ----------------------------------------------------------------------------
// Wherever one person records, issues or drafts a decision and a second person
// approves or closes it, the two actors must not be the same person — even if
// their role grants both steps. Used today for review decision acceptance,
// onboarding / letter approval, and DPDP notice publication, and ready for
// split-variation approvals and payroll sign-off.
// ============================================================================

export type ActorIdentity =
  | string
  | null
  | undefined
  | {
      id?: string | null
      userId?: string | null
      employeeId?: string | null
      email?: string | null
    }

export type MakerCheckerResult = { ok: true } | { ok: false; error: string }

const DEFAULT_ERROR =
  'The person who recorded or issued this cannot also approve it.'

/** Generic role labels used by legacy seeds that do not identify a person. */
const GENERIC_LABELS = new Set([
  'p&c',
  'p&c team',
  'p&c reviewer',
  'people & culture',
  'system',
  'unknown',
])

function extractTokens(actor: ActorIdentity): string[] {
  if (!actor) return []
  const rawValues: (string | null | undefined)[] =
    typeof actor === 'string'
      ? [actor]
      : [actor.id, actor.userId, actor.employeeId, actor.email]

  const tokens = new Set<string>()
  for (const raw of rawValues) {
    if (typeof raw !== 'string') continue
    const normalized = raw.trim().toLowerCase()
    if (!normalized || GENERIC_LABELS.has(normalized)) continue
    tokens.add(normalized)

    const emailMatch = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
    if (emailMatch) {
      tokens.add(emailMatch[0])
    }
  }
  return [...tokens]
}

/** True when `maker` and `checker` resolve to the same person. */
export function samePerson(maker: ActorIdentity, checker: ActorIdentity): boolean {
  const makerTokens = extractTokens(maker)
  const checkerTokens = extractTokens(checker)
  if (makerTokens.length === 0 || checkerTokens.length === 0) return false
  const makerSet = new Set(makerTokens)
  return checkerTokens.some((t) => makerSet.has(t))
}

/** Non-throwing maker ≠ checker check for actions that return `{ ok, error }`. */
export function checkDifferentPeople(
  maker: ActorIdentity,
  checker: ActorIdentity,
  message: string = DEFAULT_ERROR
): MakerCheckerResult {
  if (samePerson(maker, checker)) {
    return { ok: false, error: message }
  }
  return { ok: true }
}

/** Throwing maker ≠ checker check for service functions. */
export function assertDifferentPeople(
  maker: ActorIdentity,
  checker: ActorIdentity,
  message: string = DEFAULT_ERROR
): void {
  const result = checkDifferentPeople(maker, checker, message)
  if (!result.ok) {
    throw new Error(result.error)
  }
}

