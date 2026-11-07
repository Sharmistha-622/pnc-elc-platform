'use client'

import { useMemo, useState, useTransition } from 'react'
import { useForm, type FieldValues, type Path, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, HeartHandshake, MapPin, Save, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  BLOOD_GROUPS,
  GENDER_OPTIONS,
  RELATIONS,
  buildPersonalDetailsSchema,
  personalDetailsDefaults,
} from '@/lib/onboarding/personal-details-schema'
import { OPTIONAL_FIELD_LABELS, type OptionalFieldKey, type OptionalFieldSettings } from '@/lib/dpdp/optional-fields'
import type { FullOnboardingData } from '@/lib/onboarding/types'

type Spec = { name: string; label: string; kind?: 'text' | 'tel' | 'date' | 'email' | 'textarea' | 'select'; options?: readonly string[]; placeholder?: string; required?: boolean; optional?: OptionalFieldKey }

/**
 * Step 1 of the portal: personal, address and emergency contact details.
 * Every field starts empty (or with what the candidate already saved); the
 * schema comes from the Data collection settings and the server parses again.
 */
export const PersonalDetailsStep = ({
  token,
  data,
  optionalFields,
  disabled,
  onSaved,
  onGuardianRequired,
}: {
  token: string
  data: FullOnboardingData
  optionalFields: OptionalFieldSettings
  disabled?: boolean
  onSaved: (data: FullOnboardingData, advance: boolean) => void
  /** The joiner is under 18: nothing was saved, and the portal waits for a guardian. */
  onGuardianRequired?: (message: string) => void
}) => {
  const [pending, startTransition] = useTransition()
  const schema = useMemo(() => buildPersonalDetailsSchema(optionalFields, new Date()), [optionalFields])
  const defaults = useMemo(
    () => personalDetailsDefaults(data.personalDetails as unknown as Record<string, unknown>, data.record),
    [data.personalDetails, data.record],
  )
  const [sameAsPermanent, setSameAsPermanent] = useState(!defaults.current_address || defaults.current_address === defaults.permanent_address)
  const form = useForm<FieldValues>({ resolver: zodResolver(schema as never) as Resolver<FieldValues>, defaultValues: defaults })

  const collects = (key?: OptionalFieldKey) => !key || optionalFields[key]?.collect
  const isRequired = (s: Spec) => s.required || (s.optional ? optionalFields[s.optional].required : false)

  const save = (advance: boolean) =>
    form.handleSubmit((values) =>
      startTransition(async () => {
        const details = { ...values }
        if (sameAsPermanent && collects('current_address')) details.current_address = values.permanent_address
        try {
          const res = await fetch(`/api/onboarding/token/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_personal', personal_details: details }),
          })
          const json = await res.json()
          if (json.success) {
            toast.success('Personal details saved')
            onSaved(json.data, advance)
            return
          }
          if (res.status === 409 && json.guardian === 'required') {
            onGuardianRequired?.(json.error)
            return
          }
          for (const [name, message] of Object.entries((json.fieldErrors ?? {}) as Record<string, string>)) {
            form.setError(name as Path<FieldValues>, { message })
          }
          toast.error(json.error ?? 'Could not save your details')
        } catch {
          toast.error('Could not save your details')
        }
      }),
    )()

  const field = (s: Spec) =>
    collects(s.optional) && (
      <FormField
        key={s.name}
        control={form.control}
        name={s.name}
        render={({ field: f }) => (
          <FormItem className={s.kind === 'textarea' ? 'md:col-span-full' : undefined}>
            <FormLabel className="text-xs font-semibold">
              {s.label} {isRequired(s) && <span className="text-rose-700 dark:text-rose-300" aria-hidden="true">*</span>}
            </FormLabel>
            {s.kind === 'select' ? (
              <Select value={f.value || undefined} onValueChange={f.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full rounded-lg"><SelectValue placeholder="Choose" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {s.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <FormControl>
                {s.kind === 'textarea' ? (
                  <Textarea rows={2} className="rounded-lg" placeholder={s.placeholder} {...f} value={f.value ?? ''} />
                ) : (
                  <Input type={s.kind ?? 'text'} className="rounded-lg" placeholder={s.placeholder} {...f} value={f.value ?? ''} />
                )}
              </FormControl>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    )

  return (
    <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <User className="size-5 text-indigo-700 dark:text-indigo-300" />
          1. Personal, Address & Emergency Contact Details
        </CardTitle>
        <CardDescription className="text-xs">
          Fields marked * are required. We ask only for what onboarding needs; leave optional fields blank if you prefer.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={(e) => { e.preventDefault(); save(true) }} noValidate>
          <fieldset disabled={disabled || pending}>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {field({ name: 'full_name', label: 'Full legal name', required: true })}
                {field({ name: 'preferred_name', label: OPTIONAL_FIELD_LABELS.preferred_name, optional: 'preferred_name' })}
                {field({ name: 'date_of_birth', label: 'Date of birth', kind: 'date', required: true })}
                {field({ name: 'gender', label: OPTIONAL_FIELD_LABELS.gender, kind: 'select', options: GENDER_OPTIONS, optional: 'gender' })}
                {field({ name: 'blood_group', label: OPTIONAL_FIELD_LABELS.blood_group, kind: 'select', options: BLOOD_GROUPS, optional: 'blood_group' })}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Personal email</Label>
                  <Input type="email" value={data.record.personal_email ?? ''} disabled className="rounded-lg bg-muted/50 font-mono text-xs" />
                </div>
                {field({ name: 'phone', label: 'Phone / mobile number', kind: 'tel', required: true })}
              </div>

              <div className="p-4 rounded-lg border border-border/70 bg-muted/10 space-y-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                  <MapPin className="size-4 text-indigo-700 dark:text-indigo-300" />
                  <span>Permanent address (as on your ID proof)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {field({ name: 'permanent_address', label: 'Address', kind: 'textarea', placeholder: 'House / flat number, street, locality', required: true })}
                  {field({ name: 'city', label: 'City' })}
                  {field({ name: 'state', label: 'State' })}
                  {field({ name: 'pincode', label: 'Pincode' })}
                </div>
              </div>

              {collects('current_address') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30">
                    <Label htmlFor="same-address" className="text-xs font-bold text-foreground cursor-pointer">
                      My current address is the same as my permanent address
                    </Label>
                    <Switch
                      id="same-address"
                      checked={sameAsPermanent}
                      onCheckedChange={(checked) => {
                        setSameAsPermanent(checked)
                        if (checked) form.setValue('current_address', form.getValues('permanent_address'))
                      }}
                    />
                  </div>
                  {!sameAsPermanent && (
                    <div className="grid grid-cols-1 gap-4">
                      {field({ name: 'current_address', label: OPTIONAL_FIELD_LABELS.current_address, kind: 'textarea', optional: 'current_address' })}
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 rounded-lg border border-border/70 bg-muted/10 space-y-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                  <HeartHandshake className="size-4 text-rose-700 dark:text-rose-300" />
                  <span>Emergency contact</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Please let this person know you have named them. We use their details only in an emergency.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {field({ name: 'emergency_contact_name', label: 'Name', required: true })}
                  {field({ name: 'emergency_contact_relation', label: 'Relationship', kind: 'select', options: RELATIONS, required: true })}
                  {field({ name: 'emergency_contact_phone', label: 'Phone', kind: 'tel', required: true })}
                  {field({ name: 'emergency_contact_email', label: OPTIONAL_FIELD_LABELS.emergency_contact_email, kind: 'email', optional: 'emergency_contact_email' })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/50 flex justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => save(false)} className="gap-1.5 rounded-lg">
                <Save className="size-3.5" />
                <span>{pending ? 'Saving…' : 'Save progress'}</span>
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg">
                <span>Save & continue to documents</span>
                <ChevronRight className="size-4" />
              </Button>
            </CardFooter>
          </fieldset>
        </form>
      </Form>
    </Card>
  )
}
