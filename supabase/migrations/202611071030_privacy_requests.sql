-- ============================================================================
-- Rights requests and nominations
-- ----------------------------------------------------------------------------
-- WHY
--   A Data Principal may ask for a summary of their data and who it was
--   shared with (s. 11), for correction, completion, updating and erasure
--   (s. 12), raise a grievance (s. 13) and nominate someone to act for them
--   (s. 14). The Data Fiduciary answers within the period it publishes, at
--   most 90 days for a grievance (Rules r. 14(3)).
--
-- WHAT THIS ADDS
--   privacy_requests     one row per request, with its due date, escalation,
--                        answer and, for erasure, the statute and the date
--                        data must be kept until
--   privacy_nominations  the person a principal nominates
--
-- WHO
--   Read: the person themselves (staff, through current_employee_id()), and
--   Super Admin and PnC Admin (FEATURE_ACCESS `privacyCases`). No session
--   writes: requests are raised and worked through guarded server code with
--   the service role.
--
-- Safe to re-run.
-- ============================================================================

begin;

create sequence if not exists public.privacy_request_number;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null default ('PR-' || lpad(nextval('public.privacy_request_number')::text, 5, '0')),
  principal_type text not null,
  -- onboarding_records.id for a candidate; employees.id for staff and former staff.
  principal_ref uuid,
  -- Who asked, when there is no record to point at (a request received by email).
  requester_name text,
  requester_email text,
  request_type text not null,
  channel text not null,
  details text not null default '',
  status text not null default 'received',
  received_at timestamptz not null default now(),
  due_at timestamptz not null,
  verified_at timestamptz,
  assigned_to text,
  escalated_at timestamptz,
  acknowledged_at timestamptz,
  answer text,
  statute_cited text,
  retain_until date,
  answered_at timestamptz,
  answered_by text,
  closed_at timestamptz,
  recorded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'privacy_requests_reference_key') then
    alter table public.privacy_requests add constraint privacy_requests_reference_key unique (reference);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_requests_principal_type') then
    alter table public.privacy_requests add constraint privacy_requests_principal_type
      check (principal_type in ('candidate', 'employee', 'contractor', 'volunteer', 'dependant', 'former_employee'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_requests_type') then
    alter table public.privacy_requests add constraint privacy_requests_type check (request_type in (
      'access', 'correction', 'completion', 'updating', 'erasure', 'nomination', 'grievance'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_requests_channel') then
    alter table public.privacy_requests add constraint privacy_requests_channel
      check (channel in ('app', 'portal', 'email', 'paper', 'in_person'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'privacy_requests_status') then
    alter table public.privacy_requests add constraint privacy_requests_status
      check (status in ('received', 'in_progress', 'awaiting_info', 'answered', 'closed'));
  end if;
  -- A request is tied to a record or to who sent it; and its due date is at
  -- most 90 days after receipt (r. 14(3)).
  if not exists (select 1 from pg_constraint where conname = 'privacy_requests_shape') then
    alter table public.privacy_requests add constraint privacy_requests_shape check (
      (principal_ref is not null or coalesce(btrim(requester_email), '') <> '')
      and due_at > received_at
      and due_at <= received_at + interval '90 days'
      and (status not in ('answered', 'closed') or answered_at is not null)
    );
  end if;
end $$;

create index if not exists privacy_requests_principal on public.privacy_requests (principal_type, principal_ref);
create index if not exists privacy_requests_open on public.privacy_requests (due_at) where status <> 'closed';

create table if not exists public.privacy_nominations (
  id uuid primary key default gen_random_uuid(),
  principal_type text not null,
  principal_ref uuid not null,
  nominee_name text not null,
  nominee_relation text not null default '',
  nominee_contact text not null default '',
  recorded_at timestamptz not null default now(),
  recorded_by text,
  revoked_at timestamptz
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'privacy_nominations_principal_type') then
    alter table public.privacy_nominations add constraint privacy_nominations_principal_type
      check (principal_type in ('candidate', 'employee', 'contractor', 'volunteer', 'former_employee'));
  end if;
end $$;

create unique index if not exists privacy_nominations_one_live
  on public.privacy_nominations (principal_type, principal_ref) where revoked_at is null;

create or replace function public.privacy_requests_touch() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists privacy_requests_touch on public.privacy_requests;
create trigger privacy_requests_touch before update on public.privacy_requests
  for each row execute function public.privacy_requests_touch();

do $$ declare t text; begin
  foreach t in array array['privacy_requests', 'privacy_nominations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "own or privacy cases read" on public.%I', t);
    execute format(
      'create policy "own or privacy cases read" on public.%I for select to authenticated using ('
      || 'public.has_role(''super_admin'', ''pnc_admin'') '
      || 'or (principal_type in (''employee'', ''contractor'', ''volunteer'') and principal_ref = public.current_employee_id()))', t);
  end loop;
end $$;

revoke all on sequence public.privacy_request_number from anon, authenticated;

commit;
