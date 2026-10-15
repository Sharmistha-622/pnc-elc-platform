-- Forms branching: show a section only when an earlier question has a given answer.
-- show_when = {"field_id": "<uuid of the question>", "equals": ["answer", "answer"]}
-- Safe to run more than once.

-- 1) The rule must have the right shape
alter table public.form_sections drop constraint if exists form_sections_show_when_shape;
alter table public.form_sections add constraint form_sections_show_when_shape check (
  show_when is null or (
    jsonb_typeof(show_when) = 'object'
    and show_when ? 'field_id'
    and jsonb_typeof(show_when -> 'equals') = 'array'
    and jsonb_array_length(show_when -> 'equals') > 0
  )
);

-- 2) The rule must point at a usable question in an EARLIER section of the SAME version
create or replace function public.forms_validate_section_rule()
returns trigger
language plpgsql
as $$
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

drop trigger if exists form_sections_rule_check on public.form_sections;
create trigger form_sections_rule_check
  before insert or update of show_when, order_index on public.form_sections
  for each row execute function public.forms_validate_section_rule();

-- 3) Deleting a question removes any condition that depended on it
create or replace function public.forms_clear_dangling_rules()
returns trigger
language plpgsql
as $$
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

drop trigger if exists form_fields_clear_rules on public.form_fields;
create trigger form_fields_clear_rules
  after delete on public.form_fields
  for each row execute function public.forms_clear_dangling_rules();
