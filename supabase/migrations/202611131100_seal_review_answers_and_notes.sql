-- ============================================================================
-- Seal review form answers and decision notes when a cycle closes (#101, #173)
-- ----------------------------------------------------------------------------
-- Adds sealing state + vault pointers to `form_answers` and `review_decisions`,
-- and extends `exposed_records` so unsealed review answers and decision notes
-- are tracked against the 30-day feedback exposure budget until sealed.
--
-- Safe to re-run.
--
-- Check after applying:
--   select column_name from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('form_answers', 'review_decisions')
--      and column_name in ('seal_state', 'staged_at', 'sealed_at', 'vault_feedback_id', 'vault_note_id', 'vault_pnc_note_id')
--    order by table_name, column_name;
--   select pg_get_viewdef('public.exposed_records'::regclass, true);
-- ============================================================================

begin;

alter table public.form_answers
  add column if not exists seal_state text not null default 'staged'
    check (seal_state in ('staged', 'sealing', 'sealed', 'seal_failed')),
  add column if not exists staged_at timestamptz not null default now(),
  add column if not exists sealed_at timestamptz,
  add column if not exists seal_error text,
  add column if not exists vault_feedback_id uuid;

alter table public.review_decisions
  add column if not exists seal_state text not null default 'staged'
    check (seal_state in ('staged', 'sealing', 'sealed', 'seal_failed')),
  add column if not exists staged_at timestamptz not null default now(),
  add column if not exists sealed_at timestamptz,
  add column if not exists seal_error text,
  add column if not exists vault_note_id uuid,
  add column if not exists vault_pnc_note_id uuid;

create or replace view public.exposed_records as
  select
    'identity_document'::text as kind,
    d.id,
    d.onboarding_id as parent_id,
    r.candidate_name as person,
    d.document_type as label,
    d.seal_state,
    d.staged_at,
    (now()::date - d.staged_at::date) as days_staged,
    (now()::date - d.staged_at::date) > coalesce(
      (select staging_budget_document_days from public.dpdp_settings where id = 'default'), 14) as overdue,
    (r.joiner_status = 'withdrawn') as orphaned
  from public.onboarding_documents d
  join public.onboarding_records r on r.id = d.onboarding_id
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
    (now()::date - f.staged_at::date) > coalesce(
      (select staging_budget_feedback_days from public.dpdp_settings where id = 'default'), 30),
    false
  from public.peer_feedback f
  where f.seal_state <> 'sealed'
    and f.feedback_text is not null

  union all

  select
    'form_answer'::text,
    a.id,
    p.cycle_id,
    null,
    coalesce(p.role, 'review answer'),
    a.seal_state,
    a.staged_at,
    (now()::date - a.staged_at::date),
    (now()::date - a.staged_at::date) > coalesce(
      (select staging_budget_feedback_days from public.dpdp_settings where id = 'default'), 30),
    false
  from public.form_answers a
  join public.form_submissions s on s.id = a.submission_id
  join public.review_participants p on p.form_request_id = s.request_id
  where a.seal_state <> 'sealed'
    and a.value is not null

  union all

  select
    'decision_note'::text,
    rd.cycle_id,
    rd.cycle_id,
    null,
    rd.decision,
    rd.seal_state,
    rd.staged_at,
    (now()::date - rd.staged_at::date),
    (now()::date - rd.staged_at::date) > coalesce(
      (select staging_budget_feedback_days from public.dpdp_settings where id = 'default'), 30),
    false
  from public.review_decisions rd
  where rd.seal_state <> 'sealed'
    and (rd.note is not null or rd.pnc_note is not null);

revoke all on public.exposed_records from anon, authenticated;

commit;

