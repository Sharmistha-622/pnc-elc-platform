-- Forms module: framework only (no form content)

create or replace function public.forms_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Role helpers (role lives in Supabase Auth app_metadata)
create or replace function public.current_app_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'Employee')
$$;

create or replace function public.can_manage_forms()
returns boolean language sql stable as $$
  select public.current_app_role() in ('Super Admin', 'Admin', 'PnC')
$$;

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

-- Tables
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  workflow text check (workflow in ('confirmation', 'appraisal')),
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, version_number)
);
create unique index form_versions_one_draft on public.form_versions (form_id) where status = 'draft';
create unique index form_versions_one_published on public.form_versions (form_id) where status = 'published';

create table public.form_sections (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null,
  show_when jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index form_sections_version_idx on public.form_sections (form_version_id, order_index);

create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  section_id uuid not null references public.form_sections(id) on delete cascade,
  field_type text not null check (field_type in (
    'short_text', 'long_text', 'number', 'date', 'single_select', 'multi_select',
    'yes_no', 'rating', 'rating_grid', 'employee_picker'
  )),
  label text not null,
  help_text text,
  is_required boolean not null default true,
  order_index integer not null,
  options jsonb,
  show_when jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index form_fields_version_idx on public.form_fields (form_version_id);
create index form_fields_section_idx on public.form_fields (section_id, order_index);

create table public.form_requests (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions(id),
  subject_employee_id uuid references public.employees(id),
  respondent_employee_id uuid references public.employees(id),
  respondent_email text,
  linked_confirmation_id uuid references public.confirmations(id),
  linked_appraisal_id uuid references public.appraisals(id),
  token_hash text unique,
  expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'opened', 'started', 'submitted', 'expired', 'cancelled')),
  opened_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (respondent_employee_id is not null or respondent_email is not null),
  check (not (linked_confirmation_id is not null and linked_appraisal_id is not null))
);
create index form_requests_version_idx on public.form_requests (form_version_id);
create index form_requests_respondent_idx on public.form_requests (respondent_employee_id);
create index form_requests_status_idx on public.form_requests (status);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions(id),
  request_id uuid unique references public.form_requests(id),
  subject_employee_id uuid references public.employees(id),
  respondent_employee_id uuid references public.employees(id),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index form_submissions_version_idx on public.form_submissions (form_version_id);
create index form_submissions_respondent_idx on public.form_submissions (respondent_employee_id);

create table public.form_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete cascade,
  field_id uuid not null references public.form_fields(id),
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, field_id)
);
create index form_answers_submission_idx on public.form_answers (submission_id);

-- updated_at triggers
create trigger forms_updated_at before update on public.forms
  for each row execute function public.forms_set_updated_at();
create trigger form_versions_updated_at before update on public.form_versions
  for each row execute function public.forms_set_updated_at();
create trigger form_sections_updated_at before update on public.form_sections
  for each row execute function public.forms_set_updated_at();
create trigger form_fields_updated_at before update on public.form_fields
  for each row execute function public.forms_set_updated_at();
create trigger form_requests_updated_at before update on public.form_requests
  for each row execute function public.forms_set_updated_at();
create trigger form_submissions_updated_at before update on public.form_submissions
  for each row execute function public.forms_set_updated_at();
create trigger form_answers_updated_at before update on public.form_answers
  for each row execute function public.forms_set_updated_at();

-- Immutability: published versions cannot change
create or replace function public.forms_guard_version()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published or superseded form versions cannot be deleted';
    end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if not (old.status = 'published' and new.status = 'superseded'
            and new.form_id = old.form_id
            and new.version_number = old.version_number
            and new.published_at is not distinct from old.published_at) then
      raise exception 'Published form versions are immutable';
    end if;
  end if;
  return new;
end $$;
create trigger form_versions_guard before update or delete on public.form_versions
  for each row execute function public.forms_guard_version();

-- Sections and fields can only change while their version is a draft
create or replace function public.forms_guard_structure()
returns trigger language plpgsql as $$
declare v_status text;
begin
  if tg_op = 'UPDATE' and new.form_version_id <> old.form_version_id then
    raise exception 'A section or field cannot move to another version';
  end if;
  select status into v_status from public.form_versions
    where id = coalesce(new.form_version_id, old.form_version_id);
  if v_status is null and tg_op = 'DELETE' then
    return old; -- parent version is being deleted (draft cascade)
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'Sections and fields can only be changed on a draft version';
  end if;
  return coalesce(new, old);
end $$;
create trigger form_sections_guard before insert or update or delete on public.form_sections
  for each row execute function public.forms_guard_structure();
create trigger form_fields_guard before insert or update or delete on public.form_fields
  for each row execute function public.forms_guard_structure();

-- Submissions: only against published versions of non-archived forms
create or replace function public.forms_guard_submission()
returns trigger language plpgsql as $$
declare v_status text; v_archived timestamptz;
begin
  if tg_op = 'INSERT' then
    select v.status, f.archived_at into v_status, v_archived
    from public.form_versions v join public.forms f on f.id = v.form_id
    where v.id = new.form_version_id;
    if v_status is distinct from 'published' or v_archived is not null then
      raise exception 'This form is not accepting submissions';
    end if;
  else
    if old.status = 'submitted' then
      raise exception 'A submitted form cannot be changed';
    end if;
    if new.form_version_id <> old.form_version_id then
      raise exception 'The form version of a submission cannot change';
    end if;
    if new.status = 'submitted' then
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger form_submissions_guard before insert or update on public.form_submissions
  for each row execute function public.forms_guard_submission();

-- Answers: frozen once submitted, and must belong to the submission's version
create or replace function public.forms_guard_answers()
returns trigger language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.form_submissions
    where id = coalesce(new.submission_id, old.submission_id);
  if v_status is null and tg_op = 'DELETE' then
    return old;
  end if;
  if v_status is distinct from 'in_progress' then
    raise exception 'Answers cannot be changed once a form is submitted';
  end if;
  if tg_op <> 'DELETE' then
    if not exists (
      select 1 from public.form_fields f
      join public.form_submissions s on s.form_version_id = f.form_version_id
      where f.id = new.field_id and s.id = new.submission_id
    ) then
      raise exception 'This field does not belong to the submission''s form version';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger form_answers_guard before insert or update or delete on public.form_answers
  for each row execute function public.forms_guard_answers();

-- Publish atomically: supersede the old published version, publish the draft
create or replace function public.publish_form_version(p_version_id uuid)
returns void language plpgsql as $$
declare v_form_id uuid;
begin
  if not public.can_manage_forms() then
    raise exception 'Not allowed';
  end if;
  select form_id into v_form_id from public.form_versions
    where id = p_version_id and status = 'draft';
  if v_form_id is null then
    raise exception 'Only a draft version can be published';
  end if;
  if not exists (select 1 from public.form_fields where form_version_id = p_version_id) then
    raise exception 'Add at least one field before publishing';
  end if;
  update public.form_versions set status = 'superseded'
    where form_id = v_form_id and status = 'published';
  update public.form_versions set status = 'published', published_at = now()
    where id = p_version_id;
end $$;

-- Row Level Security
alter table public.forms enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_sections enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_requests enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_answers enable row level security;

-- Definitions: Super Admin, Admin and PnC manage them
create policy forms_manage on public.forms for all to authenticated
  using (public.can_manage_forms()) with check (public.can_manage_forms());
create policy form_versions_manage on public.form_versions for all to authenticated
  using (public.can_manage_forms()) with check (public.can_manage_forms());
create policy form_sections_manage on public.form_sections for all to authenticated
  using (public.can_manage_forms()) with check (public.can_manage_forms());
create policy form_fields_manage on public.form_fields for all to authenticated
  using (public.can_manage_forms()) with check (public.can_manage_forms());

-- Respondents can read only the forms they were asked to fill
create policy forms_respondent_read on public.forms for select to authenticated
  using (exists (
    select 1 from public.form_versions v
    join public.form_requests r on r.form_version_id = v.id
    where v.form_id = forms.id and r.respondent_employee_id = public.current_employee_id()
  ));
create policy form_versions_respondent_read on public.form_versions for select to authenticated
  using (exists (
    select 1 from public.form_requests r
    where r.form_version_id = form_versions.id
      and r.respondent_employee_id = public.current_employee_id()
  ));
create policy form_sections_respondent_read on public.form_sections for select to authenticated
  using (exists (
    select 1 from public.form_requests r
    where r.form_version_id = form_sections.form_version_id
      and r.respondent_employee_id = public.current_employee_id()
  ));
create policy form_fields_respondent_read on public.form_fields for select to authenticated
  using (exists (
    select 1 from public.form_requests r
    where r.form_version_id = form_fields.form_version_id
      and r.respondent_employee_id = public.current_employee_id()
  ));

-- Requests
create policy form_requests_manage on public.form_requests for all to authenticated
  using (public.can_manage_forms()) with check (public.can_manage_forms());
create policy form_requests_respondent_read on public.form_requests for select to authenticated
  using (respondent_employee_id = public.current_employee_id());

-- Submissions
create policy form_submissions_manage_read on public.form_submissions for select to authenticated
  using (public.can_manage_forms());
create policy form_submissions_own_read on public.form_submissions for select to authenticated
  using (respondent_employee_id = public.current_employee_id());
create policy form_submissions_own_insert on public.form_submissions for insert to authenticated
  with check (
    respondent_employee_id = public.current_employee_id()
    and exists (
      select 1 from public.form_requests r
      where r.id = form_submissions.request_id
        and r.respondent_employee_id = public.current_employee_id()
        and r.form_version_id = form_submissions.form_version_id
        and r.status in ('pending', 'opened', 'started')
        and (r.expires_at is null or r.expires_at > now())
    )
  );
create policy form_submissions_own_update on public.form_submissions for update to authenticated
  using (respondent_employee_id = public.current_employee_id() and status = 'in_progress')
  with check (respondent_employee_id = public.current_employee_id());

-- Answers
create policy form_answers_manage_read on public.form_answers for select to authenticated
  using (public.can_manage_forms());
create policy form_answers_own_all on public.form_answers for all to authenticated
  using (exists (
    select 1 from public.form_submissions s
    where s.id = form_answers.submission_id
      and s.respondent_employee_id = public.current_employee_id()
  ))
  with check (exists (
    select 1 from public.form_submissions s
    where s.id = form_answers.submission_id
      and s.respondent_employee_id = public.current_employee_id()
  ));

-- Function permissions
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.can_manage_forms() from public, anon;
revoke execute on function public.current_employee_id() from public, anon;
revoke execute on function public.publish_form_version(uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.can_manage_forms() to authenticated, service_role;
grant execute on function public.current_employee_id() to authenticated, service_role;
grant execute on function public.publish_form_version(uuid) to authenticated, service_role;
