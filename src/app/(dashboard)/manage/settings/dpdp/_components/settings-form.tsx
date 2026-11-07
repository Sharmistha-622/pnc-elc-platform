'use client'

import React, { useTransition } from 'react'
import { useForm, type FieldValues, type Path, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { ActionResult } from '@/lib/dpdp/settings/types'
import { Scale } from 'lucide-react'
import { reportResult } from './shared'

export interface FieldSpec {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'url' | 'number' | 'textarea'
  help?: string
  refText?: string
  placeholder?: string
  /** Shown after a number input, e.g. "days". */
  unit?: string
}

/**
 * A settings form: react-hook-form with the zod schema the server action
 * parses again. Field-level errors from the server land on the same fields.
 */
export const SettingsForm = ({
  schema,
  defaults,
  fields,
  action,
  canEdit,
  submitLabel = 'Save',
  columns = 2,
}: {
  schema: z.ZodType
  defaults: FieldValues
  fields: FieldSpec[]
  action: (input: unknown) => Promise<ActionResult>
  canEdit: boolean
  submitLabel?: string
  columns?: 1 | 2
}) => {
  const [pending, startTransition] = useTransition()
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as never) as Resolver<FieldValues>,
    defaultValues: defaults,
  })

  const onSubmit = (values: FieldValues) =>
    startTransition(async () => {
      const result = await action(values)
      if (!result.success && result.fieldErrors) {
        for (const [name, message] of Object.entries(result.fieldErrors)) {
          form.setError(name as Path<FieldValues>, { message })
        }
      }
      if (reportResult(result)) form.reset(values)
    })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <fieldset disabled={!canEdit || pending} className={columns === 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
          {fields.map((f) => (
            <FormField
              key={f.name}
              control={form.control}
              name={f.name}
              render={({ field }) => (
                <FormItem className={f.type === 'textarea' ? 'md:col-span-2' : undefined}>
                  <FormLabel className="text-xs">{f.label}</FormLabel>
                  <FormControl>
                    {f.type === 'textarea' ? (
                      <Textarea rows={4} placeholder={f.placeholder} {...field} value={field.value ?? ''} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type={f.type ?? 'text'}
                          inputMode={f.type === 'number' ? 'numeric' : undefined}
                          placeholder={f.placeholder}
                          {...field}
                          value={field.value ?? ''}
                        />
                        {f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
                      </div>
                    )}
                  </FormControl>
                  {(f.help || f.refText) && (
                    <FormDescription className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                      <Scale className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      <span>
                        {f.help}
                        {f.refText && <span className="ml-1 font-medium text-foreground/80">({f.refText})</span>}
                      </span>
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </fieldset>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending || !form.formState.isDirty}>
              {pending ? 'Saving…' : submitLabel}
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
