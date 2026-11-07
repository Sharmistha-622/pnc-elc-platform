// ============================================================================
// DPDP: shared types
// ----------------------------------------------------------------------------
// The vocabulary of the data inventory, the retention rules and the settings.
// Values here are stored in the database as text, so each union is mirrored by
// a check constraint in the migrations; change both together.
// ============================================================================

/** What kind of personal data a column holds. */
export const DATA_CATEGORIES = [
  'general',
  'contact',
  'identity',
  'bank',
  'salary',
  'performance',
  'health_adjacent',
  'log',
] as const
export type DataCategory = (typeof DATA_CATEGORIES)[number]

/**
 * A column's classification in the inventory: a personal-data category, or
 * `meta` (keys, timestamps, statuses: not personal on their own), or `none`
 * (configuration and other non-personal values).
 */
export type ColumnClass = DataCategory | 'meta' | 'none'

/** Whose data it is. */
export const PRINCIPAL_TYPES = ['candidate', 'employee', 'contractor', 'volunteer', 'dependant'] as const
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number]

/** Why the platform may process it (DPDP Act s. 4, 6, 7). */
export const LAWFUL_BASES = ['7i', '7a', 'consent', 'legal_obligation'] as const
export type LawfulBasis = (typeof LAWFUL_BASES)[number]

export const LAWFUL_BASIS_LABELS: Record<LawfulBasis, string> = {
  '7i': 's. 7(i) employment purposes',
  '7a': 's. 7(a) voluntarily provided for a specified purpose',
  consent: 's. 6 consent',
  legal_obligation: 'compliance with a law (s. 7(b), s. 8(7))',
}

/** Where it lives. `staged` is core data that seals into the vault. */
export const DATA_STORES = ['core', 'vault', 'staged'] as const
export type DataStore = (typeof DATA_STORES)[number]

/** The processors in the register (`dpdp_processors.code`). */
export const PROCESSOR_CODES = [
  'supabase_core',
  'supabase_vault',
  'google_workspace',
  'google_email',
  'vercel',
] as const
export type ProcessorCode = (typeof PROCESSOR_CODES)[number]

/** Retention rules (`dpdp_retention_rules.id`). */
export const RETENTION_RULE_IDS = [
  'logs',
  'rejected_candidates',
  'withdrawn_joiner_documents',
  'bgv_raw_report',
  'statutory_registers',
  'social_security_registers',
  'payroll_tax',
  'letters',
  'feedback_text',
  'medical_certificates',
  'dependant_nominee',
  'posh_case_files',
  'employment_records',
  'privacy_records',
] as const
export type RetentionRuleId = (typeof RETENTION_RULE_IDS)[number]

/** When a retention clock starts. */
export const CLOCK_STARTS = [
  'event',
  'role_closed',
  'withdrawal',
  'confirmation',
  'last_entry',
  'fy_end',
  'exit',
  'decision',
  'closure',
  'none',
] as const
export type ClockStart = (typeof CLOCK_STARTS)[number]

/** What happens when a record's period has run. */
export const RETENTION_ACTIONS = ['delete', 'anonymise', 'report_only'] as const
export type RetentionAction = (typeof RETENTION_ACTIONS)[number]

/** Dry-run reports what would happen; live does it. */
export const RETENTION_MODES = ['dry_run', 'live'] as const
export type RetentionMode = (typeof RETENTION_MODES)[number]
