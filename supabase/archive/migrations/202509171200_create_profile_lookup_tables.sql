create table relationship_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into relationship_types (name) values
('Father'), ('Mother'), ('Spouse'), ('Sibling'), ('Friend'), ('Other');

create table id_proof_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into id_proof_types (name) values
('Aadhar'), ('PAN'), ('Passport'), ('Driving License'), ('Voter ID'), ('Other');

alter table relationship_types enable row level security;
alter table id_proof_types enable row level security;

create policy "allow read for dev" on relationship_types for select to public using (true);
create policy "allow read for dev" on id_proof_types for select to public using (true);