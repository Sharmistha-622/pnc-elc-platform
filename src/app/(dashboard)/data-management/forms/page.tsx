import Link from 'next/link'
import { FileText, Search, Plus, Copy, Archive, ArchiveRestore } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getForms } from '@/lib/forms/getForms'
import { workflowLabel } from '@/lib/forms/types'
import { createForm, archiveForm, restoreForm, duplicateForm } from '@/lib/forms/actions'

type Tab = 'active' | 'published' | 'draft' | 'archived'

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'archived', label: 'Archived' },
]

const statusClass: Record<string, string> = {
  Published: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Draft: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Archived: 'border-border bg-muted text-muted-foreground',
}

function matchesTab(status: string, tab: Tab) {
  if (tab === 'active') return status !== 'Archived'
  if (tab === 'published') return status === 'Published'
  if (tab === 'draft') return status === 'Draft'
  return status === 'Archived'
}

function tabHref(tab: Tab, q: string) {
  const params = new URLSearchParams()
  if (tab !== 'active') params.set('tab', tab)
  if (q) params.set('q', q)
  const query = params.toString()
  return query ? `/data-management/forms?${query}` : '/data-management/forms'
}

const iconButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string; q?: string }>
}) {
  const { error, tab: rawTab, q: rawQ } = await searchParams
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'active'
  const q = (rawQ ?? '').trim()
  const forms = await getForms()

  const searched = q ? forms.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) : forms
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, searched.filter((f) => matchesTab(f.status, t.key)).length])
  ) as Record<Tab, number>
  const visible = searched.filter((f) => matchesTab(f.status, tab))

  let emptyMessage = 'No forms in this view.'
  if (forms.length === 0) emptyMessage = 'No forms yet. Create the first one above.'
  else if (q) emptyMessage = `No forms match "${q}".`
  else if (tab === 'archived') emptyMessage = 'No archived forms.'

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20">
      <PageBanner
        title="Forms"
        description="Create and manage the forms used in the Confirmation and Appraisal workflows."
        icon={<FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error.slice(0, 300)}
        </div>
      )}

      <form action={createForm} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex-1 min-w-56 space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">New form name</label>
          <Input id="name" name="name" required placeholder="e.g. Peer Feedback 2026" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="workflow" className="text-sm font-medium">Workflow</label>
          <select
            id="workflow"
            name="workflow"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Not linked</option>
            <option value="confirmation">Confirmation</option>
            <option value="appraisal">Appraisal</option>
          </select>
        </div>
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Create form
        </Button>
      </form>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav className="inline-flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key, q)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-muted-foreground">{counts[t.key]}</span>
            </Link>
          ))}
        </nav>

        <form method="get" className="relative w-full md:w-72">
          {tab !== 'active' && <input type="hidden" name="tab" value={tab} />}
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search forms…" className="pl-8" />
        </form>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-medium p-3">Name</th>
                <th className="text-left font-medium p-3">Workflow</th>
                <th className="text-left font-medium p-3">Status</th>
                <th className="text-left font-medium p-3">Version</th>
                <th className="text-left font-medium p-3">Updated</th>
                <th className="text-left font-medium p-3">Submissions</th>
                <th className="text-right font-medium p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id} className="border-b last:border-b-0 transition-colors hover:bg-muted/30">
                  <td className="p-3">
                    <Link
                      href={`/data-management/forms/${f.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {f.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">Created {f.createdAt.slice(0, 10)}</div>
                  </td>
                  <td className="p-3 text-muted-foreground">{workflowLabel(f.workflow)}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass[f.status] ?? ''}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="tabular-nums">v{f.version}</span>
                    {f.hasPendingDraft && (
                      <span className="ml-2 inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                        draft in progress
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground tabular-nums">{f.updatedAt.slice(0, 10)}</td>
                  <td className="p-3 tabular-nums">{f.submissionCount}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/data-management/forms/${f.id}`}
                        className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        Open
                      </Link>
                      <form action={duplicateForm}>
                        <input type="hidden" name="formId" value={f.id} />
                        <button type="submit" className={iconButton} title="Duplicate" aria-label={`Duplicate ${f.name}`}>
                          <Copy className="h-4 w-4" />
                        </button>
                      </form>
                      {f.status === 'Archived' ? (
                        <form action={restoreForm}>
                          <input type="hidden" name="formId" value={f.id} />
                          <button type="submit" className={iconButton} title="Restore" aria-label={`Restore ${f.name}`}>
                            <ArchiveRestore className="h-4 w-4" />
                          </button>
                        </form>
                      ) : (
                        <form action={archiveForm}>
                          <input type="hidden" name="formId" value={f.id} />
                          <button
                            type="submit"
                            className={`${iconButton} hover:text-destructive`}
                            title="Archive"
                            aria-label={`Archive ${f.name}`}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
