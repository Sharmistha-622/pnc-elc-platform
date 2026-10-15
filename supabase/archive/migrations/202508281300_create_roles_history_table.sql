create table roles_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  role text not null,
  team text,
  effective_date date not null,
  created_at timestamptz default now()
);

alter table roles_history enable row level security;

create policy "authenticated users can read roles_history"
  on roles_history for select to authenticated using (true);

create policy "authenticated users can insert roles_history"
  on roles_history for insert to authenticated with check (true);