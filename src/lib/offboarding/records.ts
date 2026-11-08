import { departmentOf } from '@/lib/employees/department'
import type {
  AssetCondition,
  AssetReturnStatus,
  ChecklistItemStatus,
  ExitDocument,
  ExitType,
  FnFStatus,
  NDCDepartment,
  NDCStatus,
  OffboardingActivityLog,
  OffboardingAssetItem,
  OffboardingCase,
  OffboardingFnF,
  OffboardingNDCDepartment,
  OffboardingSettings,
  OffboardingStatus,
  ResignationRequest,
  ResignationRequestStatus,
  ReviewDecision,
} from './types'

// ============================================================================
// Offboarding records: shapes, mapping and the rules that need no database
// ----------------------------------------------------------------------------
// Pure, so it can be tested on its own and imported by the 'use server'
// service, which may export only async functions.
//
// Every change the browser asks for goes through a `pick…` function here
// first: a server action receives whatever object the browser sends, and a
// column that is not on the list (an id, a case id, a timestamp) must never
// reach an update.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const EXIT_TYPES: readonly ExitType[] = [
  'resignation',
  'termination',
  'contract_completion',
  'immediate_relieving',
  'mutual_separation',
  'other',
]
const CHECKLIST_STATUSES: readonly ChecklistItemStatus[] = ['pending', 'in_progress', 'completed', 'waived', 'blocked']
const RETURN_STATUSES: readonly AssetReturnStatus[] = [
  'pending_return',
  'returned',
  'damaged',
  'lost',
  'cleared',
  'under_recovery',
  'waived',
]
const CONDITIONS: readonly AssetCondition[] = ['excellent', 'good', 'fair', 'damaged', 'missing']
export const NDC_DEPARTMENTS: readonly NDCDepartment[] = ['manager', 'it_admin', 'finance', 'pnc']
const NDC_STATUSES: readonly NDCStatus[] = [
  'not_started',
  'pending',
  'under_review',
  'clarification_required',
  'cleared',
  'blocked',
]
const FNF_STATUSES: readonly FnFStatus[] = [
  'not_started',
  'awaiting_clearance',
  'computation_pending',
  'under_review',
  'processing',
  'processed',
  'blocked',
]
const REVIEW_DECISIONS: readonly ReviewDecision[] = ['accepted', 'retention_proposed', 'on_hold']

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

export function isNdcDepartment(value: unknown): value is NDCDepartment {
  return oneOf(NDC_DEPARTMENTS, value)
}

export function isReviewDecision(value: unknown): value is ReviewDecision {
  return oneOf(REVIEW_DECISIONS, value)
}

function text(value: unknown, max = 4000): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === 'string' ? value.slice(0, max) : undefined
}

function amount(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined
}

function drop<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>
}

// ---------------------------------------------------------------------------
// What the browser may change
// ---------------------------------------------------------------------------

export function pickChecklistChanges(input: unknown): { status?: ChecklistItemStatus; notes?: string | null } {
  const u = (input ?? {}) as Record<string, unknown>
  return drop({
    status: oneOf(CHECKLIST_STATUSES, u.status) ? u.status : undefined,
    notes: text(u.notes),
  })
}

export function pickAssetChanges(input: unknown): {
  return_status?: AssetReturnStatus
  condition?: AssetCondition
  recovery_amount?: number
  waiver_reason?: string | null
  clearance_notes?: string | null
} {
  const u = (input ?? {}) as Record<string, unknown>
  return drop({
    return_status: oneOf(RETURN_STATUSES, u.return_status) ? u.return_status : undefined,
    condition: oneOf(CONDITIONS, u.condition) ? u.condition : undefined,
    recovery_amount: amount(u.recovery_amount),
    waiver_reason: text(u.waiver_reason),
    clearance_notes: text(u.clearance_notes),
  })
}

export function pickNdcChanges(input: unknown): {
  status?: NDCStatus
  remarks?: string | null
  blocker_reason?: string | null
} {
  const u = (input ?? {}) as Record<string, unknown>
  return drop({
    status: oneOf(NDC_STATUSES, u.status) ? u.status : undefined,
    remarks: text(u.remarks),
    blocker_reason: text(u.blocker_reason),
  })
}

export function pickFnfChanges(input: unknown): Partial<
  Pick<
    OffboardingFnF,
    | 'status'
    | 'payable_days'
    | 'leave_encashment_days'
    | 'gratuity_eligible'
    | 'asset_recovery_amount'
    | 'other_deductions'
    | 'net_payable_estimate'
    | 'payment_reference'
    | 'payment_date'
    | 'remarks'
  >
> {
  const u = (input ?? {}) as Record<string, unknown>
  const payableDays = amount(u.payable_days)
  return drop({
    status: oneOf(FNF_STATUSES, u.status) ? u.status : undefined,
    payable_days: payableDays === undefined ? undefined : Math.round(payableDays),
    leave_encashment_days: amount(u.leave_encashment_days),
    gratuity_eligible: typeof u.gratuity_eligible === 'boolean' ? u.gratuity_eligible : undefined,
    asset_recovery_amount: amount(u.asset_recovery_amount),
    other_deductions: amount(u.other_deductions),
    net_payable_estimate: text(u.net_payable_estimate, 200) ?? undefined,
    payment_reference: text(u.payment_reference, 200),
    payment_date: u.payment_date === null ? null : isIsoDate(u.payment_date) ? u.payment_date : undefined,
    remarks: text(u.remarks),
  }) as ReturnType<typeof pickFnfChanges>
}

const SETTING_NUMBERS = [
  'default_notice_period_days',
  'standard_fnf_timeline_days',
  'standard_hold_period_days',
  'clearance_reminder_frequency_days',
  'escalation_threshold_days',
] as const
const SETTING_FLAGS = [
  'require_all_ndc_before_fnf',
  'require_asset_clearance_before_closure',
  'allow_immediate_relieving',
] as const

export function pickSettingsChanges(input: unknown): Partial<OffboardingSettings> {
  const u = (input ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of SETTING_NUMBERS) {
    const n = amount(u[key])
    if (n !== undefined) out[key] = Math.round(n)
  }
  for (const key of SETTING_FLAGS) {
    if (typeof u[key] === 'boolean') out[key] = u[key]
  }
  return out as Partial<OffboardingSettings>
}

// ---------------------------------------------------------------------------
// Reading rows back into the shapes the screens use
// ---------------------------------------------------------------------------

/** The employee fields every case and resignation is shown with. */
export const PERSON_SELECT = 'name, email, team, employee_type, manager_id, employee_types(name), teams(name)'

export type PersonRow = {
  name?: string | null
  email?: string | null
  team?: string | null
  employee_type?: string | null
  manager_id?: string | null
  employee_types?: { name?: string | null } | { name?: string | null }[] | null
  teams?: { name?: string | null } | { name?: string | null }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function personFields(person: PersonRow | PersonRow[] | null | undefined, managers: Map<string, string>) {
  const p = one(person)
  const typeName = one(p?.employee_types)?.name ?? p?.employee_type ?? ''
  return {
    employee_name: p?.name ?? 'Unknown employee',
    employee_email: p?.email ?? '',
    // The directory has no job titles; the employment type is the closest
    // thing it holds.
    employee_designation: typeName,
    employee_department: departmentOf(p) ?? '',
    employee_type: typeName,
    manager_name: (p?.manager_id && managers.get(p.manager_id)) || null,
  }
}

export function managerIdsOf(rows: Array<{ employees?: PersonRow | PersonRow[] | null }>): string[] {
  const ids = rows.map((r) => one(r.employees)?.manager_id).filter((id): id is string => isUuid(id))
  return Array.from(new Set(ids))
}

type CaseRow = Omit<OffboardingCase, keyof ReturnType<typeof personFields>> & { employees?: PersonRow | PersonRow[] | null }

export function toCase(row: CaseRow, managers: Map<string, string>): OffboardingCase {
  const { employees, ...columns } = row
  return { ...columns, ...personFields(employees, managers) } as OffboardingCase
}

type RequestRow = Omit<ResignationRequest, keyof ReturnType<typeof personFields>> & {
  employees?: PersonRow | PersonRow[] | null
}

export function toRequest(row: RequestRow, managers: Map<string, string>): ResignationRequest {
  const { employees, ...columns } = row
  return { ...columns, ...personFields(employees, managers) } as ResignationRequest
}

const NDC_ORDER: Record<string, number> = { manager: 0, it_admin: 1, finance: 2, pnc: 3 }

export function sortNdc(rows: OffboardingNDCDepartment[]): OffboardingNDCDepartment[] {
  return [...rows].sort((a, b) => (NDC_ORDER[a.department] ?? 9) - (NDC_ORDER[b.department] ?? 9))
}

export const DOCUMENT_GENERATED = 'Exit Document Generated'

/**
 * The exit documents, rebuilt from the activity log: each generation is
 * logged with its type and name, and the latest of each type is the current
 * one. There is no document table; the documents are rendered on demand.
 */
export function documentsFrom(logs: OffboardingActivityLog[]): ExitDocument[] {
  const latest = new Map<string, ExitDocument>()
  const ordered = [...logs].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const log of ordered) {
    if (log.action !== DOCUMENT_GENERATED) continue
    const type = log.metadata?.document_type
    if (type !== 'ndc' && type !== 'experience_letter' && type !== 'relieving_letter') continue
    latest.set(type, {
      id: log.id,
      offboarding_id: log.offboarding_id,
      document_type: type,
      document_name: typeof log.metadata?.document_name === 'string' ? log.metadata.document_name : type,
      status: 'generated',
      generated_at: log.created_at,
    })
  }
  return Array.from(latest.values())
}

export function documentName(docType: ExitDocument['document_type'], employeeName: string): string {
  return docType === 'ndc'
    ? `No Dues Certificate — ${employeeName}.pdf`
    : `Relieving & Experience Certificate — ${employeeName}.pdf`
}

/** Exits still under way. */
export const OPEN_CASE_STATUSES: readonly OffboardingStatus[] = [
  'initiated',
  'notice_period',
  'clearance_in_progress',
  'settlement_pending',
]

export function isClearedAsset(a: Pick<OffboardingAssetItem, 'return_status'>): boolean {
  return a.return_status === 'cleared' || a.return_status === 'returned' || a.return_status === 'waived'
}

export function hasOutstandingAssets(assets: Pick<OffboardingAssetItem, 'return_status'>[]): boolean {
  return assets.some((a) => a.return_status === 'pending_return' || a.return_status === 'under_recovery')
}

export function ndcBlockers(ndc: Pick<OffboardingNDCDepartment, 'status' | 'department_label' | 'blocker_reason'>[]): string[] {
  return ndc.filter((n) => n.status !== 'cleared').map((n) => `${n.department_label}: ${n.blocker_reason || n.status}`)
}

// ---------------------------------------------------------------------------
// The resignation decision rules
// ---------------------------------------------------------------------------

export type ResignationPatch = Partial<
  Pick<
    ResignationRequest,
    | 'manager_decision'
    | 'manager_decision_at'
    | 'manager_decision_by'
    | 'manager_notes'
    | 'pnc_decision'
    | 'pnc_decision_at'
    | 'pnc_decision_by'
    | 'pnc_notes'
    | 'hold_until_date'
    | 'retention_notes'
    | 'status'
  >
>

/**
 * What a manager's or PnC's decision does to a resignation: the fields to
 * write, and whether an exit opens. Both accepting opens it; both proposing
 * retention takes it to the employee; one of each is a disagreement PnC
 * resolves; a hold starts the retention window.
 */
export function decideResignation(
  req: Pick<ResignationRequest, 'manager_decision' | 'pnc_decision'>,
  input: {
    reviewerRole: 'manager' | 'pnc'
    decision: ReviewDecision
    notes?: string | null
    holdDays?: number | null
    defaultHoldDays: number
    actor: string
    now: Date
  },
): { patch: ResignationPatch; opensExit: boolean } {
  const nowIso = input.now.toISOString()
  const notes = input.notes || null
  const patch: ResignationPatch =
    input.reviewerRole === 'manager'
      ? { manager_decision: input.decision, manager_decision_at: nowIso, manager_decision_by: input.actor, manager_notes: notes }
      : { pnc_decision: input.decision, pnc_decision_at: nowIso, pnc_decision_by: input.actor, pnc_notes: notes }
  const manager = patch.manager_decision ?? req.manager_decision
  const pnc = patch.pnc_decision ?? req.pnc_decision

  let status: ResignationRequestStatus | undefined
  let opensExit = false
  if (input.decision === 'on_hold' || manager === 'on_hold' || pnc === 'on_hold') {
    const days = input.holdDays && input.holdDays > 0 ? Math.round(input.holdDays) : input.defaultHoldDays
    const until = new Date(input.now.getTime() + days * 86_400_000)
    patch.hold_until_date = until.toISOString().slice(0, 10)
    patch.retention_notes = notes ? `Hold Reason: ${notes}` : `${days}-day retention discussion window initiated.`
    status = 'on_hold'
  } else if (manager === 'accepted' && pnc === 'accepted') {
    status = 'resignation_accepted'
    opensExit = true
  } else if (manager === 'retention_proposed' && pnc === 'retention_proposed') {
    status = 'withdrawal_proposed'
    patch.retention_notes = notes || 'Management proposes retention dialogue and resignation withdrawal.'
  } else if (
    (manager === 'accepted' && pnc === 'retention_proposed') ||
    (manager === 'retention_proposed' && pnc === 'accepted')
  ) {
    status = 'decision_pending'
    patch.retention_notes = `Disagreement between Manager (${manager}) and P&C (${pnc}). Resolution required.`
  } else if (manager === 'accepted' && pnc === 'pending') {
    status = 'pnc_pending'
  } else if (pnc === 'accepted' && manager === 'pending') {
    status = 'manager_pending'
  } else if (manager === 'retention_proposed' || pnc === 'retention_proposed') {
    status = 'withdrawal_proposed'
    patch.retention_notes = notes || 'Retention proposed. Awaiting employee feedback.'
  }
  if (status) patch.status = status
  return { patch, opensExit }
}
