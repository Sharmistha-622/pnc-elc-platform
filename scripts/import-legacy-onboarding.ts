/**
 * One-off import of the legacy onboarding state into `onboarding_steps`.
 *
 * Reads CSV exports of the Google Sheets trackers and marks the steps that have
 * already happened, so the first run after cutover does not re-send a cohort's
 * entire history. The 5-day late cap would stop most of it, but "most" is not
 * a guarantee anyone should rely on for mail that reaches real people.
 *
 * Usage:
 *   node -r ts-node/register scripts/import-legacy-onboarding.ts --dir ./legacy-export
 *   node -r ts-node/register scripts/import-legacy-onboarding.ts --dir ./legacy-export --confirm
 *
 * Without --confirm it reports what it would change and writes nothing.
 *
 * Expected files in --dir (export each tracker tab as CSV):
 *   communication.csv   Communication Tracker
 *   calendar.csv        Calendar Automation Tracker
 *   tasks.csv           Task Tracking
 *   hr.csv              Notion HR DB (for Last Completed Step)
 *
 * The P&C Operations tab is deliberately not read: it holds the team email
 * password column, and this application never stores credentials.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------- CSV

/** Minimal RFC4180 reader — quoted fields, embedded commas and newlines. */
const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows.filter((entry) => entry.some((cell) => cell !== ''))
  if (!header) return []

  return body.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name.trim(), (cells[index] ?? '').trim()]))
  )
}

// ------------------------------------------------------------- mapping

type ImportedStatus = 'sent' | 'skipped' | 'pending'

/**
 * The sheets recorded completion inconsistently — TRUE, DONE, SENT, YES and
 * COMPLETED all meant the same thing, and DRAFT meant "written but not sent".
 */
const toStatus = (raw: string): { status: ImportedStatus; reason?: string } => {
  const value = raw.trim().toUpperCase()

  if (['TRUE', 'SENT', 'DONE', 'YES', 'COMPLETED', '1'].includes(value)) {
    return { status: 'sent' }
  }
  if (['SKIPPED', 'DROPPED'].includes(value)) {
    return { status: 'skipped', reason: 'Skipped in the legacy tracker' }
  }
  if (value === 'DRAFT') {
    return { status: 'pending', reason: 'Draft created in the legacy system — send by hand' }
  }
  return { status: 'pending' }
}

/** Sheet column -> step key. Columns not listed here are ignored. */
const COLUMN_TO_STEP: Record<string, string> = {
  'Credential Email': 'credential_email',
  'Pre Joining Email': 'pre_joining_email',
  'Access Email': 'access_email',
  'Onboarding Tasks Email': 'onboarding_tasks_email',
  'Week 1 Follow Up': 'week1_followup_email',
  'Week 2 Follow Up': 'week2_followup_email',
  'Milestone Email': 'milestone_email',
  'Slack Welcome': 'slack_welcome',
  'Slack Week1': 'slack_week1',
  'Slack Week2': 'slack_week2',
  Congratulations: 'slack_congratulations',
  'Slack Reminder': 'slack_reminder',
  'Manager Done': 'manager_connect',
  'Buddy Done': 'buddy_connect',
  'Tech Done': 'technical_onboarding',
  'Warm Done': 'warm_onboarding',
  'P&C Checkin Done': 'pnc_checkin',
}

const EMAIL_COLUMNS = ['Official Email', 'Personal Email', 'Employee Email']

const emailOf = (row: Record<string, string>): string | null => {
  for (const column of EMAIL_COLUMNS) {
    const value = row[column]?.trim().toLowerCase()
    if (value) return value
  }
  return null
}

// ---------------------------------------------------------------- main

const main = async () => {
  const args = process.argv.slice(2)
  const dirIndex = args.indexOf('--dir')
  const dir = dirIndex >= 0 ? args[dirIndex + 1] : null
  const confirmed = args.includes('--confirm')

  if (!dir) {
    console.error('Usage: --dir <export directory> [--confirm]')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(1)
  }

  console.info(
    confirmed
      ? '\n*** WRITING to the database ***\n'
      : '\nDry run — nothing will be written. Re-run with --confirm to apply.\n'
  )

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Map every known email to its journey.
  const { data: journeys, error } = await supabase
    .from('onboarding_journeys')
    .select('id, official_email, personal_email, candidate_name')

  if (error) {
    console.error('Could not read journeys:', error.message)
    process.exit(1)
  }

  const journeyByEmail = new Map<string, string>()
  for (const journey of journeys ?? []) {
    for (const email of [journey.official_email, journey.personal_email]) {
      if (email) journeyByEmail.set(String(email).toLowerCase(), journey.id as string)
    }
  }

  const updates: { journeyId: string; stepKey: string; status: ImportedStatus; reason?: string }[] = []
  const unmatched = new Set<string>()

  for (const file of ['communication.csv', 'calendar.csv']) {
    const path = join(dir, file)
    if (!existsSync(path)) {
      console.warn(`- ${file} not found, skipping`)
      continue
    }

    for (const row of parseCsv(readFileSync(path, 'utf8'))) {
      const email = emailOf(row)
      if (!email) continue

      const journeyId = journeyByEmail.get(email)
      if (!journeyId) {
        unmatched.add(email)
        continue
      }

      for (const [column, stepKey] of Object.entries(COLUMN_TO_STEP)) {
        if (!(column in row)) continue
        const { status, reason } = toStatus(row[column])
        if (status === 'pending' && !reason) continue
        updates.push({ journeyId, stepKey, status, reason })
      }
    }
  }

  console.info(`Matched updates: ${updates.length}`)
  console.info(`Unmatched emails: ${unmatched.size}`)
  if (unmatched.size > 0) {
    console.info('  ' + Array.from(unmatched).slice(0, 20).join('\n  '))
    if (unmatched.size > 20) console.info(`  ...and ${unmatched.size - 20} more`)
  }

  if (!confirmed) {
    console.info('\nDry run complete. No changes written.')
    return
  }

  let applied = 0
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('onboarding_steps')
      .update({
        status: update.status,
        completed_at: update.status === 'sent' ? new Date().toISOString() : null,
        skip_reason: update.reason ?? 'Imported from the legacy tracker',
        updated_at: new Date().toISOString(),
      })
      .eq('journey_id', update.journeyId)
      .eq('step_key', update.stepKey)
      // Never overwrite something this system already did.
      .eq('status', 'pending')

    if (updateError) {
      console.error(`  failed ${update.stepKey}: ${updateError.message}`)
      continue
    }
    applied += 1
  }

  console.info(`\nApplied ${applied} of ${updates.length} updates.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
