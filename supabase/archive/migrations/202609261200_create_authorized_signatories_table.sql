-- Migration: 202609261200_create_authorized_signatories_table.sql
-- Description: Creates the authorized_signatories table for managing official letter signing authorities.

create table if not exists authorized_signatories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text not null,
  email text,
  signature_url text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Index for quick lookups of active / default signatories
create index if not exists idx_authorized_signatories_active on authorized_signatories(is_active);
create index if not exists idx_authorized_signatories_default on authorized_signatories(is_default);

-- Seed with verified initial organization signatories
insert into authorized_signatories (name, designation, email, is_default, is_active) values
  ('Nitin Sudarshan', 'People & Culture Lead, NavGurukul', 'nitin@navgurukul.org', true, true),
  ('Sharmistha Mazumdar', 'People & Culture Lead, NavGurukul', 'sharmistha@navgurukul.org', false, true),
  ('Anurag Kundu', 'Executive Director, NavGurukul', 'anurag@navgurukul.org', false, true)
on conflict do nothing;
