'use server'

import { revalidatePath } from 'next/cache'

import { dispatchStep } from '@/lib/onboarding/automation/channels'
import { STEP_DEFINITION_BY_KEY } from '@/lib/onboarding/automation/constants'
import { loadJourneys } from '@/lib/onboarding/automation/loadJourneys'
import { requireFeature } from '@/lib/rbac/requireFeature'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Server actions backing the onboarding dashboard drawer.
 *
 * These are the manual escape hatches the automation deliberately leaves open:
 * recording a credential mail that a human sent, filling in a buddy the HR
 * record doesn't carry, and ticking off an induction task.
 */

export type ActionResult = { success: boolean; error?: string }

/**
 * Records a step as done by hand. Used for the credential email, which carries
 * account access and is therefore never auto-sent.
 */
export async function markStepSent(stepId: string): Promise<ActionResult> {
  if (!stepId) return { success: false, error: 'Missing step' }

  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()

  const { data: step, error: lookupError } = await supabase
    .from('onboarding_steps')
    .select('step_key, onboarding_journeys ( onboarding_record_id )')
    .eq('id', stepId)
    .single()

  if (lookupError || !step) {
    console.error('Failed to load onboarding step:', lookupError?.message)
    return { success: false, error: 'Could not find this step' }
  }

  const { error } = await supabase
    .from('onboarding_steps')
    .update({
      status: 'sent',
      completed_at: now,
      skip_reason: 'Sent manually',
      updated_at: now,
    })
    .eq('id', stepId)

  if (error) {
    console.error('Failed to mark onboarding step sent:', error.message)
    return { success: false, error: 'Could not update this step' }
  }

  // Credential delivery is also tracked on the candidate record, so the hub and
  // the pipeline never disagree about whether the joiner has their login.
  if (step.step_key === 'credential_email') {
    const journey = Array.isArray(step.onboarding_journeys)
      ? step.onboarding_journeys[0]
      : step.onboarding_journeys

    const recordId = (journey as { onboarding_record_id?: string | null } | null)
      ?.onboarding_record_id

    if (recordId) {
      const { error: provisioningError } = await supabase
        .from('employee_account_provisioning')
        .update({ credentials_delivery_status: 'sent' })
        .eq('onboarding_id', recordId)

      if (provisioningError) {
        // The step is already recorded; a stale provisioning row is worth
        // reporting but must not read as a failure to the person who sent it.
        console.error(
          'Failed to sync credential delivery to provisioning:',
          provisioningError.message
        )
      }
    }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

/** Fills in the contacts the automation needs but the HR record may not hold. */
export async function updateJourneyContacts(
  journeyId: string,
  contacts: { managerEmail?: string | null; buddyEmail?: string | null }
): Promise<ActionResult> {
  if (!journeyId) return { success: false, error: 'Missing journey' }

  const supabase = await createServerSupabaseClient()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (contacts.managerEmail !== undefined) {
    patch.manager_email = contacts.managerEmail || null
  }
  if (contacts.buddyEmail !== undefined) {
    patch.buddy_email = contacts.buddyEmail || null
  }

  const { error } = await supabase
    .from('onboarding_journeys')
    .update(patch)
    .eq('id', journeyId)

  if (error) {
    console.error('Failed to update onboarding contacts:', error.message)
    return { success: false, error: 'Could not save these contacts' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

/** Marks an induction task complete or incomplete. */
export async function setTaskCompletion(
  taskId: string,
  isCompleted: boolean
): Promise<ActionResult> {
  if (!taskId) return { success: false, error: 'Missing task' }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('onboarding_tasks')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  if (error) {
    console.error('Failed to update induction task:', error.message)
    return { success: false, error: 'Could not update this task' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

/** Records whether the joiner missed their technical onboarding call. */
export async function setMissedTechCall(
  journeyId: string,
  missed: boolean
): Promise<ActionResult> {
  await requireFeature('onboarding')
  if (!journeyId) return { success: false, error: 'Missing journey' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('onboarding_journeys')
    .update({ missed_tech_call: missed, updated_at: new Date().toISOString() })
    .eq('id', journeyId)

  if (error) {
    console.error('Failed to update missed tech call flag:', error.message)
    return { success: false, error: 'Could not update this journey' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

/** Saves the P&C-written introduction that gets posted to the team channel. */
export async function setSlackIntroText(
  journeyId: string,
  text: string
): Promise<ActionResult> {
  await requireFeature('onboarding')
  if (!journeyId) return { success: false, error: 'Missing journey' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('onboarding_journeys')
    .update({
      slack_intro_text: text.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', journeyId)

  if (error) {
    console.error('Failed to save Slack introduction:', error.message)
    return { success: false, error: 'Could not save the introduction' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

/**
 * Sends one of the two post-meeting emails.
 *
 * These are never scheduled: P&C send them after a technical onboarding call,
 * once they know who attended and who missed it.
 */
export async function sendPostMeetingEmail(
  journeyId: string,
  stepKey: 'tech_resources_email' | 'tech_reminder_email'
): Promise<ActionResult> {
  await requireFeature('onboarding')
  if (!journeyId) return { success: false, error: 'Missing journey' }

  const definition = STEP_DEFINITION_BY_KEY[stepKey]
  if (!definition) return { success: false, error: 'Unknown email' }

  const supabase = await createServerSupabaseClient()
  const journeys = await loadJourneys(supabase)
  const journey = journeys.find((item) => item.context.journeyId === journeyId)

  if (!journey) return { success: false, error: 'Could not find this journey' }

  const step = journey.steps.find((item) => item.stepKey === stepKey)
  if (!step) return { success: false, error: 'This email is not set up yet' }

  if (step.status === 'sent') {
    return { success: false, error: 'This email has already been sent' }
  }

  const outcome = await dispatchStep({
    definition,
    context: journey.context,
    step,
    tasks: journey.tasks,
    siblingSteps: journey.steps,
  })

  const now = new Date().toISOString()

  if (outcome.status === 'sent') {
    await supabase
      .from('onboarding_steps')
      .update({
        status: 'sent',
        completed_at: now,
        external_ref: outcome.externalRef ?? null,
        updated_at: now,
      })
      .eq('id', step.id)

    revalidatePath('/onboarding')
    return { success: true }
  }

  const reason =
    outcome.status === 'failed'
      ? outcome.error
      : outcome.status === 'deferred' || outcome.status === 'skipped'
        ? outcome.reason
        : 'Could not send this email'

  return { success: false, error: reason }
}
