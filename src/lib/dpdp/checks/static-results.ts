import fs from 'node:fs/promises'
import path from 'node:path'
import type { StaticReport } from './evaluate'

/** Where `npm run build` writes the static results (scripts/dpdp-check.ts). */
export const STATIC_RESULTS_PATH = 'src/lib/dpdp/checks/static-results.generated.json'

/** The static and db results of this build, or null when the build wrote none (dev). */
export async function readStaticReport(): Promise<StaticReport | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), STATIC_RESULTS_PATH), 'utf8')
    const parsed = JSON.parse(raw) as StaticReport
    return Array.isArray(parsed.results) ? parsed : null
  } catch {
    return null
  }
}
