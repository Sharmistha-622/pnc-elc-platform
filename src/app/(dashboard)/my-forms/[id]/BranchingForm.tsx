'use client'

import { useEffect, useRef } from 'react'
import { visibleSectionIds } from '@/lib/forms/branching'

type SectionInfo = { id: string; order_index: number; show_when: unknown }
type FieldInfo = { id: string; section_id: string; field_type: string }

// Wraps the form and shows or hides sections as the respondent answers.
// Hidden sections have their inputs disabled, so nothing from them is sent.
// The server applies the same rules again when the form is saved.
export function BranchingForm({
  action,
  sections,
  fields,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>
  sections: SectionInfo[]
  fields: FieldInfo[]
  className?: string
  children: React.ReactNode
}) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const form = formRef.current
    if (!form) return
    const target: HTMLFormElement = form

    function readAnswers(): Map<string, unknown> {
      const data = new FormData(target)
      const answers = new Map<string, unknown>()
      for (const field of fields) {
        const key = `f_${field.id}`
        if (field.field_type === 'multi_select') {
          answers.set(field.id, data.getAll(key).map((v) => String(v)))
        } else {
          const value = data.get(key)
          answers.set(field.id, value === null ? null : String(value))
        }
      }
      return answers
    }

    function sync() {
      const visible = visibleSectionIds(sections, fields, readAnswers())
      target.querySelectorAll<HTMLElement>('[data-section-id]').forEach((el) => {
        const show = visible.has(el.dataset.sectionId ?? '')
        el.hidden = !show
        el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input, select, textarea'
        ).forEach((input) => {
          input.disabled = !show
        })
      })
    }

    sync()
    target.addEventListener('input', sync)
    target.addEventListener('change', sync)
    return () => {
      target.removeEventListener('input', sync)
      target.removeEventListener('change', sync)
    }
  }, [sections, fields])

  return (
    <form ref={formRef} action={action} className={className}>
      {children}
    </form>
  )
}
