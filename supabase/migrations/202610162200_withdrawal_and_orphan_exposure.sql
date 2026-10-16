-- ===========================================================================
-- Withdrawal, and the exposures it strands
-- ---------------------------------------------------------------------------
-- A withdrawn joiner's documents are the awkward case the sealing design
-- creates: sealing is triggered by verification, and nobody verifies the
-- documents of someone who never joined. So they sit staged in core
-- indefinitely, with no event that will ever move them.
--
-- This does not delete anything. It makes those records visible as what they
-- are — exposures with no future trigger — and gives P&C an explicit action.
-- Deleting a withdrawn joiner's documents is open decision #6; the mechanism
-- exists here, the policy does not run by itself.
-- ===========================================================================

alter table onboarding_documents
  add column if not exists purged_at timestamptz,
  add column if not exists purged_by text,
  add column if not exists purge_reason text;

comment on column onboarding_documents.purged_at is
  'Set when the staged file was deleted from core without being sealed — a withdrawn joiner. The row is kept; the file is gone.';

-- A purged document has no file and no vault copy. It is not sealed, and must
-- not be mistaken for sealed.
alter table onboarding_documents
  drop constraint if exists onboarding_documents_purged_is_empty;
alter table onboarding_documents
  add constraint onboarding_documents_purged_is_empty
  check (purged_at is null or (storage_reference is null and seal_state <> 'sealed'));

-- ---------------------------------------------------------------------------
-- Exposure list, with orphans called out
-- ---------------------------------------------------------------------------
drop view if exists exposed_records;
create view exposed_records as
  select
    'identity_document'::text as kind,
    d.id,
    d.onboarding_id as parent_id,
    r.candidate_name as person,
    d.document_type as label,
    d.seal_state,
    d.staged_at,
    (now()::date - d.staged_at::date) as days_staged,
    (now()::date - d.staged_at::date) > 14 as overdue,
    -- Nothing will ever seal this: the joiner withdrew, so no verification is
    -- coming. It needs a decision, not patience.
    (r.joiner_status = 'withdrawn') as orphaned
  from onboarding_documents d
  join onboarding_records r on r.id = d.onboarding_id
  where d.seal_state <> 'sealed'
    and d.storage_reference is not null
    and d.purged_at is null

  union all

  select
    'feedback'::text,
    f.id,
    f.confirmation_id,
    null,
    coalesce(f.peer_name, f.peer_email, 'peer feedback'),
    f.seal_state,
    f.staged_at,
    (now()::date - f.staged_at::date),
    (now()::date - f.staged_at::date) > 30,
    false
  from public.peer_feedback f
  where f.seal_state <> 'sealed'
    and f.feedback_text is not null;

comment on view exposed_records is
  'Sensitive records still sitting in core. Each row is an open exposure to the platform team. `orphaned` means no trigger will ever seal it.';
