create table appraisals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  cycle text not null check (cycle in ('july', 'december')),
  reference_date date not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  appraisal_letter_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table appraisals enable row level security;

create policy "authenticated users can read appraisals"
  on appraisals for select to authenticated using (true);

create policy "authenticated users can insert appraisals"
  on appraisals for insert to authenticated with check (true);

create policy "authenticated users can update appraisals"
  on appraisals for update to authenticated using (true);