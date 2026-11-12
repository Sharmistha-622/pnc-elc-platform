import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('email delivery log integrity (#113)', () => {
  const repoRoot = process.cwd()
  const srcDir = path.join(repoRoot, 'src')

  it('does not export resendEmailDeliveryLog from settings/service.ts', () => {
    const serviceSource = fs.readFileSync(
      path.join(srcDir, 'lib/settings/service.ts'),
      'utf8'
    )
    expect(serviceSource).not.toMatch(/\bresendEmailDeliveryLog\b/)
  })

  it('no code path updates email_delivery_logs to mark a row delivered without sending', () => {
    const files = listSourceFiles(srcDir)
    const logMutators: string[] = []

    for (const file of files) {
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/')
      const text = fs.readFileSync(file, 'utf8')
      if (!text.includes('email_delivery_logs')) continue

      // Disallow any .from('email_delivery_logs').update(...) that flips status to delivered
      const hasUpdate =
        /from\(\s*['"]email_delivery_logs['"]\s*\)[\s\S]{0,120}?\.update\s*\(/.test(text)
      expect(hasUpdate, `${rel} must not update existing email_delivery_logs rows`).toBe(false)

      if (/from\(\s*['"]email_delivery_logs['"]\s*\)[\s\S]{0,120}?\.insert\s*\(/.test(text)) {
        logMutators.push(rel)
        // Every file that inserts into email_delivery_logs must also perform a real send
        const callsMailer =
          /\bsendEmail\b|\bsendTestEmail\b|messages\.send\b/.test(text)
        expect(
          callsMailer,
          `${rel} inserts into email_delivery_logs without calling the mailer`
        ).toBe(true)
      }
    }

    expect(logMutators.sort()).toEqual([
      'src/lib/email/sendEmail.ts',
      'src/lib/settings/service.ts',
    ])
  })

  it('outbox views do not expose a fake Resend action', () => {
    const emailsView = fs.readFileSync(
      path.join(srcDir, 'app/(dashboard)/manage/emails/emails-view.tsx'),
      'utf8'
    )
    const notificationForm = fs.readFileSync(
      path.join(
        srcDir,
        'app/(dashboard)/manage/settings/(platform)/notifications/notification-settings-form.tsx'
      ),
      'utf8'
    )

    expect(emailsView).not.toMatch(/\bresendEmailDeliveryLog\b|\bhandleResend\b/)
    expect(notificationForm).not.toMatch(/\bresendEmailDeliveryLog\b|\bhandleResend\b/)
  })
})

