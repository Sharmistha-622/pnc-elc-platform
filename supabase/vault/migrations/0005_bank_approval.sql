-- ===========================================================================
-- VAULT — bank details: submit, then approve
-- ---------------------------------------------------------------------------
-- Apply after 0004, from Super Admin's machine only. Safe to re-run.
--
-- A salary goes to whatever account is `active` in bank_details, so getting a
-- row there is the most direct way to misdirect pay. Two functions are the
-- only way in, and the rules live here, in the database, not in the Edge
-- Functions that call them:
--
--   submit_bank_details   called by `submit-bank` (core vouches for the
--                         person). Lands as `pending`; a newer submission
--                         replaces an older pending one. Never live.
--   decide_bank_details   called by `approve-bank` (a signed-in vault user).
--                         Approve makes it `active` and the previous active
--                         account `superseded`; reject needs a reason.
--
-- Refused, whoever asks:
--   * approving or rejecting your own submission (submitted_by = you);
--   * approving an account number + IFSC already active for someone else
--     (V-01: one bank account maps to one person);
--   * an IFSC that is not AAAA0XXXXXX (V-03), or an account number that is
--     not 9–18 digits.
--
-- Every decision writes a row to payroll_audit. 0003's default privileges
-- keep both functions away from anon and authenticated; the vault probe
-- checks that.
-- ===========================================================================

alter table bank_details add column if not exists submitted_by text;
alter table bank_details add column if not exists proof_path text;
-- Who approved OR rejected: approved_by / approved_at hold the decision either way.
alter table bank_details add column if not exists approved_by_user_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_details_ifsc_format') then
    alter table bank_details add constraint bank_details_ifsc_format
      check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bank_details_account_number_format') then
    alter table bank_details add constraint bank_details_account_number_format
      check (account_number ~ '^[0-9]{9,18}$');
  end if;
end $$;

-- One pending submission per person at a time.
create unique index if not exists bank_details_one_pending
  on bank_details (person_id) where status = 'pending';
create index if not exists bank_details_account_idx
  on bank_details (account_number, ifsc) where status = 'active';

create or replace function submit_bank_details(
  p_person_id uuid,
  p_account_name text,
  p_account_number text,
  p_ifsc text,
  p_bank_name text,
  p_submitted_by text,
  p_proof_path text
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_account_name), '') = '' then
    raise exception 'account_name_required' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_submitted_by), '') = '' then
    raise exception 'submitted_by_required' using errcode = 'P0001';
  end if;

  update bank_details set status = 'superseded'
   where person_id = p_person_id and status = 'pending';

  insert into bank_details (person_id, account_name, account_number, ifsc, bank_name, submitted_by, proof_path)
  values (
    p_person_id,
    trim(p_account_name),
    regexp_replace(p_account_number, '\s', '', 'g'),
    upper(trim(p_ifsc)),
    nullif(trim(p_bank_name), ''),
    lower(trim(p_submitted_by)),
    p_proof_path
  )
  returning id into v_id;

  return v_id;
end $$;

create or replace function decide_bank_details(
  p_id uuid,
  p_decision text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_role text,
  p_reason text default null
) returns text
  language plpgsql security definer set search_path = public as $$
declare
  r bank_details%rowtype;
  v_previous uuid;
begin
  if p_actor_role not in ('super_admin', 'fin_admin') then
    raise exception 'role_cannot_decide' using errcode = 'P0001';
  end if;

  select * into r from bank_details where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if r.submitted_by is not null and lower(r.submitted_by) = lower(trim(p_actor_email)) then
    raise exception 'own_submission' using errcode = 'P0001';
  end if;

  if p_decision = 'reject' then
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update bank_details
       set status = 'rejected', rejection_reason = trim(p_reason),
           approved_by = lower(trim(p_actor_email)), approved_by_user_id = p_actor_user_id, approved_at = now()
     where id = p_id;
    insert into payroll_audit (actor_user_id, actor_email, actor_role, entity, entity_id, subject_person_id, action, before, after, reason)
    values (p_actor_user_id, lower(trim(p_actor_email)), p_actor_role, 'bank_details', p_id::text, r.person_id, 'update',
            jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'), trim(p_reason));
    return 'rejected';
  end if;

  if p_decision <> 'approve' then
    raise exception 'bad_decision' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from bank_details
     where status = 'active' and person_id <> r.person_id
       and account_number = r.account_number and ifsc = r.ifsc
  ) then
    raise exception 'account_in_use' using errcode = 'P0001';
  end if;

  update bank_details set status = 'superseded'
   where person_id = r.person_id and status = 'active'
  returning id into v_previous;

  update bank_details
     set status = 'active',
         approved_by = lower(trim(p_actor_email)), approved_by_user_id = p_actor_user_id, approved_at = now()
   where id = p_id;

  -- The audit row names the change, never the account number.
  insert into payroll_audit (actor_user_id, actor_email, actor_role, entity, entity_id, subject_person_id, action, before, after, reason)
  values (p_actor_user_id, lower(trim(p_actor_email)), p_actor_role, 'bank_details', p_id::text, r.person_id, 'approve',
          jsonb_build_object('active_id', v_previous),
          jsonb_build_object('active_id', p_id, 'ifsc', r.ifsc, 'account_last4', right(r.account_number, 4)),
          coalesce(nullif(trim(p_reason), ''), 'Approved against the bank proof'));
  return 'active';
end $$;
