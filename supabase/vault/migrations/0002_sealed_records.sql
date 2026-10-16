-- ===========================================================================
-- VAULT — receiving sealed records from core
-- ---------------------------------------------------------------------------
-- Apply after 0001, from Super Admin's machine only.
--
-- Core verifies ID documents and collects feedback while a process is running,
-- then seals both here. This adds what the sealed copies need: the full
-- document number (core keeps only the last four characters) and the
-- provenance of a record that began life in core.
-- ===========================================================================

-------------------------------------------------------------------------
-- 1. Document numbers
-------------------------------------------------------------------------
alter table identity_documents
  add column if not exists document_number text,
  -- Who typed it in, in core, at verification time.
  add column if not exists number_captured_by text,
  add column if not exists number_captured_at timestamptz,
  -- The core row this was sealed from, so the two sides can be reconciled.
  add column if not exists core_document_id uuid,
  add column if not exists sealed_at timestamptz;

create unique index if not exists identity_documents_core_ref
  on identity_documents (core_document_id) where core_document_id is not null;

comment on column identity_documents.document_number is
  'The full number. Core holds only the last four characters; this is the only copy. Read it through read-identity-number, which logs.';

-------------------------------------------------------------------------
-- 2. Feedback sealed from core
-------------------------------------------------------------------------
alter table feedback
  add column if not exists core_feedback_id uuid,
  add column if not exists sealed_at timestamptz,
  -- The cycle whose closure sealed it.
  add column if not exists sealed_on_event text;

create unique index if not exists feedback_core_ref
  on feedback (core_feedback_id) where core_feedback_id is not null;

-------------------------------------------------------------------------
-- 3. Reading a document number is a logged read like any other
-------------------------------------------------------------------------
-- Deliberately its own action rather than folded into a document read: a
-- number is usable on its own in a way a scan is not, so it is worth being
-- able to ask the log "who has read someone's Aadhaar number" separately.
create or replace function read_identity_number(
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_role text,
  p_document_id uuid
) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_number text;
  v_person uuid;
begin
  if p_actor_role not in ('super_admin', 'pnc_admin', 'fin_admin', 'fin_ops') then
    raise exception 'Role % cannot read identity numbers', p_actor_role
      using errcode = 'insufficient_privilege';
  end if;

  select document_number, person_id into v_number, v_person
    from identity_documents where id = p_document_id;

  if v_number is null then
    return null;
  end if;

  perform log_access(
    p_actor_user_id, p_actor_email, p_actor_role,
    'read_identity_number', 'identity_documents', v_person, 1, false, null
  );

  return v_number;
end;
$$;

comment on function read_identity_number is
  'The only read path for a full document number. Logs before returning; refuses roles that have no business with it.';
