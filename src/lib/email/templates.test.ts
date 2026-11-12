import { describe, expect, it, vi } from 'vitest'
import {
  EMAIL_TEMPLATE_ALLOWLIST,
  SEEDED_EMAIL_TEMPLATES,
  isForbiddenEmailVariable,
  renderEmailBody,
  renderEmailSubject,
  resolveEmailTemplate,
  type StoredTemplateRecord,
} from './templates'

describe('Email Center templates (#161)', () => {
  it('has a seeded template and an allow-list for every platform email key', () => {
    expect(SEEDED_EMAIL_TEMPLATES.length).toBeGreaterThanOrEqual(23)

    for (const tmpl of SEEDED_EMAIL_TEMPLATES) {
      const allowed = EMAIL_TEMPLATE_ALLOWLIST[tmpl.key]
      expect(allowed, `Missing allow-list for ${tmpl.key}`).toBeDefined()
      for (const variable of tmpl.available_variables) {
        expect(isForbiddenEmailVariable(variable)).toBe(false)
        expect(allowed).toContain(variable)
      }
    }
  })

  it.each(SEEDED_EMAIL_TEMPLATES.map((t) => [t.key, t] as const))(
    'uses the active email_templates subject and body for key "%s"',
    async (key, seeded) => {
      const sampleVars: Record<string, string> = {}
      for (const variable of seeded.available_variables) {
        sampleVars[variable] = `val_${variable}`
      }

      const firstVar = seeded.available_variables[0] ?? 'employee_name'
      const customTemplate: StoredTemplateRecord = {
        key,
        subject: `[Custom ${key}] {{${firstVar}}}`,
        body_text: `<p>Custom body for ${key}: {{${firstVar}}}</p>`,
        is_active: true,
      }

      const resolved = await resolveEmailTemplate(key, sampleVars, async () => customTemplate)

      expect(resolved.usedFallback).toBe(false)
      expect(resolved.subject).toBe(`[Custom ${key}] val_${firstVar}`)
      expect(resolved.body).toBe(`<p>Custom body for ${key}: val_${firstVar}</p>`)
    }
  )

  it('falls back to built-in text and logs a warning when no active template exists', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const resolved = await resolveEmailTemplate(
        'onboarding_invitation',
        {
          first_name: 'Aarav',
          job_title: 'Program Manager',
          joining_clause: ' from <strong>1 December 2026</strong>',
          portal_link: 'https://elc.example.org/onboarding/tok-1',
        },
        async () => null
      )

      expect(resolved.usedFallback).toBe(true)
      expect(resolved.subject).toBe('Welcome to NavGurukul — complete your onboarding')
      expect(resolved.body).toContain('Welcome aboard, Aarav')
      expect(resolved.body).toContain('https://elc.example.org/onboarding/tok-1')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active template in email_templates for key "onboarding_invitation"')
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('refuses to interpolate salary, CTC, ID numbers, or bank details in any template', async () => {
    const sensitiveData: Record<string, string> = {
      first_name: 'Meera',
      job_title: 'Engineer',
      portal_link: 'https://elc.example.org/onboarding/tok-2',
      salary: '1200000',
      ctc: '1200000',
      ctc_amount: '1200000',
      aadhaar_number: '1234-5678-9012',
      pan_number: 'ABCDE1234F',
      bank_account_number: '9988776655',
      ifsc_code: 'SBIN0001234',
      uan_number: '100900200300',
      unlisted_secret: 'should-not-appear',
    }

    const maliciousTemplate: StoredTemplateRecord = {
      key: 'onboarding_invitation',
      subject:
        'Offer for {{first_name}} - CTC {{ctc}} / {{ctc_amount}} / PAN {{pan_number}} / {{unlisted_secret}}',
      body_text:
        '<p>Hi {{first_name}}, salary={{salary}}, aadhaar={{aadhaar_number}}, bank={{bank_account_number}}, ifsc={{ifsc_code}}, uan={{uan_number}}, secret={{unlisted_secret}}</p>',
      is_active: true,
    }

    const resolved = await resolveEmailTemplate(
      'onboarding_invitation',
      sensitiveData,
      async () => maliciousTemplate
    )

    expect(resolved.subject).toContain('Meera')
    expect(resolved.subject).not.toContain('1200000')
    expect(resolved.subject).not.toContain('ABCDE1234F')
    expect(resolved.subject).not.toContain('should-not-appear')

    expect(resolved.body).toContain('Hi Meera')
    expect(resolved.body).not.toContain('1200000')
    expect(resolved.body).not.toContain('1234-5678-9012')
    expect(resolved.body).not.toContain('9988776655')
    expect(resolved.body).not.toContain('SBIN0001234')
    expect(resolved.body).not.toContain('100900200300')
    expect(resolved.body).not.toContain('should-not-appear')

    expect(
      renderEmailSubject('Test {{salary}} {{ctc}} {{pan}} {{bank_account}}', 'onboarding_invitation', sensitiveData)
    ).toBe('Test    ')
    expect(
      renderEmailBody('<p>{{aadhaar}} {{id_number}} {{ifsc}}</p>', 'onboarding_invitation', sensitiveData)
    ).toBe('<p>  </p>')
  })
})
