import type { StepDefinition } from '@/lib/onboarding/automation/constants'
import type {
  JourneyContext,
  OnboardingStepRecord,
  OnboardingTaskRecord,
} from '@/types/onboarding'

/**
 * Result of attempting to dispatch one step.
 *
 * `deferred` is the important one: the step is not done, but nothing is wrong
 * either — a manager hasn't been assigned yet, Slack isn't configured, the
 * induction tasks aren't finished. It stays `pending` and is retried on the next
 * run, which is how the spreadsheet version behaved.
 */
export type DispatchOutcome =
  | {
      status: 'sent'
      externalRef?: string | null
      /**
       * Facts produced by the dispatch that a later step needs to read — the
       * slot a call actually landed on, and whether it was a placeholder.
       */
      meta?: Record<string, unknown>
    }
  | { status: 'skipped'; reason: string }
  | { status: 'deferred'; reason: string }
  | { status: 'failed'; error: string }

export type DispatchInput = {
  definition: StepDefinition
  context: JourneyContext
  step: OnboardingStepRecord
  tasks: OnboardingTaskRecord[]
  /**
   * The journey's other steps. The Slack welcome announces the time the manager
   * connect was actually booked for, which only the calendar step knows.
   */
  siblingSteps?: OnboardingStepRecord[]
  /**
   * Other joiners sharing this batched session. The first journey in a batch
   * creates the event for everyone; the rest resolve against the same invite.
   */
  batchMates?: JourneyContext[]
}

export type ChannelAdapter = (input: DispatchInput) => Promise<DispatchOutcome>
