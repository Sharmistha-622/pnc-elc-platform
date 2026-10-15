create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid,
  changed_data jsonb,
  created_at timestamptz default now()
);

alter table audit_log enable row level security;

create policy "authenticated users can read audit_log"
  on audit_log for select to authenticated using (true);

create policy "authenticated users can insert audit_log"
  on audit_log for insert to authenticated with check (true);