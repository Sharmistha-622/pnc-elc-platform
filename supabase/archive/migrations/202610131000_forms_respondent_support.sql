-- Respondent support for the Forms module.
-- 1) open_form_request: lets a signed-in respondent mark their request as opened.
-- 2) A trigger keeps form_requests.status in step with the respondent's submission.
-- Safe to run more than once.

create or replace function public.open_form_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.form_requests
  set opened_at = coalesce(opened_at, now()),
      status = case when status = 'pending' then 'opened' else status end
  where id = p_request_id
    and respondent_employee_id = public.current_employee_id()
    and status in ('pending', 'opened', 'started');
end $$;

create or replace function public.forms_sync_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists form_submissions_sync on public.form_submissions;
create trigger form_submissions_sync
  after insert or update on public.form_submissions
  for each row execute function public.forms_sync_request_status();

revoke all on function public.forms_sync_request_status() from public, anon, authenticated;
revoke execute on function public.open_form_request(uuid) from public, anon;
grant execute on function public.open_form_request(uuid) to authenticated, service_role;
