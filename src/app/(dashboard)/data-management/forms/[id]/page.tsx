import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormBuilderData } from '@/lib/forms/getFormBuilderData'
import { RequestsPanel } from './RequestsPanel'
import { SectionRuleEditor } from './SectionRuleEditor'
import { FIELD_TYPES, fieldTypeLabel, workflowLabel } from '@/lib/forms/types'
import {
  addSection,
  deleteSection,
  addField,
  deleteField,
  publishVersion,
  archiveForm,
  restoreForm,
  duplicateForm,
  createDraftVersion,
} from '@/lib/forms/actions'

function optionSummary(options: any): string {
  if (!options) return ''
  if (Array.isArray(options.choices)) return `Choices: ${options.choices.join(', ')}`
  if (Array.isArray(options.rows)) return `Rate each 1-5: ${options.rows.join(', ')}`
  return ''
}

export default async function FormBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { id } = await params
  const { error, sent } = await searchParams
  const data = await getFormBuilderData(id)
  if (!data) notFound()

  const { form, draft, published, current, sections, fields, submissionCount } = data
  const isArchived = Boolean(form.archived_at)
  const isDraft = Boolean(current && current.status === 'draft')
  const status = isArchived ? 'Archived' : published ? 'Published' : 'Draft'
  const listPath = '/data-management/forms'
  const builderPath = `${listPath}/${form.id}`

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-20">
      <Link href={listPath} className="text-sm text-blue-600 hover:underline">
        &larr; Back to forms
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{form.name}</h1>
          <p className="text-sm text-gray-600">
            Workflow: {workflowLabel(form.workflow)} &middot; Status: {status}
            {published && ` · Live version: v${published.version_number}`}
            {draft && ` · Draft: v${draft.version_number}`}
            {` · Submissions: ${submissionCount}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isArchived && draft && (
            <form action={publishVersion}>
              <input type="hidden" name="formId" value={form.id} />
              <input type="hidden" name="versionId" value={draft.id} />
              <button type="submit" className="bg-black text-white px-4 py-2 rounded text-sm">
                Publish v{draft.version_number}
              </button>
            </form>
          )}
          {!isArchived && !draft && published && (
            <form action={createDraftVersion}>
              <input type="hidden" name="formId" value={form.id} />
              <button type="submit" className="border px-4 py-2 rounded text-sm">
                Edit (creates a new draft)
              </button>
            </form>
          )}
          <form action={duplicateForm}>
            <input type="hidden" name="formId" value={form.id} />
            <input type="hidden" name="returnTo" value={builderPath} />
            <button type="submit" className="border px-4 py-2 rounded text-sm">Duplicate</button>
          </form>
          {isArchived ? (
            <form action={restoreForm}>
              <input type="hidden" name="formId" value={form.id} />
              <input type="hidden" name="returnTo" value={builderPath} />
              <button type="submit" className="border px-4 py-2 rounded text-sm">Restore</button>
            </form>
          ) : (
            <form action={archiveForm}>
              <input type="hidden" name="formId" value={form.id} />
              <input type="hidden" name="returnTo" value={builderPath} />
              <button type="submit" className="border border-red-300 text-red-700 px-4 py-2 rounded text-sm">
                Archive
              </button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error.slice(0, 300)}
        </div>
      )}

      {isArchived && (
        <div className="rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
          This form is archived and cannot receive new submissions. Restore it to use it again.
        </div>
      )}

      {!isDraft && published && !isArchived && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Version {published.version_number} is published and cannot be changed. To make changes,
          use &quot;Edit (creates a new draft)&quot;. Existing submissions keep the version they were
          submitted against.
        </div>
      )}

      {draft && published && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          You are editing draft v{draft.version_number}. Version {published.version_number} stays
          live until you publish this draft.
        </div>
      )}

      {sections.length === 0 && (
        <p className="text-gray-500">
          {isDraft ? 'No sections yet. Add the first section below.' : 'This version has no sections.'}
        </p>
      )}

      <div className="space-y-4">
        {sections.map((section: any) => {
          const sectionFields = fields.filter((f: any) => f.section_id === section.id)
          return (
            <div key={section.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  {section.description && (
                    <p className="text-sm text-gray-600">{section.description}</p>
                  )}
                </div>
                {isDraft && !isArchived && (
                  <form action={deleteSection}>
                    <input type="hidden" name="formId" value={form.id} />
                    <input type="hidden" name="sectionId" value={section.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Delete section
                    </button>
                  </form>
                )}
              </div>

              <SectionRuleEditor
                formId={form.id}
                section={section}
                sections={sections}
                fields={fields}
                editable={isDraft && !isArchived}
              />

              {sectionFields.length === 0 ? (
                <p className="text-sm text-gray-500">No fields in this section yet.</p>
              ) : (
                <ul className="space-y-2">
                  {sectionFields.map((field: any) => (
                    <li key={field.id} className="flex items-start justify-between gap-4 rounded border p-3">
                      <div className="text-sm">
                        <p className="font-medium">
                          {field.label}
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            {fieldTypeLabel(field.field_type)} &middot;{' '}
                            {field.is_required ? 'Required' : 'Optional'}
                          </span>
                        </p>
                        {field.help_text && <p className="text-gray-600">{field.help_text}</p>}
                        {optionSummary(field.options) && (
                          <p className="text-xs text-gray-500">{optionSummary(field.options)}</p>
                        )}
                      </div>
                      {isDraft && !isArchived && (
                        <form action={deleteField}>
                          <input type="hidden" name="formId" value={form.id} />
                          <input type="hidden" name="fieldId" value={field.id} />
                          <button type="submit" className="text-sm text-red-600 hover:underline">
                            Delete
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isDraft && !isArchived && (
                <details className="rounded border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Add a field</summary>
                  <form action={addField} className="mt-3 grid gap-3">
                    <input type="hidden" name="formId" value={form.id} />
                    <input type="hidden" name="versionId" value={current.id} />
                    <input type="hidden" name="sectionId" value={section.id} />
                    <div>
                      <label className="block text-sm font-medium mb-1">Label</label>
                      <input name="label" required className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Field type</label>
                      <select name="fieldType" className="w-full border rounded px-3 py-2">
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Help text (optional)</label>
                      <input name="helpText" className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Choices or items to rate (one per line)
                      </label>
                      <textarea
                        name="options"
                        rows={3}
                        className="w-full border rounded px-3 py-2"
                        placeholder="Only needed for single select, multi select and rating grid"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="isRequired" defaultChecked />
                      Required
                    </label>
                    <div>
                      <button type="submit" className="bg-black text-white px-4 py-2 rounded text-sm">
                        Add field
                      </button>
                    </div>
                  </form>
                </details>
              )}
            </div>
          )
        })}
      </div>

      {isDraft && !isArchived && (
        <form action={addSection} className="rounded-lg border p-4 grid gap-3">
          <h2 className="font-semibold">Add a section</h2>
          <input type="hidden" name="formId" value={form.id} />
          <input type="hidden" name="versionId" value={current.id} />
          <div>
            <label className="block text-sm font-medium mb-1">Section title</label>
            <input name="title" required className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <input name="description" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <button type="submit" className="bg-black text-white px-4 py-2 rounded text-sm">
              Add section
            </button>
          </div>
        </form>
      )}
      {published && !isArchived && (
        <RequestsPanel formId={form.id} publishedVersionId={published.id} sent={sent} />
      )}
    </div>
  )
}
