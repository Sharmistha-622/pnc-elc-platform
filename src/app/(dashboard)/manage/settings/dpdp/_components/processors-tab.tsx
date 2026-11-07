'use client'

import { useState, useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DATA_CATEGORIES } from '@/lib/dpdp/types'
import { processorSchema, type ProcessorInput } from '@/lib/dpdp/settings/schemas'
import { saveProcessor } from '@/lib/dpdp/settings/actions'
import type { DpaStatus, Processor } from '@/lib/dpdp/settings/types'
import { LegalHelp, Panel, reportResult } from './shared'

const DPA_LABELS: Record<DpaStatus, string> = {
  not_started: 'Not started',
  requested: 'Requested',
  signed: 'Signed',
  accepted_online: 'Accepted online',
  not_required: 'Not required',
}

/** Processors: the vendor register. */
export const ProcessorsTab = ({ processors, canEdit, today }: { processors: Processor[]; canEdit: boolean; today: string }) => {
  const [editing, setEditing] = useState<ProcessorInput | null>(null)
  const blank: ProcessorInput = { code: '', name: '', purpose: '', data_categories: [], hosting_region: '', dpa_status: 'not_started', dpa_date: '', next_review_date: '', notes: '', active: true }

  return (
    <Panel
      title="Processor register"
      description="Every vendor that touches personal data on our behalf: what for, which data, where it is hosted, and the state of its data processing agreement. Overdue reviews turn the checker amber."
    >
      <LegalHelp refText="s. 8(2); r. 6(1)(f); s. 11(1)(b)">The list is also shown to every person on My Privacy, as who their data is shared with.</LegalHelp>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">Processor</th>
              <th className="p-2 font-medium">Region</th>
              <th className="p-2 font-medium">DPA</th>
              <th className="p-2 font-medium">Next review</th>
              {canEdit && <th className="p-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {processors.map((p) => {
              const overdue = !!p.next_review_date && p.next_review_date < today
              return (
                <tr key={p.code} className="align-top">
                  <td className="p-2">
                    <span className="block font-medium text-foreground">{p.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{p.purpose}</span>
                    <span className="block text-[10px] text-muted-foreground">{p.data_categories.join(', ')}</span>
                  </td>
                  <td className="p-2">{p.hosting_region || '—'}</td>
                  <td className="p-2">
                    <Badge variant={p.dpa_status === 'signed' || p.dpa_status === 'accepted_online' ? 'secondary' : 'outline'} className="text-[10px]">
                      {DPA_LABELS[p.dpa_status]}
                    </Badge>
                    {p.dpa_date && <span className="block text-[10px] text-muted-foreground">{p.dpa_date}</span>}
                  </td>
                  <td className="p-2">
                    {p.next_review_date ? (
                      <span className={overdue ? 'inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300' : ''}>
                        {overdue && <AlertTriangle className="size-3" aria-label="Overdue" />}
                        {p.next_review_date}
                      </span>
                    ) : '—'}
                  </td>
                  {canEdit && (
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p, dpa_date: p.dpa_date ?? '', next_review_date: p.next_review_date ?? '', data_categories: p.data_categories as ProcessorInput['data_categories'] })}>
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {canEdit && !editing && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(blank)}><Plus className="size-3.5" /> Add a processor</Button>
      )}
      {editing && (
        <ProcessorForm key={editing.code || 'new'} initial={editing} isNew={!processors.some((p) => p.code === editing.code)} onDone={() => setEditing(null)} />
      )}
    </Panel>
  )
}

const ProcessorForm = ({ initial, isNew, onDone }: { initial: ProcessorInput; isNew: boolean; onDone: () => void }) => {
  const [pending, startTransition] = useTransition()
  const form = useForm<ProcessorInput>({ resolver: zodResolver(processorSchema as never) as Resolver<ProcessorInput>, defaultValues: initial })

  const submit = (values: ProcessorInput) =>
    startTransition(async () => {
      const result = await saveProcessor(values)
      if (!result.success && result.fieldErrors) {
        for (const [k, m] of Object.entries(result.fieldErrors)) form.setError(k as keyof ProcessorInput, { message: m })
      }
      if (reportResult(result)) onDone()
    })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3 rounded-lg border border-border p-3" noValidate>
        <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2">
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Code</FormLabel><FormControl><Input {...field} readOnly={!isNew} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="purpose" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel className="text-xs">Purpose</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="data_categories" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className="text-xs">Data categories</FormLabel>
              <div className="flex flex-wrap gap-3">
                {DATA_CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-xs">
                    <Checkbox checked={field.value.includes(c)} onCheckedChange={(v) => field.onChange(v ? [...new Set([...field.value, c])] : field.value.filter((x) => x !== c))} />
                    {c.replace('_', ' ')}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="hosting_region" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Hosting region</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="dpa_status" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">DPA status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{Object.entries(DPA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="dpa_date" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">DPA date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="next_review_date" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Next review</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel className="text-xs">Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="active" render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /></FormControl>
              <FormLabel className="text-xs">In use</FormLabel>
            </FormItem>
          )} />
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" size="sm" disabled={pending}>{pending ? 'Saving…' : 'Save processor'}</Button>
        </div>
      </form>
    </Form>
  )
}
