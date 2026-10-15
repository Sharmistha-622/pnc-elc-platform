create table documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  document_type text not null,
  drive_folder text not null check (drive_folder in ('team_member', 'verification_docs')),
  drive_url text,
  signed_status text default 'unsigned' check (signed_status in ('unsigned', 'signed')),
  created_at timestamptz default now()
);

alter table documents enable row level security;

create policy "authenticated users can read documents"
  on documents for select to authenticated using (true);

create policy "authenticated users can insert documents"
  on documents for insert to authenticated with check (true);