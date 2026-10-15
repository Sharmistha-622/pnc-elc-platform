import { setSectionRule, clearSectionRule } from '@/lib/forms/branchingActions'
import { RULE_FIELD_TYPES, describeRule, parseRule, ruleChoices } from '@/lib/forms/branching'

export function SectionRuleEditor({
  formId,
  section,
  sections,
  fields,
  editable,
}: {
  formId: string
  section: any
  sections: any[]
  fields: any[]
  editable: boolean
}) {
  const rule = parseRule(section.show_when)

  // Only questions in earlier sections can be used as a condition
  const earlierSectionIds = new Set(
    sections.filter((s) => s.order_index < section.order_index).map((s) => s.id as string)
  )
  const candidates = fields.filter(
    (f) =>
      earlierSectionIds.has(f.section_id) &&
      RULE_FIELD_TYPES.some((t) => t === f.field_type) &&
      ruleChoices(f).length > 0
  )

  return (
    <div className="rounded border border-dashed p-3 text-sm space-y-2">
      <p className={rule ? 'font-medium text-indigo-700' : 'text-gray-500'}>
        {rule ? describeRule(rule, fields) : 'Always shown'}
      </p>

      {editable && (
        <details>
          <summary className="cursor-pointer text-blue-600">
            {rule ? 'Change when this section is shown' : 'Show this section only when…'}
          </summary>

          {candidates.length === 0 ? (
            <p className="mt-2 text-gray-500">
              To use a condition, add a Single select, Multi select or Yes / No question in an earlier
              section first.
            </p>
          ) : (
            <form action={setSectionRule} className="mt-3 space-y-3">
              <input type="hidden" name="formId" value={formId} />
              <input type="hidden" name="sectionId" value={section.id} />
              <p className="text-gray-600">Pick the question, then tick the answers that should show this section.</p>
              {candidates.map((field) => (
                <fieldset key={field.id} className="rounded border p-3 space-y-2">
                  <label className="flex items-center gap-2 font-medium">
                    <input type="radio" name="fieldId" value={field.id} defaultChecked={rule?.field_id === field.id} />
                    {field.label}
                  </label>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 pl-6">
                    {ruleChoices(field).map((choice) => (
                      <label key={choice.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name={`values_${field.id}`}
                          value={choice.value}
                          defaultChecked={rule !== null && rule.field_id === field.id && rule.equals.includes(choice.value)}
                        />
                        {choice.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button type="submit" className="bg-black text-white px-3 py-1.5 rounded text-sm">
                Save condition
              </button>
            </form>
          )}

          {rule && (
            <form action={clearSectionRule} className="mt-2">
              <input type="hidden" name="formId" value={formId} />
              <input type="hidden" name="sectionId" value={section.id} />
              <button type="submit" className="text-red-600 hover:underline">
                Remove condition (always show)
              </button>
            </form>
          )}
        </details>
      )}
    </div>
  )
}
