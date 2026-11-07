'use client'

import { useState, useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { LAWFUL_BASES, LAWFUL_BASIS_LABELS, PRINCIPAL_TYPES } from '@/lib/dpdp/types'
import { purposeSchema, type PurposeInput } from '@/lib/dpdp/settings/schemas'
import { savePurpose } from '@/lib/dpdp/settings/actions'
import type { ConsentPurpose } from '@/lib/dpdp/settings/types'
import { LegalHelp, Panel, reportResult } from './shared'

const EMPTY: PurposeInput = {
  code: '',
  label: '',
  description: '',
  principal_types: ['candidate'],
  lawful_basis: 'consent',
  required: false,
  active: true,
  sort_order: 100,
}

/** Consent purposes: what is asked for, of whom, and on which basis. */
export const PurposesTab = ({ purposes, canEdit }: { purposes: ConsentPurpose[]; canEdit: boolean }) => {
  const [editing, setEditing] = useState<PurposeInput | null>(null)

  return (
    <Panel
      title="Consent purposes"
      description="Each optional purpose is a separate, unticked choice: nothing is pre-ticked and nothing is bundled. Withdrawing is one action, in the same place."
    >
      <LegalHelp refText="s. 6(1), 6(4); r. 3(c)(i)">
        Current employees&apos; data for employment purposes needs no consent (s. 7(i)). Use consent for anything beyond it.
      </LegalHelp>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">Purpose</th>
              <th className="p-2 font-medium">Who</th>
              <th className="p-2 font-medium">Basis</th>
              <th className="p-2 font-medium">Required</th>
              <th className="p-2 font-medium">Status</th>
              {canEdit && <th className="p-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {purposes.map((p) => (
              <tr key={p.code}>
                <td className="p-2">
                  <span className="block font-medium text-foreground">{p.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                </td>
                <td className="p-2">{p.principal_types.join(', ')}</td>
                <td className="p-2">{LAWFUL_BASIS_LABELS[p.lawful_basis]}</td>
                <td className="p-2">{p.required ? 'Required' : 'Optional'}</td>
                <td className="p-2">
                  <Badge variant={p.active ? 'secondary' : 'outline'} className="text-[10px]">{p.active ? 'Active' : 'Off'}</Badge>
                </td>
                {canEdit && (
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p })}>Edit</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && !editing && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(EMPTY)}>
          <Plus className="size-3.5" /> Add a purpose
        </Button>
      )}
      {editing && (
        <PurposeForm
          key={editing.code || 'new'}
          initial={editing}
          isNew={!purposes.some((p) => p.code === editing.code)}
          onDone={() => setEditing(null)}
        />
      )}
    </Panel>
  )
}

const PurposeForm = ({ initial, isNew, onDone }: { initial: PurposeInput; isNew: boolean; onDone: () => void }) => {
  const [pending, startTransition] = useTransition()
  const form = useForm<PurposeInput>({
    resolver: zodResolver(purposeSchema as never) as Resolver<PurposeInput>,
    defaultValues: initial,
  })

  const submit = (values: PurposeInput) =>
    startTransition(async () => {
      const result = await savePurpose(values)
      if (!result.success && result.fieldErrors) {
        for (const [k, m] of Object.entries(result.fieldErrors)) form.setError(k as keyof PurposeInput, { message: m })
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
          <FormField control={form.control} name="label" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Label shown to people</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel className="text-xs">What it means, in plain words</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="principal_types" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Applies to</FormLabel>
              <div className="flex flex-wrap gap-3">
                {PRINCIPAL_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={field.value.includes(t)}
                      onCheckedChange={(c) => field.onChange(c ? [...new Set([...field.value, t])] : field.value.filter((x) => x !== t))}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="lawful_basis" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Lawful basis</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {LAWFUL_BASES.map((b) => <SelectItem key={b} value={b}>{LAWFUL_BASIS_LABELS[b]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="required" render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /></FormControl>
              <FormLabel className="text-xs">Required to proceed (only where the purpose is necessary)</FormLabel>
            </FormItem>
          )} />
          <FormField control={form.control} name="active" render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /></FormControl>
              <FormLabel className="text-xs">Active</FormLabel>
            </FormItem>
          )} />
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" size="sm" disabled={pending}>{pending ? 'Saving…' : 'Save purpose'}</Button>
        </div>
      </form>
    </Form>
  )
}
