-- Migration: Create ng_campuses table with default campuses seed
create table if not exists public.ng_campuses (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  status character varying(50) not null default 'active'::character varying,
  created_at timestamp with time zone not null default now(),
  constraint ng_campuses_pkey primary key (id),
  constraint ng_campuses_name_key unique (name),
  constraint ng_campuses_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'closed'::character varying
          ]
        )::text[]
      )
    )
  )
);

-- Seed requested NavGurukul campuses
insert into public.ng_campuses (name, status) values
('Bangalore', 'active'),
('Dantewada', 'active'),
('Dharamshala', 'active'),
('Jashpur', 'active'),
('Kishanganj', 'active'),
('Pune', 'active'),
('Raigarh', 'active'),
('Igatpuri', 'active')
on conflict (name) do nothing;

-- Enable Row Level Security
alter table public.ng_campuses enable row level security;

-- Policies for ng_campuses
create policy "allow select ng_campuses" on public.ng_campuses for select to public using (true);
create policy "allow insert ng_campuses" on public.ng_campuses for insert to public with check (true);
create policy "allow update ng_campuses" on public.ng_campuses for update to public using (true);
create policy "allow delete ng_campuses" on public.ng_campuses for delete to public using (true);

create index if not exists idx_ng_campuses_status on public.ng_campuses(status);
