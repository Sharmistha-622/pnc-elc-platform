import { RULE_3_ELEMENTS } from './constants'

// ============================================================================
// Notices and breach templates: the pure parts
// ----------------------------------------------------------------------------
// A notice is stored as one text per section (`dpdp_notices.sections`), so
// the Rule 3 checklist can be checked by key rather than by guessing at prose.
// The privacy contact and the grievance period are not typed into a notice:
// the renderer adds them from settings, so they are always current.
// ============================================================================

export const PRIVACY_NOTICE_TYPES = ['candidate', 'employee', 'contractor_volunteer'] as const
export const BREACH_TEMPLATE_TYPES = ['breach_individual', 'breach_board', 'breach_certin'] as const
export type PrivacyNoticeType = (typeof PRIVACY_NOTICE_TYPES)[number]
export type BreachTemplateType = (typeof BREACH_TEMPLATE_TYPES)[number]
export type NoticeType = PrivacyNoticeType | BreachTemplateType

export const NOTICE_LABELS: Record<NoticeType, string> = {
  candidate: 'Candidate notice',
  employee: 'Employee notice',
  contractor_volunteer: 'Contractor and volunteer notice',
  breach_individual: 'Breach message to affected people',
  breach_board: 'Breach report to the Data Protection Board',
  breach_certin: 'Incident report to CERT-In',
}

export function isPrivacyNotice(type: NoticeType): type is PrivacyNoticeType {
  return (PRIVACY_NOTICE_TYPES as readonly string[]).includes(type)
}

/** English and the Eighth Schedule languages (DPDP Act s. 5(3)). */
export const NOTICE_LANGUAGES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  as: 'অসমীয়া (Assamese)',
  bn: 'বাংলা (Bengali)',
  brx: 'बड़ो (Bodo)',
  doi: 'डोगरी (Dogri)',
  gu: 'ગુજરાતી (Gujarati)',
  kn: 'ಕನ್ನಡ (Kannada)',
  ks: 'کٲشُر (Kashmiri)',
  kok: 'कोंकणी (Konkani)',
  mai: 'मैथिली (Maithili)',
  ml: 'മലയാളം (Malayalam)',
  mni: 'মৈতৈলোন্ (Manipuri)',
  mr: 'मराठी (Marathi)',
  ne: 'नेपाली (Nepali)',
  or: 'ଓଡ଼ିଆ (Odia)',
  pa: 'ਪੰਜਾਬੀ (Punjabi)',
  sa: 'संस्कृतम् (Sanskrit)',
  sat: 'ᱥᱟᱱᱛᱟᱲᱤ (Santali)',
  sd: 'سنڌي (Sindhi)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  ur: 'اردو (Urdu)',
}

export interface NoticeSection {
  key: string
  label: string
  required: boolean
  /** The rule a section satisfies, shown in the checklist. */
  ref?: string
  hint: string
}

const RULE3 = Object.fromEntries(RULE_3_ELEMENTS.map((e) => [e.key, e])) as Record<
  (typeof RULE_3_ELEMENTS)[number]['key'],
  (typeof RULE_3_ELEMENTS)[number]
>

/** The sections of a privacy notice, in reading order. */
export const PRIVACY_SECTIONS: NoticeSection[] = [
  { key: 'who_we_are', label: 'Who we are', required: true, ref: 'r. 3(a) standalone', hint: 'The Data Fiduciary: NavGurukul Foundation for Social Welfare, and what this notice is for.' },
  { key: 'data_items', label: RULE3.data_items.label, required: true, ref: RULE3.data_items.ref, hint: 'List each kind of data, one per line.' },
  { key: 'purposes', label: RULE3.purposes.label, required: true, ref: RULE3.purposes.ref, hint: 'What each kind of data is used for, and what that lets us do.' },
  { key: 'optional_uses', label: 'Optional uses we ask about separately', required: false, hint: 'Uses that need your consent, each asked about on its own.' },
  { key: 'sharing', label: 'Who we share it with', required: true, ref: 's. 11(1)(b)', hint: 'The processors in the register, and authorities where a law requires it.' },
  { key: 'retention', label: 'How long we keep it', required: true, ref: 's. 8(7)', hint: 'In plain words, from the retention schedule.' },
  { key: 'rights_how', label: RULE3.rights_how.label, required: true, ref: RULE3.rights_how.ref, hint: 'Where to ask (My Privacy, or the portal), and the identifier to give.' },
  { key: 'withdraw_how', label: RULE3.withdraw_how.label, required: true, ref: RULE3.withdraw_how.ref, hint: 'The same place, one action, as easy as giving consent.' },
  { key: 'complaint_how', label: RULE3.complaint_how.label, required: true, ref: RULE3.complaint_how.ref, hint: 'After using our grievance process, you may complain to the Board. The link is added from settings.' },
]

/** The placeholders each breach template must carry. */
export const BREACH_PLACEHOLDERS: Record<BreachTemplateType, { key: string; label: string; ref: string }[]> = {
  breach_individual: [
    { key: 'description', label: 'Description: nature, extent and timing', ref: 'r. 7(1)(a)' },
    { key: 'consequences', label: 'Likely consequences for you', ref: 'r. 7(1)(b)' },
    { key: 'mitigation', label: 'Measures taken to mitigate the risk', ref: 'r. 7(1)(c)' },
    { key: 'safety_steps', label: 'Steps you can take', ref: 'r. 7(1)(d)' },
    { key: 'contact', label: 'Contact of a person who can answer', ref: 'r. 7(1)(e)' },
  ],
  breach_board: [
    { key: 'description', label: 'Nature, extent and timing', ref: 'r. 7(2)(a)' },
    { key: 'location', label: 'Location', ref: 'r. 7(2)(a)' },
    { key: 'consequences', label: 'Likely impact', ref: 'r. 7(2)(a)' },
    { key: 'mitigation', label: 'Measures to mitigate risk', ref: 'r. 7(2)(b)(ii)' },
    { key: 'cause', label: 'Findings about the person who caused it', ref: 'r. 7(2)(b)(iii)' },
    { key: 'intimations', label: 'Report on intimations to affected people', ref: 'r. 7(2)(b)(v)' },
    { key: 'contact', label: 'Contact', ref: 'r. 7(2)' },
  ],
  breach_certin: [
    { key: 'description', label: 'Description of the incident', ref: 'CERT-In Directions (ii)' },
    { key: 'detected_at', label: 'When it was noticed', ref: 'CERT-In Directions (ii)' },
    { key: 'systems', label: 'Systems affected', ref: 'CERT-In Directions (ii)' },
    { key: 'mitigation', label: 'Action taken', ref: 'CERT-In Directions (ii)' },
    { key: 'contact', label: 'Point of contact', ref: 'CERT-In Directions (vi)' },
  ],
}

/** The sections a notice of this type has. Breach templates have one body. */
export function sectionsFor(type: NoticeType): NoticeSection[] {
  if (isPrivacyNotice(type)) return PRIVACY_SECTIONS
  return [{ key: 'body', label: 'Message', required: true, hint: 'Use the placeholders below; each must appear.' }]
}

export type NoticeSections = Record<string, string>

export interface ChecklistItem {
  key: string
  label: string
  ref?: string
  ok: boolean
}

/**
 * What must be true before a version can be published. A privacy notice
 * needs every required section and a privacy contact (added from settings);
 * a breach template needs every placeholder.
 */
export function noticeChecklist(
  type: NoticeType,
  sections: NoticeSections,
  context: { contactSet: boolean },
): ChecklistItem[] {
  if (isPrivacyNotice(type)) {
    const items: ChecklistItem[] = PRIVACY_SECTIONS.filter((s) => s.required).map((s) => ({
      key: s.key,
      label: s.label,
      ref: s.ref,
      ok: (sections[s.key] ?? '').trim().length >= 10,
    }))
    items.push({
      key: 'contact',
      label: 'The Privacy & Grievance Officer contact is set (added to every notice)',
      ref: 's. 8(9); r. 9',
      ok: context.contactSet,
    })
    return items
  }
  const body = sections.body ?? ''
  return BREACH_PLACEHOLDERS[type].map((p) => ({
    key: p.key,
    label: `${p.label}: {{${p.key}}}`,
    ref: p.ref,
    ok: body.includes(`{{${p.key}}}`),
  }))
}

export function checklistPasses(items: ChecklistItem[]): boolean {
  return items.every((i) => i.ok)
}

/** A notice as plain text, section by section: what the diff compares. */
export function noticeText(type: NoticeType, sections: NoticeSections): string {
  return sectionsFor(type)
    .filter((s) => (sections[s.key] ?? '').trim())
    .map((s) => `## ${s.label}\n${(sections[s.key] ?? '').trim()}`)
    .join('\n\n')
}

export type DiffLine = { op: 'same' | 'add' | 'del'; text: string }

/** A line diff (longest common subsequence). Notices are short enough for O(n·m). */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : []
  const b = after ? after.split('\n') : []
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ op: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: 'del', text: a[i++] })
    } else {
      out.push({ op: 'add', text: b[j++] })
    }
  }
  while (i < a.length) out.push({ op: 'del', text: a[i++] })
  while (j < b.length) out.push({ op: 'add', text: b[j++] })
  return out
}

/** Fills `{{key}}` placeholders. Unknown placeholders are left visible. */
export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? values[key] : match))
}

/** The next version number for a notice type and language. */
export function nextVersion(existing: { version: number }[]): number {
  return existing.reduce((max, n) => Math.max(max, n.version), 0) + 1
}
