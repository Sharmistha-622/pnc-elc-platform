-- Migration: Create ng_locations table with location types (Campus, Bootcamp, Day Center) and address
create table if not exists public.ng_locations (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  type character varying(50) not null default 'Campus'::character varying,
  address text,
  status character varying(50) not null default 'active'::character varying,
  created_at timestamp with time zone not null default now(),
  constraint ng_locations_pkey primary key (id),
  constraint ng_locations_name_key unique (name),
  constraint ng_locations_type_check check (
    (
      (type)::text = any (
        (
          array[
            'Campus'::character varying,
            'Bootcamp'::character varying,
            'Day Center'::character varying,
            'campus'::character varying,
            'bootcamp'::character varying,
            'day_center'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint ng_locations_status_check check (
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

-- Seed initial NavGurukul locations: 8 Campuses + 2 Day Centers (Navigo Pune, Navigo Igatpuri)
insert into public.ng_locations (name, type, address, status) values
('Bangalore', 'Campus', 'NavGurukul Bangalore Campus, Electronic City Phase 1, Bengaluru, Karnataka 560100', 'active'),
('Dantewada', 'Campus', 'NavGurukul Residential Campus, Education City, Jawanga, Geedam, Dantewada, Chhattisgarh 494441', 'active'),
('Dharamshala', 'Campus', 'NavGurukul Dharamshala Campus, Vill. Sarah, Tehsil Dharamshala, Kangra, Himachal Pradesh 176215', 'active'),
('Jashpur', 'Campus', 'NavGurukul Campus, Sankalp Bhawan, Jashpur Nagar, Chhattisgarh 496331', 'active'),
('Kishanganj', 'Campus', 'NavGurukul Kishanganj Campus, Halim Chowk, Kishanganj, Bihar 855107', 'active'),
('Pune', 'Campus', 'NavGurukul Pune Campus, Hinjewadi Phase 2, Pune, Maharashtra 411057', 'active'),
('Raigarh', 'Campus', 'NavGurukul Raigarh Center, Near Collectorate, Raigarh, Chhattisgarh 496001', 'active'),
('Igatpuri', 'Campus', 'NavGurukul Igatpuri Campus, Old Agra Road, Igatpuri, Nashik, Maharashtra 422403', 'active'),
('Navigo Pune', 'Day Center', 'Navigo Day Center Pune, Maharashtra', 'active'),
('Navigo Igatpuri', 'Day Center', 'Navigo Day Center Igatpuri, Nashik, Maharashtra', 'active')
on conflict (name) do update set
  type = excluded.type,
  address = coalesce(excluded.address, public.ng_locations.address),
  status = excluded.status;

-- Enable Row Level Security
alter table public.ng_locations enable row level security;

-- Policies for ng_locations
create policy "allow select ng_locations" on public.ng_locations for select to public using (true);
create policy "allow insert ng_locations" on public.ng_locations for insert to public with check (true);
create policy "allow update ng_locations" on public.ng_locations for update to public using (true);
create policy "allow delete ng_locations" on public.ng_locations for delete to public using (true);

create index if not exists idx_ng_locations_type on public.ng_locations(type);
create index if not exists idx_ng_locations_status on public.ng_locations(status);
