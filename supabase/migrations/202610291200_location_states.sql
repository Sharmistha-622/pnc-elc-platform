-- ============================================================================
-- A state on every location
-- ----------------------------------------------------------------------------
-- Payroll looks up professional tax by the state a person works in, and that
-- state is the state of their location (docs/payroll/decisions.md, D-25). A
-- location so far had a name, a type and a free-text address, so the state
-- was only ever implied by the address.
--
--   1. `indian_states`: the 28 states and 8 union territories, keyed by their
--      ISO 3166-2:IN code (as revised in 2023: CG, OD, TG, UK). Reference
--      data, changed only by a migration, so there is no write policy.
--   2. `ng_locations.state_code`, referencing it.
--   3. A one-off backfill from the address: the state named LAST in the
--      address wins, since an Indian address ends "…, <state> <PIN>". An
--      address naming no state is left empty and shows as "State needed" on
--      the Locations screen. `src/lib/locations/states.ts` applies the same
--      rule when someone types an address.
--
-- ng_locations' old "to public" write policies were already dropped by
-- 202610241000_lockdown_rls.sql, which left "staff read" and "data management
-- writes" (Super Admin, PnC Admin, Platform Admin). Those cover the new column.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.indian_states (
  code       text primary key check (code ~ '^[A-Z]{2}$'),
  name       text not null unique,
  kind       text not null check (kind in ('state', 'union_territory')),
  -- Other names an address may use: older spellings, the capital's name.
  aliases    text[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.indian_states (code, name, kind, aliases) values
  ('AP', 'Andhra Pradesh',    'state', '{}'),
  ('AR', 'Arunachal Pradesh', 'state', '{}'),
  ('AS', 'Assam',             'state', '{}'),
  ('BR', 'Bihar',             'state', '{}'),
  ('CG', 'Chhattisgarh',      'state', '{Chattisgarh}'),
  ('GA', 'Goa',               'state', '{}'),
  ('GJ', 'Gujarat',           'state', '{}'),
  ('HR', 'Haryana',           'state', '{}'),
  ('HP', 'Himachal Pradesh',  'state', '{}'),
  ('JH', 'Jharkhand',         'state', '{}'),
  ('KA', 'Karnataka',         'state', '{}'),
  ('KL', 'Kerala',            'state', '{}'),
  ('MP', 'Madhya Pradesh',    'state', '{}'),
  ('MH', 'Maharashtra',       'state', '{}'),
  ('MN', 'Manipur',           'state', '{}'),
  ('ML', 'Meghalaya',         'state', '{}'),
  ('MZ', 'Mizoram',           'state', '{}'),
  ('NL', 'Nagaland',          'state', '{}'),
  ('OD', 'Odisha',            'state', '{Orissa}'),
  ('PB', 'Punjab',            'state', '{}'),
  ('RJ', 'Rajasthan',         'state', '{}'),
  ('SK', 'Sikkim',            'state', '{}'),
  ('TN', 'Tamil Nadu',        'state', '{}'),
  ('TG', 'Telangana',         'state', '{}'),
  ('TR', 'Tripura',           'state', '{}'),
  ('UP', 'Uttar Pradesh',     'state', '{}'),
  ('UK', 'Uttarakhand',       'state', '{Uttaranchal}'),
  ('WB', 'West Bengal',       'state', '{}'),
  ('AN', 'Andaman and Nicobar Islands', 'union_territory', '{"Andaman & Nicobar"}'),
  ('CH', 'Chandigarh',        'union_territory', '{}'),
  ('DH', 'Dadra and Nagar Haveli and Daman and Diu', 'union_territory', '{"Dadra and Nagar Haveli","Daman and Diu"}'),
  ('DL', 'Delhi',             'union_territory', '{"New Delhi","NCT of Delhi"}'),
  ('JK', 'Jammu and Kashmir', 'union_territory', '{"Jammu & Kashmir"}'),
  ('LA', 'Ladakh',            'union_territory', '{}'),
  ('LD', 'Lakshadweep',       'union_territory', '{}'),
  ('PY', 'Puducherry',        'union_territory', '{Pondicherry}')
on conflict (code) do update
  set name = excluded.name, kind = excluded.kind, aliases = excluded.aliases;

alter table public.indian_states enable row level security;
revoke all on public.indian_states from anon;
revoke insert, update, delete on public.indian_states from authenticated;
grant select on public.indian_states to authenticated;
drop policy if exists "staff read" on public.indian_states;
create policy "staff read" on public.indian_states for select to authenticated
  using (public.is_staff());

alter table public.ng_locations
  add column if not exists state_code text references public.indian_states (code);
create index if not exists idx_ng_locations_state_code on public.ng_locations (state_code);

-- The backfill. For each location with no state yet, find where each state's
-- name or alias last appears in the address, as a whole word, and take the
-- one that appears last.
with terms as (
  select code, unnest(array[name] || aliases) as term from public.indian_states
),
hits as (
  select l.id, t.code,
         max(regexp_instr(l.address, '\m' || t.term || '\M', 1, n, 0, 'i')) as pos
    from public.ng_locations l
    cross join terms t
    cross join generate_series(1, 5) as n
   where l.state_code is null
     and l.address is not null
   group by l.id, t.code
),
best as (
  select distinct on (id) id, code
    from hits
   where pos > 0
   order by id, pos desc
)
update public.ng_locations l
   set state_code = best.code
  from best
 where l.id = best.id
   and l.state_code is null;
