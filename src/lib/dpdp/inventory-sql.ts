import { INVENTORY, type InventoryTable } from './inventory'

/** Where the generated inventory lives, relative to the repository root. */
export const INVENTORY_SQL_PATH = 'supabase/tests/dpdp_inventory.sql'

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`

/**
 * Renders the inventory as SQL the DPDP probe loads: one row per column, in a
 * temporary table. The probe compares it with `information_schema.columns`
 * and fails on any column the inventory does not list.
 */
export function renderInventorySql(inventory: InventoryTable[] = INVENTORY): string {
  const rows = inventory.flatMap((t) =>
    t.columns.map(
      (c) =>
        `  (${quote(t.store)}, ${quote(t.table)}, ${quote(c.name)}, ${quote(c.class)}, ${c.staged ? 'true' : 'false'}, ${t.personal ? 'true' : 'false'})`,
    ),
  )
  return [
    '-- Generated from src/lib/dpdp/inventory.ts by `npm run dpdp:inventory`. Do not edit by hand.',
    '-- One row per column of every core and vault table. supabase/tests/dpdp_probe.sql',
    '-- fails on any column in the database that is not listed here.',
    'create temp table dpdp_inventory (',
    '  store text not null,',
    '  table_name text not null,',
    '  column_name text not null,',
    '  class text not null,',
    '  staged boolean not null,',
    '  personal boolean not null,',
    '  primary key (store, table_name, column_name)',
    ');',
    'insert into dpdp_inventory (store, table_name, column_name, class, staged, personal) values',
    rows.join(',\n') + ';',
    '',
  ].join('\n')
}
