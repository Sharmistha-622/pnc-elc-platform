import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ChevronDown,
  Info,
  User,
} from 'lucide-react'

import { getFormFill } from '@/lib/forms/getFormFill'
import { saveSubmission } from '@/lib/forms/respondentActions'
import { visibleSectionIds } from '@/lib/forms/branching'
import { FormButtons } from './FormButtons'
import { AutoSave } from './AutoSave'
import { FormNotice } from './FormNotice'
import { BranchingForm } from './BranchingForm'
import { asArray, asObject, asString, formatAnswer } from '@/lib/forms/answers'
import { formatDate } from '@/lib/employees/tenure'
import { PageBanner } from '@/components/shared/page-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function FieldInput({
  field,
  value,
  employees,
}: {
  field: any
  value: unknown
  employees: { id: string; name: string }[]
}) {
  const name = `f_${field.id}`
  const choices: string[] = Array.isArray(field.options?.choices) ? field.options.choices : []
  const rows: string[] = Array.isArray(field.options?.rows) ? field.options.rows : []
  const scale = [1, 2, 3, 4, 5]

  switch (field.field_type) {
    case 'short_text':
      return (
        <Input
          name={name}
          defaultValue={asString(value)}
          placeholder="Enter your response…"
          className="w-full max-w-2xl bg-background border-border/80 focus-visible:ring-indigo-500 rounded-lg h-10 text-sm shadow-2xs"
        />
      )

    case 'long_text':
      return (
        <Textarea
          name={name}
          defaultValue={asString(value)}
          rows={4}
          placeholder="Enter your detailed response…"
          className="w-full bg-background border-border/80 focus-visible:ring-indigo-500 rounded-lg text-sm shadow-2xs resize-y min-h-[100px]"
        />
      )

    case 'number':
      return (
        <Input
          name={name}
          type="number"
          step="any"
          defaultValue={asString(value)}
          placeholder="0"
          className="w-full max-w-xs bg-background border-border/80 focus-visible:ring-indigo-500 rounded-lg h-10 text-sm shadow-2xs font-mono"
        />
      )

    case 'date':
      return (
        <Input
          name={name}
          type="date"
          defaultValue={asString(value)}
          className="w-full max-w-xs bg-background border-border/80 focus-visible:ring-indigo-500 rounded-lg h-10 text-sm shadow-2xs font-mono"
        />
      )

    case 'single_select':
      return (
        <div className="relative max-w-md">
          <select
            name={name}
            defaultValue={asString(value)}
            className="w-full h-10 appearance-none rounded-lg border border-border/80 bg-background px-3 py-2 pr-10 text-sm text-foreground shadow-2xs transition-colors hover:border-foreground/30 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">Select an option…</option>
            {choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
        </div>
      )

    case 'multi_select': {
      const picked = asArray(value)
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {choices.map((c) => (
            <label
              key={c}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-sm font-medium text-foreground transition-all hover:bg-muted/40 hover:border-border cursor-pointer select-none has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 dark:has-[:checked]:bg-indigo-950/20 shadow-2xs"
            >
              <input
                type="checkbox"
                name={name}
                value={c}
                defaultChecked={picked.includes(c)}
                className="size-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
              <span className="text-xs sm:text-sm font-medium">{c}</span>
            </label>
          ))}
        </div>
      )
    }

    case 'yes_no':
      return (
        <div className="flex items-center gap-3 pt-1">
          {[
            { val: 'yes', label: 'Yes', icon: CheckCircle2 },
            { val: 'no', label: 'No', icon: XCircle },
          ].map(({ val, label, icon: Icon }) => (
            <label
              key={val}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted/40 hover:border-border cursor-pointer select-none has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 dark:has-[:checked]:bg-indigo-950/20 shadow-2xs min-w-[110px]"
            >
              <input
                type="radio"
                name={name}
                value={val}
                defaultChecked={asString(value) === val}
                className="size-4 border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
              <Icon className="size-4 text-muted-foreground" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )

    case 'rating':
      return (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {scale.map((n) => (
              <label
                key={n}
                className="flex items-center justify-center size-10 rounded-lg border border-border/80 bg-card text-sm font-semibold text-foreground transition-all hover:bg-muted/40 hover:border-border cursor-pointer select-none has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-600 has-[:checked]:text-white shadow-2xs"
              >
                <input
                  type="radio"
                  name={name}
                  value={n}
                  defaultChecked={asString(value) === String(n)}
                  className="sr-only"
                />
                <span>{n}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground max-w-[216px] px-1 font-medium">
            <span>1 = Lowest</span>
            <span>5 = Highest</span>
          </div>
        </div>
      )

    case 'rating_grid': {
      const rated = asObject(value)
      return (
        <div className="overflow-x-auto rounded-lg border border-border/80 bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-xs text-foreground py-3 pl-4">Statement / Criteria</TableHead>
                {scale.map((n) => (
                  <TableHead key={n} className="text-center font-semibold text-xs text-foreground py-3 w-16">
                    {n}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-xs text-foreground py-3 pl-4 max-w-md">
                    {row}
                  </TableCell>
                  {scale.map((n) => (
                    <TableCell key={n} className="text-center py-2 px-1">
                      <label className="flex items-center justify-center p-2 cursor-pointer rounded hover:bg-muted/50">
                        <input
                          type="radio"
                          name={`${name}__${i}`}
                          value={n}
                          defaultChecked={rated[row] === n}
                          className="size-4 border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                        />
                      </label>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground font-medium">
            Scale: 1 = lowest satisfaction &bull; 5 = highest satisfaction
          </div>
        </div>
      )
    }

    case 'employee_picker':
      return (
        <div className="relative max-w-md">
          <select
            name={name}
            defaultValue={asString(value)}
            className="w-full h-10 appearance-none rounded-lg border border-border/80 bg-background px-3 py-2 pr-10 text-sm text-foreground shadow-2xs transition-colors hover:border-foreground/30 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">Choose an employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
        </div>
      )

    default:
      return <p className="text-sm text-red-600">Unsupported field type</p>
  }
}

export default async function FillFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string }>
}) {
  const { id } = await params
  const { error, saved, submitted: justSubmitted } = await searchParams
  const data = await getFormFill(id)

  if (data.state === 'signed_out') redirect('/login')
  if (data.state === 'not_found') notFound()

  if (data.state === 'no_employee' || data.state === 'not_yours') {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
        <div>
          <Link href="/my-forms">
            <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" />
              Back to My Forms
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            {data.state === 'no_employee'
              ? 'Your login email is not linked to an employee record, so this form cannot be opened.'
              : 'This form was not assigned to you.'}
          </div>
        </div>
      </div>
    )
  }

  const blocked = data.expired || data.cancelled || data.closed
  const editable = !data.submitted && !blocked
  const visibleIds = visibleSectionIds(data.sections, data.fields, data.answers)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Top navigation row */}
      <div className="flex items-center justify-between">
        <Link href="/my-forms">
          <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Back to My Forms
          </Button>
        </Link>
        {editable && (
          <div className="hidden sm:block">
            <AutoSave />
          </div>
        )}
      </div>

      {/* Page Banner Header */}
      <PageBanner
        title={data.formName}
        description={
          data.subjectName
            ? `This response is regarding ${data.subjectName}. Please complete all required sections.`
            : 'Please review each section below and provide accurate responses.'
        }
        icon={<FileText className="size-5 text-indigo-600 dark:text-indigo-400" />}
        badge={
          <Badge
            variant={data.submitted ? 'default' : 'outline'}
            className={
              data.submitted
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-none font-medium text-xs'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-medium text-xs'
            }
          >
            {data.submitted ? 'Submitted' : blocked ? 'Closed' : 'Draft in Progress'}
          </Badge>
        }
        actions={
          editable ? (
            <div className="sm:hidden">
              <AutoSave />
            </div>
          ) : undefined
        }
      />

      {/* Status Notices */}
      {error && (
        <FormNotice className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/80 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-xs sm:text-sm">{error.slice(0, 300)}</div>
        </FormNotice>
      )}

      {saved === '1' && (
        <FormNotice className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <CheckCircle2 className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-xs sm:text-sm">Draft saved. Your answers are safely recorded and you can return anytime.</div>
        </FormNotice>
      )}

      {justSubmitted === '1' && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs sm:text-sm font-medium">Thank you! Your response has been submitted successfully.</div>
        </div>
      )}

      {data.expired && !data.submitted && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Clock className="size-5 shrink-0" />
          <div className="text-xs sm:text-sm">This request has expired. Please contact People &amp; Culture if you still need to complete it.</div>
        </div>
      )}

      {data.cancelled && !data.submitted && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <XCircle className="size-5 shrink-0" />
          <div className="text-xs sm:text-sm">This request was cancelled.</div>
        </div>
      )}

      {data.closed && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Info className="size-5 shrink-0" />
          <div className="text-xs sm:text-sm">This form is closed and is no longer accepting responses.</div>
        </div>
      )}

      {/* Read-Only Submitted View */}
      {data.submitted && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="font-semibold text-xs sm:text-sm">Form Submitted</div>
              <div className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
                You submitted this form{data.submittedAt ? ` on ${formatDate(String(data.submittedAt))}` : ''}. It is locked and can no longer be edited.
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {data.sections
              .filter((section) => visibleIds.has(section.id))
              .map((section, sIdx) => (
                <Card key={section.id} className="border-border/80 shadow-xs overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                        {sIdx + 1}
                      </span>
                      <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                    </div>
                    {section.description && (
                      <CardDescription className="text-xs pl-7">{section.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {data.fields
                      .filter((f) => f.section_id === section.id)
                      .map((f) => {
                        const ans = formatAnswer(f, data.answers.get(f.id), data.employeeNames)
                        return (
                          <div key={f.id} className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                              {f.label}
                            </span>
                            <div className="text-sm font-medium text-foreground whitespace-pre-line pt-0.5">
                              {ans || <span className="text-muted-foreground italic">No answer provided</span>}
                            </div>
                          </div>
                        )
                      })}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Editable Form */}
      {editable && (
        <BranchingForm action={saveSubmission} sections={data.sections} fields={data.fields} className="space-y-6">
          <input type="hidden" name="requestId" value={data.requestId} />

          <div className="space-y-6">
            {data.sections.map((section, sIdx) => (
              <Card
                key={section.id}
                data-section-id={section.id}
                hidden={!visibleIds.has(section.id)}
                className="border-border/80 shadow-xs overflow-hidden"
              >
                <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-6 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                      {sIdx + 1}
                    </span>
                    <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                  </div>
                  {section.description && (
                    <CardDescription className="text-xs pt-1 pl-8.5">
                      {section.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {data.fields
                    .filter((f) => f.section_id === section.id)
                    .map((f) => (
                      <div key={f.id} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                            {f.label}
                            {f.is_required && <span className="text-rose-500 font-bold ml-1">*</span>}
                          </label>
                        </div>
                        {f.help_text && (
                          <p className="text-xs text-muted-foreground -mt-1">{f.help_text}</p>
                        )}
                        <FieldInput field={f} value={data.answers.get(f.id)} employees={data.employees} />
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <FormButtons />
        </BranchingForm>
      )}
    </div>
  )
}
