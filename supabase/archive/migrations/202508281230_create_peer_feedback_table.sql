create table peer_feedback (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references confirmations(id),
  peer_employee_id uuid references employees(id),
  peer_name text,
  response_status text not null default 'pending' check (response_status in ('pending', 'submitted', 'reminded')),
  feedback_text text,
  submitted_at timestamptz,
  created_at timestamptz default now()
);

alter table peer_feedback enable row level security;

create policy "authenticated users can read peer_feedback"
  on peer_feedback for select to authenticated using (true);

create policy "authenticated users can insert peer_feedback"
  on peer_feedback for insert to authenticated with check (true);

create policy "authenticated users can update peer_feedback"
  on peer_feedback for update to authenticated using (true);