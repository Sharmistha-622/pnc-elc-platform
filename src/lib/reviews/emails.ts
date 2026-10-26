// ============================================================================
// Review cycles — what each email says
// ----------------------------------------------------------------------------
// Pure: subject and HTML only, so the wording can be read and tested in one
// place. Every value that came from a person is escaped. No email ever quotes
// what anyone wrote in a review: they say who is asked for what, and link to
// the place where the reader may see it.
// ============================================================================

import { escapeHtml } from '@/lib/email/sendEmail'
import type { ParticipantRole, ReviewKind } from './types'

export type Mail = { subject: string; body: string }

const kindWord = (kind: ReviewKind) => (kind === 'confirmation' ? 'confirmation' : 'appraisal')

function wrap(paragraphs: string[]): string {
  return `${paragraphs.map((p) => `<p>${p}</p>`).join('')}<p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>`
}

function link(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
}

function due(dueOn: string | null): string {
  return dueOn ? ` Please complete it by <strong>${escapeHtml(dueOn)}</strong>.` : ''
}

/** To the employee: their review has started; reflect and nominate. */
export function selfInvite(o: {
  kind: ReviewKind
  name: string
  url: string
  dueOn: string | null
  minPeers: number
  maxPeers: number
}): Mail {
  const word = kindWord(o.kind)
  return {
    subject: `Your ${word} review is due — self-reflection and peer nominations`,
    body: wrap([
      `Hi ${escapeHtml(o.name)},`,
      `Your ${word} review is due now. Please fill in your self-reflection form, and nominate ${o.minPeers === o.maxPeers ? o.minPeers : `${o.minPeers} to ${o.maxPeers}`} colleagues who know your work to give peer feedback.${due(o.dueOn)}`,
      `Your peers are asked for their feedback as soon as you submit. Your manager is filling in their own review at the same time.`,
      link(o.url, 'Open my review'),
    ]),
  }
}

/** To a nominated peer, or the manager. */
export function reviewerInvite(o: {
  kind: ReviewKind
  role: Exclude<ParticipantRole, 'self'>
  name: string
  subjectName: string
  url: string
  dueOn: string | null
}): Mail {
  const word = kindWord(o.kind)
  const subject = escapeHtml(o.subjectName)
  return o.role === 'peer'
    ? {
        subject: `${o.subjectName} has nominated you for peer feedback`,
        body: wrap([
          `Hi ${escapeHtml(o.name)},`,
          `${subject} has nominated you to give peer feedback for their ${word} review.${due(o.dueOn)}`,
          `Your answers go to their manager and PnC without your name. ${subject} does not see them.`,
          link(o.url, 'Give feedback'),
        ]),
      }
    : {
        subject: `${o.subjectName}'s ${word} review: your manager review`,
        body: wrap([
          `Hi ${escapeHtml(o.name)},`,
          `${subject}'s ${word} review has started. Please fill in your manager review.${due(o.dueOn)}`,
          `You will see their self-reflection and their peers' feedback in My Reviews as it comes in, and PnC will set up a meeting with the two of you once enough is in.`,
          link(o.url, 'Fill in the manager review'),
        ]),
      }
}

/** A reminder to anyone who has not answered yet. */
export function reminder(o: {
  kind: ReviewKind
  role: ParticipantRole
  name: string
  subjectName: string
  url: string
  dueOn: string | null
}): Mail {
  const word = kindWord(o.kind)
  const what =
    o.role === 'self'
      ? `your self-reflection for your ${word} review`
      : o.role === 'peer'
        ? `your peer feedback for ${escapeHtml(o.subjectName)}`
        : `your manager review for ${escapeHtml(o.subjectName)}`
  return {
    subject:
      o.role === 'self'
        ? `Reminder: your ${word} self-reflection`
        : o.role === 'peer'
          ? `Reminder: peer feedback for ${o.subjectName}`
          : `Reminder: manager review for ${o.subjectName}`,
    body: wrap([
      `Hi ${escapeHtml(o.name)},`,
      `A reminder that ${what} is still waiting on you.${due(o.dueOn)}`,
      link(o.url, 'Open it now'),
    ]),
  }
}

/** To PnC: someone has not answered after the reminders ran out. */
export function escalation(o: {
  kind: ReviewKind
  role: ParticipantRole
  respondentName: string
  subjectName: string
  reminders: number
  url: string
}): Mail {
  const word = kindWord(o.kind)
  const subject = escapeHtml(o.subjectName)
  const who =
    o.role === 'self'
      ? `${subject} has not filled in their own self-reflection`
      : o.role === 'manager'
        ? `${escapeHtml(o.respondentName)}, ${subject}'s manager, has not filled in the manager review`
        : `${escapeHtml(o.respondentName)} has not given peer feedback for ${subject}`
  return {
    subject: `Needs PnC: ${o.subjectName}'s ${word} review is stuck`,
    body: wrap([
      `${who}, after ${o.reminders} ${o.reminders === 1 ? 'reminder' : 'reminders'}.`,
      `No more automatic reminders will go to them. You can follow up, send a reminder yourself, or adjust the reviewers from the cycle page.`,
      link(o.url, 'Open the review cycle'),
    ]),
  }
}

/** To PnC: everything needed for the meeting is in. */
export function readyForMeeting(o: {
  kind: ReviewKind
  subjectName: string
  managerName: string | null
  peersDone: number
  peersAsked: number
  meetingNote: string
  url: string
}): Mail {
  const word = kindWord(o.kind)
  return {
    subject: `Ready for meeting: ${o.subjectName}'s ${word} review`,
    body: wrap([
      `${escapeHtml(o.subjectName)}'s self-reflection and ${o.managerName ? `${escapeHtml(o.managerName)}'s` : 'the'} manager review are in, with ${o.peersDone} of ${o.peersAsked} peer reviews.`,
      escapeHtml(o.meetingNote),
      link(o.url, 'Open the review cycle'),
    ]),
  }
}

/** The note that travels with the calendar invitation. */
export function meetingInvite(o: {
  kind: ReviewKind
  subjectName: string
  managerName: string | null
  when: string
  url: string
}): Mail {
  const word = kindWord(o.kind)
  return {
    subject: `${o.kind === 'confirmation' ? 'Confirmation' : 'Appraisal'} review meeting: ${o.subjectName}`,
    body: wrap([
      `A ${word} review meeting for ${escapeHtml(o.subjectName)} with ${o.managerName ? escapeHtml(o.managerName) : 'their manager'} and PnC is set for <strong>${escapeHtml(o.when)}</strong>.`,
      `The calendar invitation is attached. After the meeting the manager records the decision on the platform.`,
      link(o.url, 'Open the review'),
    ]),
  }
}

/** To PnC: the manager has recorded a decision. */
export function decisionRecorded(o: { kind: ReviewKind; subjectName: string; managerName: string; decision: string; url: string }): Mail {
  const word = kindWord(o.kind)
  return {
    subject: `Decision recorded: ${o.subjectName}'s ${word} review`,
    body: wrap([
      `${escapeHtml(o.managerName)} has recorded a decision on ${escapeHtml(o.subjectName)}'s ${word} review: <strong>${escapeHtml(o.decision)}</strong>.`,
      `It is waiting for PnC to review and close.`,
      link(o.url, 'Review the decision'),
    ]),
  }
}

/** To the manager: PnC sent the decision back. */
export function decisionReturned(o: { kind: ReviewKind; managerName: string; subjectName: string; url: string }): Mail {
  const word = kindWord(o.kind)
  return {
    subject: `PnC returned the decision on ${o.subjectName}'s ${word} review`,
    body: wrap([
      `Hi ${escapeHtml(o.managerName)},`,
      `PnC has sent your decision on ${escapeHtml(o.subjectName)}'s ${word} review back to you with a note. Please read it and record the decision again.`,
      link(o.url, 'Open the review'),
    ]),
  }
}
