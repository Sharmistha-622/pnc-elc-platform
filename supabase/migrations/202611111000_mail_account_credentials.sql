-- ============================================================================
-- Mail account credentials, held apart from settings
-- ----------------------------------------------------------------------------
-- WHAT THIS ENFORCES
--   `general_settings` row `google_workspace_accounts` holds the account list
--   only: id, name, address, client id, order, limits and status. Each
--   account's client secret and refresh token live in
--   `mail_account_credentials`, which no session can read or write: the
--   server reaches it with the service role (src/lib/email/accounts.ts).
--
--   Credentials found in the settings row are removed, not moved. Enter them
--   again on Manage -> Emails after this runs.
--
-- Safe to re-run: the table is created once, and a row without credential
-- keys is not touched.
--
-- Check after applying (expect has_token = false, has_secret = false):
--   select value like '%"refresh_token":"%' as has_token,
--          value like '%"client_secret":"%' as has_secret
--     from public.general_settings where key = 'google_workspace_accounts';
-- ============================================================================

begin;

create table if not exists public.mail_account_credentials (
  account_id text primary key,
  client_secret text,
  refresh_token text,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.mail_account_credentials is
  'Client secret and refresh token for each mail account in general_settings.google_workspace_accounts. Service role only.';

alter table public.mail_account_credentials enable row level security;
-- No policies: a session sees nothing. The grants go too, so a direct call is
-- refused outright rather than answered with an empty list.
revoke all on public.mail_account_credentials from anon, authenticated;

update public.general_settings
   set value = (
         select coalesce(jsonb_agg(acc - 'client_secret' - 'refresh_token' - 'refresh_token_preview'), '[]'::jsonb)::text
           from jsonb_array_elements(value::jsonb) as acc
       ),
       updated_at = now()
 where key = 'google_workspace_accounts'
   and value ~ '^\s*\['
   and (value like '%"client_secret"%' or value like '%"refresh_token"%' or value like '%"refresh_token_preview"%');

commit;
