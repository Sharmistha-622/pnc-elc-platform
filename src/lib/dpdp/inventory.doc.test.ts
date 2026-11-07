import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { renderInventorySql, INVENTORY_SQL_PATH } from './inventory-sql'

/**
 * Keeps supabase/tests/dpdp_inventory.sql in step with inventory.ts, so the
 * DPDP probe always compares the schema with the inventory as written.
 *
 * Regenerate with `npm run dpdp:inventory` after changing the inventory.
 */
describe(INVENTORY_SQL_PATH, () => {
  const file = path.join(process.cwd(), INVENTORY_SQL_PATH)
  const rendered = renderInventorySql()

  if (process.env.UPDATE_DOCS === '1') {
    it('is rewritten from the inventory', () => {
      fs.writeFileSync(file, rendered)
      expect(fs.readFileSync(file, 'utf8')).toBe(rendered)
    })
    return
  }

  it('matches the inventory', () => {
    expect(fs.existsSync(file), `${INVENTORY_SQL_PATH} is missing: run npm run dpdp:inventory`).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toBe(rendered)
  })
})
