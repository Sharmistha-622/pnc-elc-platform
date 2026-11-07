// ============================================================================
// Rights requests: vocabulary (DPDP Act s. 11–14; Rules r. 14)
// ============================================================================

export const REQUEST_TYPES = ['access', 'correction', 'completion', 'updating', 'erasure', 'nomination', 'grievance'] as const
export type RequestType = (typeof REQUEST_TYPES)[number]

export const REQUEST_LABELS: Record<RequestType, { label: string; help: string; ref: string }> = {
  access: { label: 'A summary of my data', help: 'What we hold about you, what we use it for, and who we have shared it with.', ref: 's. 11' },
  correction: { label: 'Correct something', help: 'Something we hold about you is wrong or misleading.', ref: 's. 12(1)' },
  completion: { label: 'Complete something', help: 'Something we hold about you is incomplete.', ref: 's. 12(1)' },
  updating: { label: 'Update something', help: 'Something has changed since you told us.', ref: 's. 12(1)' },
  erasure: { label: 'Erase my data', help: 'We erase what no law requires us to keep, and tell you what we must keep, why and until when.', ref: 's. 12(3)' },
  nomination: { label: 'Nominate someone', help: 'Someone who may use these rights for you if you die or cannot act.', ref: 's. 14' },
  grievance: { label: 'Raise a grievance', help: 'Something about how we handle your data is not right.', ref: 's. 13' },
}

export const REQUEST_STATUSES = ['received', 'in_progress', 'awaiting_info', 'answered', 'closed'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const STATUS_LABELS: Record<RequestStatus, string> = {
  received: 'Received',
  in_progress: 'In progress',
  awaiting_info: 'Waiting for information',
  answered: 'Answered',
  closed: 'Closed',
}

export interface PrivacyRequestRow {
  id: string
  reference: string
  principal_type: string
  principal_ref: string | null
  requester_name: string | null
  requester_email: string | null
  request_type: RequestType
  channel: string
  details: string
  status: RequestStatus
  received_at: string
  due_at: string
  escalated_at: string | null
  acknowledged_at: string | null
  assigned_to: string | null
  answer: string | null
  statute_cited: string | null
  retain_until: string | null
  answered_at: string | null
  answered_by: string | null
  closed_at: string | null
}
