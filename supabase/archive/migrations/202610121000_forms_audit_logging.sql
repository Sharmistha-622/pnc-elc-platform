-- Audit logging for the forms module, written to the existing public.audit_log table.
-- audit_log only accepts action = insert / update / delete, so the specific event
-- (form_created, form_archived, version_published ...) is stored inside changed_data.
-- Safe to run more than once, and safe if an earlier version was already applied.

create or replace function public.log_forms_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.log_forms_audit() from public, anon, authenticated;

drop trigger if exists forms_audit on public.forms;
create trigger forms_audit
  after insert or update on public.forms
  for each row execute function public.log_forms_audit();

drop trigger if exists form_versions_audit on public.form_versions;
create trigger form_versions_audit
  after insert or update on public.form_versions
  for each row execute function public.log_forms_audit();
