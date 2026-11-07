import type { RequestType } from './types'

// Pure: every function takes the time it works from (rules/testing.md).

export interface RequestPeriods {
  grievance_days: number
  access_days: number
  correction_days: number
  erasure_days: number
  nomination_days: number
}

/** The published period for a request type, in days (Settings → Contact & grievance). */
export function periodDays(type: RequestType, p: RequestPeriods): number {
  switch (type) {
    case 'access':
      return p.access_days
    case 'correction':
    case 'completion':
    case 'updating':
      return p.correction_days
    case 'erasure':
      return p.erasure_days
    case 'nomination':
      return p.nomination_days
    case 'grievance':
      return p.grievance_days
  }
}

/** When a request received at `receivedAt` must be answered by. Never more than 90 days. */
export function dueAt(type: RequestType, receivedAt: Date, p: RequestPeriods): Date {
  const days = Math.min(Math.max(periodDays(type, p), 1), 90)
  return new Date(receivedAt.getTime() + days * 24 * 60 * 60 * 1000)
}

/** 80% of the way from receipt to the due date: when an open request is escalated. */
export function escalationAt(receivedAt: Date, due: Date): Date {
  return new Date(receivedAt.getTime() + 0.8 * (due.getTime() - receivedAt.getTime()))
}

export type DeadlineState = 'closed' | 'on_track' | 'escalate' | 'overdue'

export function deadlineState(
  r: { received_at: string; due_at: string; status: string },
  now: Date,
): DeadlineState {
  if (r.status === 'answered' || r.status === 'closed') return 'closed'
  const received = new Date(r.received_at)
  const due = new Date(r.due_at)
  if (now > due) return 'overdue'
  if (now >= escalationAt(received, due)) return 'escalate'
  return 'on_track'
}

/** Whole days left until the due date (negative once overdue). */
export function daysLeft(dueIso: string, now: Date): number {
  return Math.ceil((new Date(dueIso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}
