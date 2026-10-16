-- ===========================================================================
-- Sealing: core is the working area, the vault is the archive
-- ---------------------------------------------------------------------------
-- Resolves open decisions #1 and #2, which turned out to be one mechanism:
--
--   ID documents     are uploaded to core, verified there by PnC Ops, and seal
--                    into the vault on approval.
--   Written feedback is collected in core while a confirmation or appraisal
--                    cycle runs, and seals when the cycle closes.
--
-- Afterwards core keeps a residue — the fact, who did it, when, and a masked
-- number — and the sensitive part is reachable only through a logged vault
-- read. While a record is staged it sits in core, where the platform team can
-- read it, so the staging window is the exposure and sealing is the control.
-- ===========================================================================

-------------------------------------------------------------------------
-- 1. Sealing state, shared shape across both staged kinds
-------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'seal_state') then
    create type seal_state as enum ('staged', 'sealing', 'sealed', 'seal_failed');
  end if;
end $$;

-------------------------------------------------------------------------
-- 2. Identity documents
-------------------------------------------------------------------------
alter table onboarding_documents
  add column if not exists seal_state seal_state not null default 'staged',
  add column if not exists staged_at timestamptz not null default now(),
  add column if not exists sealed_at timestamptz,
  add column if not exists seal_error text,
  -- The row in the vault, for a logged read by someone entitled to one.
  add column if not exists vault_document_id uuid,
  -- Captured at verification. Only the last four characters are kept here; the
  -- full number lives in the vault. An Aadhaar or PAN number is a key, not a
  -- label, so core must not be able to reconstruct it.
  add column if not exists document_number_last4 text,
  add column if not exists number_captured_by text,
  add column if not exists number_captured_at timestamptz;

alter table onboarding_documents
  drop constraint if exists onboarding_documents_number_last4_check;
alter table onboarding_documents
  add constraint onboarding_documents_number_last4_check
  check (document_number_last4 is null or document_number_last4 ~ '^[A-Za-z0-9]{4}$');

-- Once sealed there must be nothing left in core but the residue: no storage
-- object, and a pointer to the vault row that replaced it.
alter table onboarding_documents
  drop constraint if exists onboarding_documents_sealed_is_empty;
alter table onboarding_documents
  add constraint onboarding_documents_sealed_is_empty
  check (
    seal_state <> 'sealed'
    or (storage_reference is null and vault_document_id is not null and sealed_at is not null)
  );

create index if not exists onboarding_documents_exposed_idx
  on onboarding_documents (staged_at)
  where seal_state <> 'sealed';

-------------------------------------------------------------------------
-- 3. Written feedback
-------------------------------------------------------------------------
alter table public.peer_feedback
  add column if not exists seal_state seal_state not null default 'staged',
  add column if not exists staged_at timestamptz not null default now(),
  add column if not exists sealed_at timestamptz,
  add column if not exists seal_error text,
  add column if not exists vault_feedback_id uuid;

-- Sealing a piece of feedback means the text is gone from core.
alter table public.peer_feedback
  drop constraint if exists peer_feedback_sealed_is_empty;
alter table public.peer_feedback
  add constraint peer_feedback_sealed_is_empty
  check (
    seal_state <> 'sealed'
    or (feedback_text is null and vault_feedback_id is not null and sealed_at is not null)
  );

create index if not exists peer_feedback_exposed_idx
  on public.peer_feedback (staged_at)
  where seal_state <> 'sealed';

-------------------------------------------------------------------------
-- 4. What is still exposed
-------------------------------------------------------------------------
-- The list P&C and Super Admin work from. Anything here is sensitive data
-- sitting in core; the age column is the thing to watch, not the count.
create or replace view exposed_records as
  select
    'identity_document'::text as kind,
    d.id,
    d.onboarding_id as parent_id,
    d.document_type as label,
    d.seal_state,
    d.staged_at,
    (now()::date - d.staged_at::date) as days_staged,
    (now()::date - d.staged_at::date) > 14 as overdue
  from onboarding_documents d
  where d.seal_state <> 'sealed'
    and d.storage_reference is not null

  union all

  select
    'feedback'::text,
    f.id,
    f.confirmation_id,
    coalesce(f.peer_name, f.peer_email, 'peer feedback'),
    f.seal_state,
    f.staged_at,
    (now()::date - f.staged_at::date),
    (now()::date - f.staged_at::date) > 30
  from public.peer_feedback f
  where f.seal_state <> 'sealed'
    and f.feedback_text is not null;

comment on view exposed_records is
  'Sensitive records still sitting in core. Each row is an open exposure to the platform team; sealing is what closes it.';
