-- ===========================================================================
-- Every column in the database is in the data inventory, and the inventory
-- lists nothing the database does not have.
-- ---------------------------------------------------------------------------
-- Included by supabase/tests/dpdp_probe.sql (core) and run on its own against
-- the vault by scripts/dpdp-probe.sh. Needs `dpdp_inventory` (from
-- supabase/tests/dpdp_inventory.sql), `pg_temp.failures`, and the setting
-- `dpdp.store` ('core' or 'vault'; core when unset).
-- ===========================================================================

insert into pg_temp.failures
  select 'every column is in the data inventory (src/lib/dpdp/inventory.ts)',
         c.table_name || '.' || c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and not exists (
       select 1 from dpdp_inventory i
        where i.store = coalesce(nullif(current_setting('dpdp.store', true), ''), 'core')
          and i.table_name = c.table_name and i.column_name = c.column_name
     );

insert into pg_temp.failures
  select 'the data inventory lists only columns that exist',
         i.table_name || '.' || i.column_name
    from dpdp_inventory i
   where i.store = coalesce(nullif(current_setting('dpdp.store', true), ''), 'core')
     and not exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = i.table_name and c.column_name = i.column_name
     );
