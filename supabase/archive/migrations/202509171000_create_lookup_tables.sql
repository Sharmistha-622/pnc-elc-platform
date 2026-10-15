create table employee_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

insert into employee_types (name, description) values
('apprentice_nontech', 'Apprentice — Non-Tech'),
('apprentice_tech', 'Apprentice — Tech'),
('intern', 'Intern'),
('fte', 'Full-Time Employee'),
('ftc', 'Full-Time Consultant'),
('contractor', 'Contractor/Consultant');

create table appraisal_eligibility (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

insert into appraisal_eligibility (name, description) values
('eligible', 'Employee is eligible for appraisal cycles'),
('not_eligible', 'Employee is not eligible for appraisal cycles');

create table pf_eligibility (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

insert into pf_eligibility (name, description) values
('applicable_opted_in', 'PF applicable, employee opted in'),
('applicable_opted_out', 'PF applicable, employee opted out (Form 11 required)'),
('not_applicable', 'PF not applicable to this employee');

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into teams (name) values
('Engineering'), ('Operations'), ('Design'), ('Finance'), ('PnC');

alter table employee_types enable row level security;
alter table appraisal_eligibility enable row level security;
alter table pf_eligibility enable row level security;
alter table teams enable row level security;

create policy "allow read for dev" on employee_types for select to public using (true);
create policy "allow read for dev" on appraisal_eligibility for select to public using (true);
create policy "allow read for dev" on pf_eligibility for select to public using (true);
create policy "allow read for dev" on teams for select to public using (true);