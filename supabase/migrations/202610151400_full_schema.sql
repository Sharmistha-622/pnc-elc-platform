--
-- PostgreSQL database dump
--

\restrict 1SfquRTEBng6Y2LvB9wtie12dDb1TD9pIrydG8FSe10JRLmgQcaoRQdXMoV3TTU

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: employee_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_type AS ENUM (
    'apprentice_nontech',
    'apprentice_tech',
    'intern',
    'fte',
    'ftc',
    'contractor'
);


--
-- Name: can_manage_forms(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_forms() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select public.current_app_role() in ('Super Admin', 'Admin', 'PnC')
$$;


--
-- Name: current_app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'Employee')
$$;


--
-- Name: current_employee_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_employee_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from public.employees
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;


--
-- Name: forms_clear_dangling_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_clear_dangling_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not exists (select 1 from public.form_versions where id = old.form_version_id) then
    return old; -- the whole version is being deleted
  end if;
  update public.form_sections
     set show_when = null
   where form_version_id = old.form_version_id
     and show_when ->> 'field_id' = old.id::text;
  return old;
end $$;


--
-- Name: forms_guard_answers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_guard_answers() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare v_status text;
begin
  select status into v_status from public.form_submissions
    where id = coalesce(new.submission_id, old.submission_id);
  if v_status is null and tg_op = 'DELETE' then
    return old;
  end if;
  if v_status is distinct from 'in_progress' then
    raise exception 'Answers cannot be changed once a form is submitted';
  end if;
  if tg_op <> 'DELETE' then
    if not exists (
      select 1 from public.form_fields f
      join public.form_submissions s on s.form_version_id = f.form_version_id
      where f.id = new.field_id and s.id = new.submission_id
    ) then
      raise exception 'This field does not belong to the submission''s form version';
    end if;
  end if;
  return coalesce(new, old);
end $$;


--
-- Name: forms_guard_structure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_guard_structure() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare v_status text;
begin
  if tg_op = 'UPDATE' and new.form_version_id <> old.form_version_id then
    raise exception 'A section or field cannot move to another version';
  end if;
  select status into v_status from public.form_versions
    where id = coalesce(new.form_version_id, old.form_version_id);
  if v_status is null and tg_op = 'DELETE' then
    return old; -- parent version is being deleted (draft cascade)
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'Sections and fields can only be changed on a draft version';
  end if;
  return coalesce(new, old);
end $$;


--
-- Name: forms_guard_submission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_guard_submission() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare v_status text; v_archived timestamptz;
begin
  if tg_op = 'INSERT' then
    select v.status, f.archived_at into v_status, v_archived
    from public.form_versions v join public.forms f on f.id = v.form_id
    where v.id = new.form_version_id;
    if v_status is distinct from 'published' or v_archived is not null then
      raise exception 'This form is not accepting submissions';
    end if;
  else
    if old.status = 'submitted' then
      raise exception 'A submitted form cannot be changed';
    end if;
    if new.form_version_id <> old.form_version_id then
      raise exception 'The form version of a submission cannot change';
    end if;
    if new.status = 'submitted' then
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;


--
-- Name: forms_guard_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_guard_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published or superseded form versions cannot be deleted';
    end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if not (old.status = 'published' and new.status = 'superseded'
            and new.form_id = old.form_id
            and new.version_number = old.version_number
            and new.published_at is not distinct from old.published_at) then
      raise exception 'Published form versions are immutable';
    end if;
  end if;
  return new;
end $$;


--
-- Name: forms_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


--
-- Name: forms_sync_request_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_sync_request_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.request_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    update public.form_requests set status = 'started'
      where id = new.request_id and status in ('pending', 'opened');
  elsif new.status = 'submitted' and old.status is distinct from 'submitted' then
    update public.form_requests set status = 'submitted' where id = new.request_id;
  end if;
  return new;
end $$;


--
-- Name: forms_validate_section_rule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_validate_section_rule() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_field uuid;
  v_type text;
  v_version uuid;
  v_order integer;
begin
  if new.show_when is null then
    return new;
  end if;

  begin
    v_field := (new.show_when ->> 'field_id')::uuid;
  exception when others then
    raise exception 'The condition does not point at a valid question';
  end;

  select f.field_type, f.form_version_id, s.order_index
    into v_type, v_version, v_order
  from public.form_fields f
  join public.form_sections s on s.id = f.section_id
  where f.id = v_field;

  if v_type is null then
    raise exception 'The condition points at a question that does not exist';
  end if;
  if v_version <> new.form_version_id then
    raise exception 'The condition must use a question from the same form version';
  end if;
  if v_order >= new.order_index then
    raise exception 'A section can only depend on a question in an earlier section';
  end if;
  if v_type not in ('single_select', 'multi_select', 'yes_no') then
    raise exception 'A condition can only use a single select, multi select or yes/no question';
  end if;

  return new;
end $$;


--
-- Name: log_forms_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_forms_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_event text;
  v_data jsonb;
begin
  if tg_table_name = 'forms' then
    if tg_op = 'INSERT' then
      v_event := 'form_created';
      v_data := jsonb_build_object('name', new.name, 'workflow', new.workflow);
    elsif tg_op = 'UPDATE' then
      if old.archived_at is null and new.archived_at is not null then
        v_event := 'form_archived';
        v_data := jsonb_build_object('name', new.name);
      elsif old.archived_at is not null and new.archived_at is null then
        v_event := 'form_restored';
        v_data := jsonb_build_object('name', new.name);
      elsif old.name is distinct from new.name or old.workflow is distinct from new.workflow then
        v_event := 'form_updated';
        v_data := jsonb_build_object(
          'old', jsonb_build_object('name', old.name, 'workflow', old.workflow),
          'new', jsonb_build_object('name', new.name, 'workflow', new.workflow)
        );
      end if;
    end if;
  elsif tg_table_name = 'form_versions' then
    if tg_op = 'INSERT' then
      v_event := 'version_created';
      v_data := jsonb_build_object('form_id', new.form_id, 'version_number', new.version_number);
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
      if new.status = 'published' then
        v_event := 'version_published';
      elsif new.status = 'superseded' then
        v_event := 'version_superseded';
      end if;
      if v_event is not null then
        v_data := jsonb_build_object('form_id', new.form_id, 'version_number', new.version_number);
      end if;
    end if;
  end if;

  if v_event is not null then
    insert into public.audit_log (table_name, record_id, action, changed_by, changed_data, created_at)
    values (
      tg_table_name,
      new.id,
      lower(tg_op),
      auth.uid(),
      jsonb_build_object('event', v_event) || coalesce(v_data, '{}'::jsonb),
      now()
    );
  end if;

  return new;
end $$;


--
-- Name: open_form_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_form_request(p_request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.form_requests
  set opened_at = coalesce(opened_at, now()),
      status = case when status = 'pending' then 'opened' else status end
  where id = p_request_id
    and respondent_employee_id = public.current_employee_id()
    and status in ('pending', 'opened', 'started');
end $$;


--
-- Name: publish_form_version(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_form_version(p_version_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare v_form_id uuid;
begin
  if not public.can_manage_forms() then
    raise exception 'Not allowed';
  end if;
  select form_id into v_form_id from public.form_versions
    where id = p_version_id and status = 'draft';
  if v_form_id is null then
    raise exception 'Only a draft version can be published';
  end if;
  if not exists (select 1 from public.form_fields where form_version_id = p_version_id) then
    raise exception 'Add at least one field before publishing';
  end if;
  update public.form_versions set status = 'superseded'
    where form_id = v_form_id and status = 'published';
  update public.form_versions set status = 'published', published_at = now()
    where id = p_version_id;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appraisal_eligibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appraisal_eligibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appraisals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appraisals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    cycle text NOT NULL,
    reference_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    appraisal_letter_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT appraisals_cycle_check CHECK ((cycle = ANY (ARRAY['july'::text, 'december'::text]))),
    CONSTRAINT appraisals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'skipped'::text])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    changed_by uuid,
    changed_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);


--
-- Name: confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    manager_decision text,
    reschedule_date date,
    timeline_type text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT confirmations_manager_decision_check CHECK ((manager_decision = ANY (ARRAY['yes'::text, 'no'::text, NULL::text]))),
    CONSTRAINT confirmations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rescheduled'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    document_type text NOT NULL,
    drive_folder text NOT NULL,
    drive_url text,
    signed_status text DEFAULT 'unsigned'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT documents_drive_folder_check CHECK ((drive_folder = ANY (ARRAY['team_member'::text, 'verification_docs'::text]))),
    CONSTRAINT documents_signed_status_check CHECK ((signed_status = ANY (ARRAY['unsigned'::text, 'signed'::text])))
);


--
-- Name: employee_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    personal_email text,
    official_email text,
    contact_number text,
    emergency_contact_number text,
    emergency_contact_name text,
    emergency_contact_relation_id uuid,
    permanent_address text,
    mailing_address_same boolean DEFAULT true,
    mailing_address text,
    address_proof_type_id uuid,
    address_proof_number text,
    id_proof_type_id uuid,
    id_proof_number text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    employee_type public.employee_type NOT NULL,
    joining_date date NOT NULL,
    confirmation_date date,
    conversion_date date,
    contractor_duration_months integer,
    appraisal_eligible boolean GENERATED ALWAYS AS ((employee_type = ANY (ARRAY['fte'::public.employee_type, 'ftc'::public.employee_type]))) STORED,
    pf_epf_applicable boolean DEFAULT true,
    pf_epf_opted_out boolean DEFAULT false,
    team text,
    manager_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    employee_type_id uuid,
    appraisal_eligibility_id uuid,
    pf_eligibility_id uuid,
    team_id uuid,
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'exited'::text])))
);


--
-- Name: form_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    field_id uuid NOT NULL,
    value jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: form_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_version_id uuid NOT NULL,
    section_id uuid NOT NULL,
    field_type text NOT NULL,
    label text NOT NULL,
    help_text text,
    is_required boolean DEFAULT true NOT NULL,
    order_index integer NOT NULL,
    options jsonb,
    show_when jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_fields_field_type_check CHECK ((field_type = ANY (ARRAY['short_text'::text, 'long_text'::text, 'number'::text, 'date'::text, 'single_select'::text, 'multi_select'::text, 'yes_no'::text, 'rating'::text, 'rating_grid'::text, 'employee_picker'::text])))
);


--
-- Name: form_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_version_id uuid NOT NULL,
    subject_employee_id uuid,
    respondent_employee_id uuid,
    respondent_email text,
    linked_confirmation_id uuid,
    linked_appraisal_id uuid,
    token_hash text,
    expires_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    opened_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_requests_check CHECK (((respondent_employee_id IS NOT NULL) OR (respondent_email IS NOT NULL))),
    CONSTRAINT form_requests_check1 CHECK ((NOT ((linked_confirmation_id IS NOT NULL) AND (linked_appraisal_id IS NOT NULL)))),
    CONSTRAINT form_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'opened'::text, 'started'::text, 'submitted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: form_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_version_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    order_index integer NOT NULL,
    show_when jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_sections_show_when_shape CHECK (((show_when IS NULL) OR ((jsonb_typeof(show_when) = 'object'::text) AND (show_when ? 'field_id'::text) AND (jsonb_typeof((show_when -> 'equals'::text)) = 'array'::text) AND (jsonb_array_length((show_when -> 'equals'::text)) > 0))))
);


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_version_id uuid NOT NULL,
    request_id uuid,
    subject_employee_id uuid,
    respondent_employee_id uuid,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_submissions_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text])))
);


--
-- Name: form_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    version_number integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'superseded'::text]))),
    CONSTRAINT form_versions_version_number_check CHECK ((version_number > 0))
);


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    workflow text,
    archived_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT forms_workflow_check CHECK ((workflow = ANY (ARRAY['confirmation'::text, 'appraisal'::text])))
);


--
-- Name: id_proof_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.id_proof_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


--
-- Name: peer_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    confirmation_id uuid NOT NULL,
    peer_employee_id uuid,
    peer_name text,
    response_status text DEFAULT 'pending'::text NOT NULL,
    feedback_text text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    peer_email text,
    CONSTRAINT peer_feedback_response_status_check CHECK ((response_status = ANY (ARRAY['pending'::text, 'submitted'::text, 'reminded'::text])))
);


--
-- Name: pf_eligibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pf_eligibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: relationship_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relationship_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


--
-- Name: roles_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    role text NOT NULL,
    team text,
    effective_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appraisal_eligibility appraisal_eligibility_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_eligibility
    ADD CONSTRAINT appraisal_eligibility_name_key UNIQUE (name);


--
-- Name: appraisal_eligibility appraisal_eligibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_eligibility
    ADD CONSTRAINT appraisal_eligibility_pkey PRIMARY KEY (id);


--
-- Name: appraisals appraisals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: confirmations confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confirmations
    ADD CONSTRAINT confirmations_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_employee_id_key UNIQUE (employee_id);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: employee_types employee_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_types
    ADD CONSTRAINT employee_types_name_key UNIQUE (name);


--
-- Name: employee_types employee_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_types
    ADD CONSTRAINT employee_types_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: form_answers form_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_answers
    ADD CONSTRAINT form_answers_pkey PRIMARY KEY (id);


--
-- Name: form_answers form_answers_submission_id_field_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_answers
    ADD CONSTRAINT form_answers_submission_id_field_id_key UNIQUE (submission_id, field_id);


--
-- Name: form_fields form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_pkey PRIMARY KEY (id);


--
-- Name: form_requests form_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_pkey PRIMARY KEY (id);


--
-- Name: form_requests form_requests_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_token_hash_key UNIQUE (token_hash);


--
-- Name: form_sections form_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_sections
    ADD CONSTRAINT form_sections_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_request_id_key UNIQUE (request_id);


--
-- Name: form_versions form_versions_form_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_versions
    ADD CONSTRAINT form_versions_form_id_version_number_key UNIQUE (form_id, version_number);


--
-- Name: form_versions form_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_versions
    ADD CONSTRAINT form_versions_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: id_proof_types id_proof_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.id_proof_types
    ADD CONSTRAINT id_proof_types_name_key UNIQUE (name);


--
-- Name: id_proof_types id_proof_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.id_proof_types
    ADD CONSTRAINT id_proof_types_pkey PRIMARY KEY (id);


--
-- Name: peer_feedback peer_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_feedback
    ADD CONSTRAINT peer_feedback_pkey PRIMARY KEY (id);


--
-- Name: pf_eligibility pf_eligibility_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pf_eligibility
    ADD CONSTRAINT pf_eligibility_name_key UNIQUE (name);


--
-- Name: pf_eligibility pf_eligibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pf_eligibility
    ADD CONSTRAINT pf_eligibility_pkey PRIMARY KEY (id);


--
-- Name: relationship_types relationship_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_types
    ADD CONSTRAINT relationship_types_name_key UNIQUE (name);


--
-- Name: relationship_types relationship_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_types
    ADD CONSTRAINT relationship_types_pkey PRIMARY KEY (id);


--
-- Name: roles_history roles_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_history
    ADD CONSTRAINT roles_history_pkey PRIMARY KEY (id);


--
-- Name: teams teams_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: form_answers_submission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_answers_submission_idx ON public.form_answers USING btree (submission_id);


--
-- Name: form_fields_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_fields_section_idx ON public.form_fields USING btree (section_id, order_index);


--
-- Name: form_fields_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_fields_version_idx ON public.form_fields USING btree (form_version_id);


--
-- Name: form_requests_respondent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_requests_respondent_idx ON public.form_requests USING btree (respondent_employee_id);


--
-- Name: form_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_requests_status_idx ON public.form_requests USING btree (status);


--
-- Name: form_requests_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_requests_version_idx ON public.form_requests USING btree (form_version_id);


--
-- Name: form_sections_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_sections_version_idx ON public.form_sections USING btree (form_version_id, order_index);


--
-- Name: form_submissions_respondent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_submissions_respondent_idx ON public.form_submissions USING btree (respondent_employee_id);


--
-- Name: form_submissions_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_submissions_version_idx ON public.form_submissions USING btree (form_version_id);


--
-- Name: form_versions_one_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX form_versions_one_draft ON public.form_versions USING btree (form_id) WHERE (status = 'draft'::text);


--
-- Name: form_versions_one_published; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX form_versions_one_published ON public.form_versions USING btree (form_id) WHERE (status = 'published'::text);


--
-- Name: form_answers form_answers_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_answers_guard BEFORE INSERT OR DELETE OR UPDATE ON public.form_answers FOR EACH ROW EXECUTE FUNCTION public.forms_guard_answers();


--
-- Name: form_answers form_answers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_answers_updated_at BEFORE UPDATE ON public.form_answers FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: form_fields form_fields_clear_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_fields_clear_rules AFTER DELETE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.forms_clear_dangling_rules();


--
-- Name: form_fields form_fields_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_fields_guard BEFORE INSERT OR DELETE OR UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.forms_guard_structure();


--
-- Name: form_fields form_fields_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_fields_updated_at BEFORE UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: form_requests form_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_requests_updated_at BEFORE UPDATE ON public.form_requests FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: form_sections form_sections_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_sections_guard BEFORE INSERT OR DELETE OR UPDATE ON public.form_sections FOR EACH ROW EXECUTE FUNCTION public.forms_guard_structure();


--
-- Name: form_sections form_sections_rule_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_sections_rule_check BEFORE INSERT OR UPDATE OF show_when, order_index ON public.form_sections FOR EACH ROW EXECUTE FUNCTION public.forms_validate_section_rule();


--
-- Name: form_sections form_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_sections_updated_at BEFORE UPDATE ON public.form_sections FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: form_submissions form_submissions_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_submissions_guard BEFORE INSERT OR UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.forms_guard_submission();


--
-- Name: form_submissions form_submissions_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_submissions_sync AFTER INSERT OR UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.forms_sync_request_status();


--
-- Name: form_submissions form_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_submissions_updated_at BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: form_versions form_versions_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_versions_audit AFTER INSERT OR UPDATE ON public.form_versions FOR EACH ROW EXECUTE FUNCTION public.log_forms_audit();


--
-- Name: form_versions form_versions_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_versions_guard BEFORE DELETE OR UPDATE ON public.form_versions FOR EACH ROW EXECUTE FUNCTION public.forms_guard_version();


--
-- Name: form_versions form_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_versions_updated_at BEFORE UPDATE ON public.form_versions FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: forms forms_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER forms_audit AFTER INSERT OR UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.log_forms_audit();


--
-- Name: forms forms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER forms_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();


--
-- Name: appraisals appraisals_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: confirmations confirmations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confirmations
    ADD CONSTRAINT confirmations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: documents documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_profiles employee_profiles_address_proof_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_address_proof_type_id_fkey FOREIGN KEY (address_proof_type_id) REFERENCES public.id_proof_types(id);


--
-- Name: employee_profiles employee_profiles_emergency_contact_relation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_emergency_contact_relation_id_fkey FOREIGN KEY (emergency_contact_relation_id) REFERENCES public.relationship_types(id);


--
-- Name: employee_profiles employee_profiles_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_profiles employee_profiles_id_proof_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_id_proof_type_id_fkey FOREIGN KEY (id_proof_type_id) REFERENCES public.id_proof_types(id);


--
-- Name: employees employees_appraisal_eligibility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_appraisal_eligibility_id_fkey FOREIGN KEY (appraisal_eligibility_id) REFERENCES public.appraisal_eligibility(id);


--
-- Name: employees employees_employee_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_type_id_fkey FOREIGN KEY (employee_type_id) REFERENCES public.employee_types(id);


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id);


--
-- Name: employees employees_pf_eligibility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pf_eligibility_id_fkey FOREIGN KEY (pf_eligibility_id) REFERENCES public.pf_eligibility(id);


--
-- Name: employees employees_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: form_answers form_answers_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_answers
    ADD CONSTRAINT form_answers_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.form_fields(id);


--
-- Name: form_answers form_answers_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_answers
    ADD CONSTRAINT form_answers_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;


--
-- Name: form_fields form_fields_form_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES public.form_versions(id) ON DELETE CASCADE;


--
-- Name: form_fields form_fields_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.form_sections(id) ON DELETE CASCADE;


--
-- Name: form_requests form_requests_form_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES public.form_versions(id);


--
-- Name: form_requests form_requests_linked_appraisal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_linked_appraisal_id_fkey FOREIGN KEY (linked_appraisal_id) REFERENCES public.appraisals(id);


--
-- Name: form_requests form_requests_linked_confirmation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_linked_confirmation_id_fkey FOREIGN KEY (linked_confirmation_id) REFERENCES public.confirmations(id);


--
-- Name: form_requests form_requests_respondent_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_respondent_employee_id_fkey FOREIGN KEY (respondent_employee_id) REFERENCES public.employees(id);


--
-- Name: form_requests form_requests_subject_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_subject_employee_id_fkey FOREIGN KEY (subject_employee_id) REFERENCES public.employees(id);


--
-- Name: form_sections form_sections_form_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_sections
    ADD CONSTRAINT form_sections_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES public.form_versions(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_form_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES public.form_versions(id);


--
-- Name: form_submissions form_submissions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.form_requests(id);


--
-- Name: form_submissions form_submissions_respondent_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_respondent_employee_id_fkey FOREIGN KEY (respondent_employee_id) REFERENCES public.employees(id);


--
-- Name: form_submissions form_submissions_subject_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_subject_employee_id_fkey FOREIGN KEY (subject_employee_id) REFERENCES public.employees(id);


--
-- Name: form_versions form_versions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_versions
    ADD CONSTRAINT form_versions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: peer_feedback peer_feedback_confirmation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_feedback
    ADD CONSTRAINT peer_feedback_confirmation_id_fkey FOREIGN KEY (confirmation_id) REFERENCES public.confirmations(id);


--
-- Name: peer_feedback peer_feedback_peer_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_feedback
    ADD CONSTRAINT peer_feedback_peer_employee_id_fkey FOREIGN KEY (peer_employee_id) REFERENCES public.employees(id);


--
-- Name: roles_history roles_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_history
    ADD CONSTRAINT roles_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: confirmations allow all insert confirmations for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow all insert confirmations for dev" ON public.confirmations FOR INSERT WITH CHECK (true);


--
-- Name: peer_feedback allow all insert peer_feedback for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow all insert peer_feedback for dev" ON public.peer_feedback FOR INSERT WITH CHECK (true);


--
-- Name: employees allow anon read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow anon read for dev" ON public.employees FOR SELECT TO anon USING (true);


--
-- Name: employee_profiles allow dev access to profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow dev access to profiles" ON public.employee_profiles USING (true) WITH CHECK (true);


--
-- Name: appraisal_eligibility allow read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read for dev" ON public.appraisal_eligibility FOR SELECT USING (true);


--
-- Name: employee_types allow read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read for dev" ON public.employee_types FOR SELECT USING (true);


--
-- Name: id_proof_types allow read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read for dev" ON public.id_proof_types FOR SELECT USING (true);


--
-- Name: pf_eligibility allow read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read for dev" ON public.pf_eligibility FOR SELECT USING (true);


--
-- Name: relationship_types allow read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read for dev" ON public.relationship_types FOR SELECT USING (true);


--
-- Name: teams allow read for dev; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read for dev" ON public.teams FOR SELECT USING (true);


--
-- Name: appraisal_eligibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appraisal_eligibility ENABLE ROW LEVEL SECURITY;

--
-- Name: appraisals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: appraisals authenticated users can insert appraisals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert appraisals" ON public.appraisals FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: audit_log authenticated users can insert audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: confirmations authenticated users can insert confirmations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert confirmations" ON public.confirmations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: documents authenticated users can insert documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: employees authenticated users can insert employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: peer_feedback authenticated users can insert peer_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert peer_feedback" ON public.peer_feedback FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: roles_history authenticated users can insert roles_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert roles_history" ON public.roles_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: appraisals authenticated users can read appraisals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read appraisals" ON public.appraisals FOR SELECT TO authenticated USING (true);


--
-- Name: audit_log authenticated users can read audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);


--
-- Name: confirmations authenticated users can read confirmations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read confirmations" ON public.confirmations FOR SELECT TO authenticated USING (true);


--
-- Name: documents authenticated users can read documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read documents" ON public.documents FOR SELECT TO authenticated USING (true);


--
-- Name: employees authenticated users can read employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read employees" ON public.employees FOR SELECT TO authenticated USING (true);


--
-- Name: peer_feedback authenticated users can read peer_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read peer_feedback" ON public.peer_feedback FOR SELECT TO authenticated USING (true);


--
-- Name: roles_history authenticated users can read roles_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read roles_history" ON public.roles_history FOR SELECT TO authenticated USING (true);


--
-- Name: appraisals authenticated users can update appraisals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can update appraisals" ON public.appraisals FOR UPDATE TO authenticated USING (true);


--
-- Name: confirmations authenticated users can update confirmations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can update confirmations" ON public.confirmations FOR UPDATE TO authenticated USING (true);


--
-- Name: employees authenticated users can update employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can update employees" ON public.employees FOR UPDATE TO authenticated USING (true);


--
-- Name: peer_feedback authenticated users can update peer_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can update peer_feedback" ON public.peer_feedback FOR UPDATE TO authenticated USING (true);


--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_types ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: form_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: form_answers form_answers_manage_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_answers_manage_read ON public.form_answers FOR SELECT TO authenticated USING (public.can_manage_forms());


--
-- Name: form_answers form_answers_own_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_answers_own_all ON public.form_answers TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.form_submissions s
  WHERE ((s.id = form_answers.submission_id) AND (s.respondent_employee_id = public.current_employee_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.form_submissions s
  WHERE ((s.id = form_answers.submission_id) AND (s.respondent_employee_id = public.current_employee_id())))));


--
-- Name: form_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: form_fields form_fields_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_fields_manage ON public.form_fields TO authenticated USING (public.can_manage_forms()) WITH CHECK (public.can_manage_forms());


--
-- Name: form_fields form_fields_respondent_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_fields_respondent_read ON public.form_fields FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.form_requests r
  WHERE ((r.form_version_id = form_fields.form_version_id) AND (r.respondent_employee_id = public.current_employee_id())))));


--
-- Name: form_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: form_requests form_requests_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_requests_manage ON public.form_requests TO authenticated USING (public.can_manage_forms()) WITH CHECK (public.can_manage_forms());


--
-- Name: form_requests form_requests_respondent_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_requests_respondent_read ON public.form_requests FOR SELECT TO authenticated USING ((respondent_employee_id = public.current_employee_id()));


--
-- Name: form_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: form_sections form_sections_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_sections_manage ON public.form_sections TO authenticated USING (public.can_manage_forms()) WITH CHECK (public.can_manage_forms());


--
-- Name: form_sections form_sections_respondent_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_sections_respondent_read ON public.form_sections FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.form_requests r
  WHERE ((r.form_version_id = form_sections.form_version_id) AND (r.respondent_employee_id = public.current_employee_id())))));


--
-- Name: form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: form_submissions form_submissions_manage_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_manage_read ON public.form_submissions FOR SELECT TO authenticated USING (public.can_manage_forms());


--
-- Name: form_submissions form_submissions_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_own_insert ON public.form_submissions FOR INSERT TO authenticated WITH CHECK (((respondent_employee_id = public.current_employee_id()) AND (EXISTS ( SELECT 1
   FROM public.form_requests r
  WHERE ((r.id = form_submissions.request_id) AND (r.respondent_employee_id = public.current_employee_id()) AND (r.form_version_id = form_submissions.form_version_id) AND (r.status = ANY (ARRAY['pending'::text, 'opened'::text, 'started'::text])) AND ((r.expires_at IS NULL) OR (r.expires_at > now())))))));


--
-- Name: form_submissions form_submissions_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_own_read ON public.form_submissions FOR SELECT TO authenticated USING ((respondent_employee_id = public.current_employee_id()));


--
-- Name: form_submissions form_submissions_own_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_own_update ON public.form_submissions FOR UPDATE TO authenticated USING (((respondent_employee_id = public.current_employee_id()) AND (status = 'in_progress'::text))) WITH CHECK ((respondent_employee_id = public.current_employee_id()));


--
-- Name: form_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: form_versions form_versions_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_versions_manage ON public.form_versions TO authenticated USING (public.can_manage_forms()) WITH CHECK (public.can_manage_forms());


--
-- Name: form_versions form_versions_respondent_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_versions_respondent_read ON public.form_versions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.form_requests r
  WHERE ((r.form_version_id = form_versions.id) AND (r.respondent_employee_id = public.current_employee_id())))));


--
-- Name: forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

--
-- Name: forms forms_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_manage ON public.forms TO authenticated USING (public.can_manage_forms()) WITH CHECK (public.can_manage_forms());


--
-- Name: forms forms_respondent_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_respondent_read ON public.forms FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.form_versions v
     JOIN public.form_requests r ON ((r.form_version_id = v.id)))
  WHERE ((v.form_id = forms.id) AND (r.respondent_employee_id = public.current_employee_id())))));


--
-- Name: id_proof_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.id_proof_types ENABLE ROW LEVEL SECURITY;

--
-- Name: pf_eligibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pf_eligibility ENABLE ROW LEVEL SECURITY;

--
-- Name: relationship_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.relationship_types ENABLE ROW LEVEL SECURITY;

--
-- Name: roles_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles_history ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 1SfquRTEBng6Y2LvB9wtie12dDb1TD9pIrydG8FSe10JRLmgQcaoRQdXMoV3TTU

