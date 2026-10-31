-- ============================================================================
-- Break-glass switch
-- ----------------------------------------------------------------------------
-- One row: whether the break-glass accounts in src/lib/rbac/breakGlass.ts may
-- change roles and departments on the users screen. On by default.
--
-- Not a `general_settings` row, because `general_settings` is writable by
-- Platform Admin, and this switch is for Super Admin alone. The table is
-- closed to sessions entirely (RLS on, no policies): the app reads it with the
-- service-role client only for a break-glass account or a Super Admin, and
-- writes it only after `guard(['super_admin'])`.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.break_glass_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.break_glass_settings enable row level security;

insert into public.break_glass_settings (id, enabled) values (true, true)
on conflict (id) do nothing;
