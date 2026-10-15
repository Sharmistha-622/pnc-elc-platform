import { getOrgToday } from '@/lib/onboarding/automation/dates'
import { loadJourneys } from '@/lib/onboarding/automation/loadJourneys'
import {
  deriveAttentionReasons,
  deriveChannelProgress,
  deriveTaskProgress,
} from '@/lib/onboarding/automation/progress'
import { deriveStage } from '@/lib/onboarding/automation/schedule'
import {
  INDUCTION_TASKS,
  STEP_DEFINITION_BY_KEY,
} from '@/lib/onboarding/automation/constants'
import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { OnboardingDashboardRow } from '@/types/onboarding'

export type OnboardingDashboardData = {
  rows: OnboardingDashboardRow[]
  totals: {
    total: number
    inProgress: number
    onboarded: number
    needsAttention: number
  }
}

/**
 * Builds the onboarding dashboard: one row per journey, with per-channel
 * progress and attention flags recomputed against today's date.
 */
export const getOnboardingDashboard =
  async (): Promise<OnboardingDashboardData> => {
    const supabase = await createServerSupabaseClient()
    const journeys = await loadJourneys(supabase)
    const today = getOrgToday()

    const rows: OnboardingDashboardRow[] = journeys.map(
      ({ context, steps, tasks }) => {
        const attentionReasons = deriveAttentionReasons(
          context,
          steps,
          tasks,
          today
        )

        return {
          journeyId: context.journeyId,
          employeeId: context.employeeId,
          onboardingRecordId: context.onboardingRecordId,
          employeeName: context.employeeName,
          employeeType: context.employeeType,
          joiningDate: context.joiningDate,
          stage: deriveStage(context, today),
          email: context.officialEmail ?? context.personalEmail,
          emailProgress: deriveChannelProgress(steps, 'email'),
          calendarProgress: deriveChannelProgress(steps, 'calendar'),
          slackProgress: deriveChannelProgress(steps, 'slack'),
          taskProgress: deriveTaskProgress(tasks),
          needsAttention: attentionReasons.length > 0,
          attentionReasons,
          managerEmail: context.managerEmail,
          buddyEmail: context.buddyEmail,
          slackIntroText: context.slackIntroText,
          missedTechCall: context.missedTechCall,
          manualSteps: steps
            .filter(
              (step) =>
                STEP_DEFINITION_BY_KEY[step.stepKey]?.requiresManualReview &&
                step.status === 'pending'
            )
            .map((step) => ({
              id: step.id,
              label:
                STEP_DEFINITION_BY_KEY[step.stepKey]?.label ?? step.stepKey,
              scheduledFor: step.scheduledFor,
            })),
          tasks: tasks.map((task) => ({
            id: task.id,
            label:
              INDUCTION_TASKS.find((item) => item.key === task.taskKey)?.label ??
              task.taskKey,
            isCompleted: task.isCompleted,
          })),
        }
      }
    )

    rows.sort((a, b) => b.joiningDate.localeCompare(a.joiningDate))

    return {
      rows,
      totals: {
        total: rows.length,
        inProgress: rows.filter((row) => row.stage !== 'onboarded').length,
        onboarded: rows.filter((row) => row.stage === 'onboarded').length,
        needsAttention: rows.filter((row) => row.needsAttention).length,
      },
    }
  }
