import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  AuditEvent,
  AuditEventInput,
  AuditModule,
  AuditQueryFilters,
} from './types';
import type { UserRole } from '@/lib/role-constants';

// ============================================================================
// UNIFIED EMPLOYEE AUDIT SERVICE
// ----------------------------------------------------------------------------
// Writes go to `employee_audit_log` when Supabase is reachable and the table
// exists, and always to the in-process mirror so the trail renders in local and
// demo environments. Reads merge both sources and de-duplicate, matching the
// Supabase-with-memory-fallback pattern used by the lifecycle services.
//
// The trail is append-only: this module exposes no update or delete path.
// ============================================================================

const AUDIT_TABLE = 'employee_audit_log';

/**
 * The client an audit write goes through.
 *
 * The service-role client when there is one. Events are recorded from the
 * candidate portal and from cron runs too, and neither carries a session: the
 * database refuses the anonymous role everything, so a session-bound write
 * there was silently dropped. This module is not a server action — nothing in
 * the browser can call it — and it only ever appends.
 */
async function auditWriter() {
  return createAdminSupabaseClient() ?? (await createServerSupabaseClient());
}
const QUERY_TIMEOUT_MS = 3000;

/** In-process mirror, newest first. Bounded so a long-lived dev server cannot grow without limit. */
const MEMORY_AUDIT_LOG: AuditEvent[] = [];
const MEMORY_AUDIT_LIMIT = 5000;

function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email?: string | null) {
  return email ? email.trim().toLowerCase() : null;
}

/** Supabase rejects a non-UUID string on a uuid column; keep those in metadata instead. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuidOrNull(value?: string | null) {
  return value && UUID_RE.test(value) ? value : null;
}

function buildEvent(input: AuditEventInput): AuditEvent {
  const now = new Date().toISOString();
  return {
    id: newId(),

    employee_id: input.subject.employee_id || null,
    employee_email: normalizeEmail(input.subject.employee_email),
    employee_name: input.subject.employee_name || null,

    actor_id: input.actor?.actor_id || null,
    actor_email: normalizeEmail(input.actor?.actor_email),
    actor_name: input.actor?.actor_name || null,
    actor_type: input.actor?.actor_type || 'system',

    module: input.module,
    action: input.action,
    description: input.description,
    severity: input.severity || 'info',

    entity_type: input.entity_type || null,
    entity_id: input.entity_id || null,
    changes: input.changes || null,
    metadata: input.metadata || null,

    occurred_at: input.occurred_at || now,
    created_at: now,
  };
}

function rememberInMemory(event: AuditEvent) {
  MEMORY_AUDIT_LOG.unshift(event);
  if (MEMORY_AUDIT_LOG.length > MEMORY_AUDIT_LIMIT) {
    MEMORY_AUDIT_LOG.length = MEMORY_AUDIT_LIMIT;
  }
}

function toRow(event: AuditEvent) {
  const nonUuidEmployeeId =
    event.employee_id && !asUuidOrNull(event.employee_id) ? event.employee_id : null;

  return {
    employee_id: asUuidOrNull(event.employee_id),
    employee_email: event.employee_email,
    employee_name: event.employee_name,
    actor_id: asUuidOrNull(event.actor_id),
    actor_email: event.actor_email,
    actor_name: event.actor_name,
    actor_type: event.actor_type,
    module: event.module,
    action: event.action,
    description: event.description,
    severity: event.severity,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    changes: event.changes,
    // A non-UUID subject ref (memory-store seed ids) cannot go in the uuid
    // column, so it is preserved in metadata and restored on read.
    metadata: nonUuidEmployeeId
      ? { ...(event.metadata || {}), employee_ref: nonUuidEmployeeId }
      : event.metadata,
    occurred_at: event.occurred_at,
  };
}

function fromRow(row: any): AuditEvent {
  return {
    id: row.id,
    employee_id: row.employee_id || row.metadata?.employee_ref || null,
    employee_email: row.employee_email || null,
    employee_name: row.employee_name || null,
    actor_id: row.actor_id || null,
    actor_email: row.actor_email || null,
    actor_name: row.actor_name || null,
    actor_type: row.actor_type || 'system',
    module: row.module,
    action: row.action,
    description: row.description,
    severity: row.severity || 'info',
    entity_type: row.entity_type || null,
    entity_id: row.entity_id || null,
    changes: row.changes || null,
    metadata: row.metadata || null,
    occurred_at: row.occurred_at || row.created_at,
    created_at: row.created_at,
  };
}

// ----------------------------------------------------------------------------
// WRITE
// ----------------------------------------------------------------------------

/**
 * Append one event to the unified trail.
 *
 * Never throws: auditing must not be able to fail the action it is recording.
 * A dropped Supabase write still leaves the in-memory mirror, and the failure
 * is logged for operators.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<AuditEvent | null> {
  if (!input.subject.employee_id && !input.subject.employee_email) {
    console.warn('[audit] dropped event with no subject:', input.action);
    return null;
  }

  const event = buildEvent(input);
  rememberInMemory(event);

  try {
    const supabase = await auditWriter();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    const { error } = await supabase
      .from(AUDIT_TABLE)
      .insert(toRow(event))
      .abortSignal(controller.signal);

    clearTimeout(timeout);
    if (error) console.warn('[audit] persist failed, kept in memory:', error.message);
  } catch {
    // Timeout, missing table, or no network — the memory mirror holds the event.
  }

  return event;
}

/** Append several events in one round trip. Same no-throw contract as {@link recordAuditEvent}. */
export async function recordAuditEvents(inputs: AuditEventInput[]): Promise<AuditEvent[]> {
  const valid = inputs.filter((i) => i.subject.employee_id || i.subject.employee_email);
  if (valid.length === 0) return [];

  const events = valid.map(buildEvent);
  events.forEach(rememberInMemory);

  try {
    const supabase = await auditWriter();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    const { error } = await supabase
      .from(AUDIT_TABLE)
      .insert(events.map(toRow))
      .abortSignal(controller.signal);

    clearTimeout(timeout);
    if (error) console.warn('[audit] batch persist failed, kept in memory:', error.message);
  } catch {
    // Memory mirror holds the events.
  }

  return events;
}

// ----------------------------------------------------------------------------
// READ
// ----------------------------------------------------------------------------

function matchesFilters(event: AuditEvent, f: AuditQueryFilters): boolean {
  const filterEmail = normalizeEmail(f.employee_email);

  if (f.employee_id || filterEmail) {
    // Subject match is an OR across both keys: candidate-stage events are
    // written before an employee ID is minted, so email is the only link.
    const byId = Boolean(f.employee_id) && event.employee_id === f.employee_id;
    const byEmail = Boolean(filterEmail) && event.employee_email === filterEmail;
    if (!byId && !byEmail) return false;
  }

  if (f.module && f.module !== 'all' && event.module !== f.module) return false;
  if (f.actor_type && f.actor_type !== 'all' && event.actor_type !== f.actor_type) return false;
  if (f.severity && f.severity !== 'all' && event.severity !== f.severity) return false;
  if (f.entity_id && event.entity_id !== f.entity_id) return false;
  if (f.from_date && event.occurred_at < f.from_date) return false;
  if (f.to_date && event.occurred_at > f.to_date) return false;

  if (f.search) {
    const q = f.search.toLowerCase();
    const haystack = [
      event.description,
      event.action,
      event.employee_name,
      event.employee_email,
      event.actor_name,
      event.actor_email,
      event.module,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

/**
 * Read the unified trail. Merges the Supabase table with the in-process mirror
 * and de-duplicates by id, so locally-recorded events show up even when the
 * table is unreachable or has not been migrated yet.
 */
export async function getAuditTrail(filters: AuditQueryFilters = {}): Promise<AuditEvent[]> {
  const limit = filters.limit ?? 500;
  let remote: AuditEvent[] = [];

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    let query = supabase.from(AUDIT_TABLE).select('*');

    const employeeId = asUuidOrNull(filters.employee_id);
    const email = normalizeEmail(filters.employee_email);

    if (employeeId && email) {
      query = query.or(`employee_id.eq.${employeeId},employee_email.eq.${email}`);
    } else if (employeeId) {
      query = query.eq('employee_id', employeeId);
    } else if (email) {
      query = query.eq('employee_email', email);
    }

    if (filters.module && filters.module !== 'all') query = query.eq('module', filters.module);
    if (filters.actor_type && filters.actor_type !== 'all') {
      query = query.eq('actor_type', filters.actor_type);
    }
    if (filters.severity && filters.severity !== 'all') query = query.eq('severity', filters.severity);
    if (filters.entity_id) query = query.eq('entity_id', filters.entity_id);
    if (filters.from_date) query = query.gte('occurred_at', filters.from_date);
    if (filters.to_date) query = query.lte('occurred_at', filters.to_date);

    const { data, error } = await query
      .order('occurred_at', { ascending: false })
      .limit(limit)
      .abortSignal(controller.signal);

    clearTimeout(timeout);
    if (!error && data) remote = data.map(fromRow);
  } catch {
    // Fall through to the memory mirror.
  }

  const local = MEMORY_AUDIT_LOG.filter((e) => matchesFilters(e, filters));

  const byId = new Map<string, AuditEvent>();
  for (const event of [...remote, ...local]) {
    // Remote wins when the same id exists in both.
    if (!byId.has(event.id)) byId.set(event.id, event);
  }

  return Array.from(byId.values())
    .filter((e) => (filters.search ? matchesFilters(e, { search: filters.search }) : true))
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, limit);
}

/** Convenience read for one person's complete cross-module history. */
export async function getEmployeeAuditTrail(
  subject: { employee_id?: string | null; employee_email?: string | null },
  filters: Omit<AuditQueryFilters, 'employee_id' | 'employee_email'> = {}
): Promise<AuditEvent[]> {
  return getAuditTrail({
    ...filters,
    employee_id: subject.employee_id || undefined,
    employee_email: subject.employee_email || undefined,
  });
}

// ----------------------------------------------------------------------------
// WHAT EACH READER SEES
// ----------------------------------------------------------------------------

/**
 * Roles that read an event in full.
 *
 * The trail is reached by everyone in `dataManagement`, the platform roles
 * included, but an event's field changes and metadata carry the values behind
 * it: F&F figures and payment references, rejection and extension reasons,
 * before-and-after values of a person's record. The platform roles hold
 * `performance`, `salary` and `identity` at `none`, and a log line is not a
 * way round that.
 */
const FULL_DETAIL_ROLES: readonly UserRole[] = ['super_admin', 'pnc_admin'];

/**
 * Modules whose sentences describe configuration rather than a person, and so
 * stay readable to the platform roles: maintaining settings and data is their
 * job. Every other module's description can quote a reason or an amount.
 */
const CONFIG_MODULES: readonly AuditModule[] = ['settings', 'data_management'];

const RESTRICTED_DESCRIPTION = 'Details are visible to Super Admin and PnC Admin.';

/** True when the caller may read descriptions, changes and metadata in full. */
export function readsFullAuditDetail(caller: { role: UserRole; originalRole: UserRole }): boolean {
  return FULL_DETAIL_ROLES.includes(caller.role) && FULL_DETAIL_ROLES.includes(caller.originalRole);
}

/**
 * The events as this caller may see them. Who, when, which module and which
 * action are kept for everyone the route admits; the values are not.
 */
export function auditEventsFor(
  events: AuditEvent[],
  caller: { role: UserRole; originalRole: UserRole }
): AuditEvent[] {
  if (readsFullAuditDetail(caller)) return events;
  return events.map((e) => ({
    ...e,
    description: CONFIG_MODULES.includes(e.module) ? e.description : RESTRICTED_DESCRIPTION,
    changes: null,
    metadata: null,
  }));
}

/** Per-module event counts for the current result set, for summary tiles. */
export function summarizeByModule(events: AuditEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, e) => {
    acc[e.module] = (acc[e.module] || 0) + 1;
    return acc;
  }, {});
}

/** Seed hook for the demo/memory store. Replaces the in-process mirror wholesale. */
export function seedMemoryAuditLog(events: AuditEvent[]) {
  MEMORY_AUDIT_LOG.length = 0;
  MEMORY_AUDIT_LOG.push(...events);
}

/** True once anything has been recorded in this process. */
export function hasMemoryAuditEvents() {
  return MEMORY_AUDIT_LOG.length > 0;
}

export type { AuditEvent, AuditEventInput, AuditModule, AuditQueryFilters };
