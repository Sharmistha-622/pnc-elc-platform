create table employee_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) unique,

  first_name text not null,
  last_name text not null,

  personal_email text,
  official_email text,

  contact_number text,

  emergency_contact_number text,
  emergency_contact_name text,
  emergency_contact_relation_id uuid references relationship_types(id),

  permanent_address text,
  mailing_address_same boolean default true,
  mailing_address text,

  address_proof_type_id uuid references id_proof_types(id),
  address_proof_number text,

  id_proof_type_id uuid references id_proof_types(id),
  id_proof_number text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table employee_profiles enable row level security;

create policy "allow dev access to profiles"
  on employee_profiles for all
  to public
  using (true)
  with check (true);