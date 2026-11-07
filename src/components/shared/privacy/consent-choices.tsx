'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export interface ConsentChoice {
  code: string
  label: string
  description: string
}

/**
 * Optional consents: one checkbox per purpose, each unticked until the person
 * ticks it, none bundled with another or with the notice (DPDP Act s. 6(1)).
 * Unticking withdraws, in the same place and as easily (s. 6(4)).
 */
export const ConsentChoices = ({
  purposes,
  given,
  onChange,
  disabled,
}: {
  purposes: ConsentChoice[]
  /** Purpose codes with a live consent. */
  given: string[]
  onChange: (code: string, give: boolean) => void
  disabled?: boolean
}) => {
  if (purposes.length === 0) return null
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-1 text-xs font-semibold text-foreground">Optional: only if you agree</legend>
      {purposes.map((p) => (
        <div key={p.code} className="flex items-start gap-2">
          <Checkbox
            id={`consent-${p.code}`}
            checked={given.includes(p.code)}
            onCheckedChange={(checked) => onChange(p.code, checked === true)}
          />
          <div className="space-y-0.5">
            <Label htmlFor={`consent-${p.code}`} className="text-xs font-medium">{p.label}</Label>
            {p.description && <p className="text-[11px] text-muted-foreground">{p.description}</p>}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">You can change these at any time; saying no changes nothing else.</p>
    </fieldset>
  )
}
