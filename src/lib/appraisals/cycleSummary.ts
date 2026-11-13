import {
  DEFAULT_REVIEW_CYCLE_SETTINGS,
  type CycleRow,
  type ReviewCycleSettings,
} from '@/lib/reviews/types'
import { DEFAULT_APPRAISAL_CYCLES, type AppraisalCycle } from '@/lib/settings/types'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export function monthName(monthNumber: number): string {
  return MONTH_NAMES[Math.max(1, Math.min(12, monthNumber)) - 1]
}

export type AppraisalFooterCard = {
  name: string
  title: string
  description: string
  isActive: boolean
}

export function formatAppraisalWindowFooter(
  cycle: Pick<
    AppraisalCycle,
    'name' | 'display_name' | 'cycle_month' | 'cohort_start_month' | 'cohort_end_month' | 'is_active'
  >,
  reviewSettings?: Partial<Pick<ReviewCycleSettings, 'appraisal_lead_days'>> | null
): AppraisalFooterCard {
  const startMonth = monthName(cycle.cohort_start_month)
  const endMonth = monthName(cycle.cohort_end_month)
  const reviewMonth = monthName(cycle.cycle_month)
  const leadDays =
    reviewSettings?.appraisal_lead_days ?? DEFAULT_REVIEW_CYCLE_SETTINGS.appraisal_lead_days

  const title = `${cycle.display_name} Cadence`
  if (!cycle.is_active) {
    return {
      name: cycle.name,
      title,
      description: `${cycle.display_name} (${startMonth} to ${endMonth} cohort) is currently disabled in Settings › Appraisal.`,
      isActive: false,
    }
  }

  return {
    name: cycle.name,
    title,
    description: `Covers employees whose reference eligibility date falls between ${startMonth} and ${endMonth}. Review cycles open ${leadDays} days before the ${reviewMonth} appraisal window.`,
    isActive: true,
  }
}

export function buildAppraisalFooterCards(
  cycles?: AppraisalCycle[] | null,
  reviewSettings?: Partial<Pick<ReviewCycleSettings, 'appraisal_lead_days'>> | null
): AppraisalFooterCard[] {
  const source = cycles && cycles.length > 0 ? cycles : DEFAULT_APPRAISAL_CYCLES
  return source.map((c) => formatAppraisalWindowFooter(c, reviewSettings))
}

export type AppraisalCycleStatusSummary = {
  badge: string
  subtitle: string
  tone: 'active' | 'completed' | 'scheduled' | 'paused'
}

export function deriveAppraisalCycleStatus(input?: {
  reviewCycles?: Pick<CycleRow, 'stage'>[] | null
  appraisalCycles?: Pick<AppraisalCycle, 'display_name' | 'cycle_month' | 'is_active'>[] | null
}): AppraisalCycleStatusSummary {
  const reviewCycles = input?.reviewCycles ?? []
  const appraisalCycles =
    input?.appraisalCycles && input.appraisalCycles.length > 0
      ? input.appraisalCycles
      : DEFAULT_APPRAISAL_CYCLES

  const openCount = reviewCycles.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'cancelled'
  ).length
  const closedCount = reviewCycles.filter((c) => c.stage === 'closed').length

  if (openCount > 0) {
    return {
      badge: `${openCount} In Progress`,
      subtitle: closedCount > 0 ? `${closedCount} completed` : 'Active appraisal reviews',
      tone: 'active',
    }
  }

  if (closedCount > 0) {
    return {
      badge: 'Completed',
      subtitle: `${closedCount} review ${closedCount === 1 ? 'cycle' : 'cycles'} closed`,
      tone: 'completed',
    }
  }

  const activeWindows = appraisalCycles.filter((c) => c.is_active)
  if (activeWindows.length === 0) {
    return {
      badge: 'Paused',
      subtitle: 'No active appraisal windows in Settings',
      tone: 'paused',
    }
  }

  return {
    badge: 'Scheduled',
    subtitle: activeWindows.map((w) => `${w.display_name} (${monthName(w.cycle_month)})`).join(' · '),
    tone: 'scheduled',
  }
}
