-- ============================================================================
-- Incident register: personal data breaches and cyber incidents
-- ----------------------------------------------------------------------------
-- WHY
--   A personal data breach is intimated to the Data Protection Board and to
--   each affected person without delay, with a detailed report to the Board
--   within 72 hours of becoming aware of it (DPDP Act s. 8(6); Rules r. 7).
--   A cyber incident is reported to CERT-In within 6 hours of noticing it
--   (CERT-In Directions 2022, direction (ii)).
--
-- WHAT THIS ADDS
--   privacy_incidents   one row per incident: when it was noticed, what it
--                       touched, the two deadlines (set by the database from
--                       the time noticed), and when each report went out
--
-- WHO
--   Read: Super Admin and PnC Admin (`privacyCases`). No session writes: the
--   guarded incident actions write with the service role.
--
-- Safe to re-run.
-- ============================================================================

begin;

create sequence if not exists public.privacy_incident_number;

create table if not exists public.privacy_incidents (
  id uuid primary key default gen_random_uuid(),
  reference text not null default ('PI-' || lpad(nextval('public.privacy_incident_number')::text, 4, '0')),
  title text not null,
  description text not null default '',
  -- The CERT-In and Board clocks run from when the incident was noticed.
  detected_at timestamptz not null,
  occurred_at timestamptz,
  severity text not null default 'medium',
  status text not null default 'open',
  -- A personal data breach (DPDP Rules r. 7) and/or a reportable cyber incident (CERT-In).
  personal_data boolean not null default true,
  certin_reportable boolean not null default true,
  categories text[] not null default '{}',
  people_affected integer,
  systems text not null default '',
  location text not null default '',
  consequences text not null default '',
  mitigation text not null default '',
  safety_steps text not null default '',
  cause text not null default '',
  certin_due_at timestamptz,
  certin_reported_at timestamptz,
  board_intimated_at timestamptz,
  board_report_due_at timestamptz,
  board_report_at timestamptz,
  individuals_notified_at timestamptz,
  recorded_by text not null,
  closed_at timestamptz,
  closed_by text,
  closure_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'privacy_incidents_reference_key') then
    alter table public.privacy_incidents add constraint privacy_incidents_reference_key unique (reference);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_incidents_severity') then
    alter table public.privacy_incidents add constraint privacy_incidents_severity check (severity in ('low', 'medium', 'high'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_incidents_status') then
    alter table public.privacy_incidents add constraint privacy_incidents_status check (status in ('open', 'contained', 'closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_incidents_shape') then
    alter table public.privacy_incidents add constraint privacy_incidents_shape check (
      length(btrim(title)) >= 3
      and (people_affected is null or people_affected >= 0)
      and (occurred_at is null or occurred_at <= detected_at)
      and (status <> 'closed' or (closed_at is not null and coalesce(btrim(closure_note), '') <> ''))
    );
  end if;
end $$;

create index if not exists privacy_incidents_open on public.privacy_incidents (detected_at) where status <> 'closed';

-- The deadlines follow the time noticed and are not typed in: 6 hours for
-- CERT-In, 72 hours for the Board's detailed report. The time noticed cannot
-- move once a report has gone out.
create or replace function public.privacy_incidents_deadlines() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if tg_op = 'UPDATE' and new.detected_at is distinct from old.detected_at
     and (old.certin_reported_at is not null or old.board_report_at is not null or old.board_intimated_at is not null) then
    raise exception 'The time noticed cannot change after a report has gone out' using errcode = 'check_violation';
  end if;
  new.certin_due_at := case when new.certin_reportable then new.detected_at + interval '6 hours' end;
  new.board_report_due_at := case when new.personal_data then new.detected_at + interval '72 hours' end;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists privacy_incidents_deadlines on public.privacy_incidents;
create trigger privacy_incidents_deadlines before insert or update on public.privacy_incidents
  for each row execute function public.privacy_incidents_deadlines();

alter table public.privacy_incidents enable row level security;
revoke all on public.privacy_incidents from anon;
revoke insert, update, delete, truncate on public.privacy_incidents from authenticated;
grant select on public.privacy_incidents to authenticated;

drop policy if exists "privacy cases read" on public.privacy_incidents;
create policy "privacy cases read" on public.privacy_incidents for select to authenticated
  using (public.has_role('super_admin', 'pnc_admin'));

revoke all on sequence public.privacy_incident_number from anon, authenticated;

commit;
