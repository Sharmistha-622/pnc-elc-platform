// Branching rules: a section can be shown only when an earlier question has a given answer.
// Rule format stored on form_sections.show_when:
//   { "field_id": "<uuid of the question>", "equals": ["answer", "answer"] }
// This file is pure (no server code), so the browser and the server use the same logic.

export type SectionRule = { field_id: string; equals: string[] }

export const RULE_FIELD_TYPES = ['single_select', 'multi_select', 'yes_no'] as const

export function parseRule(raw: unknown): SectionRule | null {
  if (!raw || typeof raw !== 'object') return null
  const rule = raw as { field_id?: unknown; equals?: unknown }
  if (typeof rule.field_id !== 'string' || !Array.isArray(rule.equals)) return null
  return { field_id: rule.field_id, equals: rule.equals.map((v) => String(v)) }
}

function answerValues(answer: unknown): string[] {
  if (answer === null || answer === undefined) return []
  if (Array.isArray(answer)) return answer.map((a) => String(a))
  return [String(answer)]
}

type SectionLike = { id: string; order_index: number; show_when?: unknown }
type FieldLike = { id: string; section_id: string }

// Sections are checked in order. A section is shown when it has no rule, or when the question its
// rule depends on sits in a section that is itself shown and the answer matches.
// Answers given in hidden sections never count.
export function visibleSectionIds(
  sections: SectionLike[],
  fields: FieldLike[],
  answers: Map<string, unknown>
): Set<string> {
  const sectionOfField = new Map<string, string>(fields.map((f) => [f.id, f.section_id]))
  const visible = new Set<string>()
  const ordered = sections.slice().sort((a, b) => a.order_index - b.order_index)

  for (const section of ordered) {
    const rule = parseRule(section.show_when)
    if (!rule) {
      visible.add(section.id)
      continue
    }
    const controllingSection = sectionOfField.get(rule.field_id)
    if (!controllingSection) {
      visible.add(section.id) // the question is gone, so do not hide the section forever
      continue
    }
    if (!visible.has(controllingSection)) continue
    const given = answerValues(answers.get(rule.field_id))
    if (given.some((value) => rule.equals.includes(value))) visible.add(section.id)
  }
  return visible
}

export function ruleChoices(field: { field_type: string; options?: any }): { value: string; label: string }[] {
  if (field.field_type === 'yes_no') {
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]
  }
  const choices: string[] = Array.isArray(field.options?.choices) ? field.options.choices : []
  return choices.map((c) => ({ value: c, label: c }))
}

export function describeRule(rule: SectionRule, fields: { id: string; label: string; field_type: string }[]): string {
  const field = fields.find((f) => f.id === rule.field_id)
  if (!field) return 'The question this section depended on was removed, so it is always shown'
  const labels = rule.equals.map((value) => {
    if (field.field_type === 'yes_no') return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value
    return value
  })
  return `Shown only when "${field.label}" is ${labels.join(' or ')}`
}
