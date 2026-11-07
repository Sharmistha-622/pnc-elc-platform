-- ============================================================================
-- Email logs keep no message bodies
-- ----------------------------------------------------------------------------
-- WHY
--   A log keeps what is needed to show an email was sent: the template, the
--   recipient, the status and any error. The body repeats personal data the
--   platform already holds (DPDP Act s. 8(7); data minimisation).
--
-- WHAT THIS CHANGES
--   Drops email_delivery_logs.body_preview and body_html. The app stopped
--   writing them in the same change; the outbox shows each message's template
--   with sample values instead.
--
-- Apply with the deploy that carries this change. Until then, the running
-- version still writes a body and its log line is skipped; the email itself
-- is still sent.
--
-- Safe to re-run.
-- ============================================================================

begin;

alter table public.email_delivery_logs drop column if exists body_preview;
alter table public.email_delivery_logs drop column if exists body_html;

commit;
