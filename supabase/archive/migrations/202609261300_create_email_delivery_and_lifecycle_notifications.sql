-- Migration: 202609261300_create_email_delivery_and_lifecycle_notifications.sql
-- Description: Extends notification settings to cover the complete employee lifecycle (Onboarding, Confirmation, Appraisal, Offboarding)
-- and creates email_delivery_logs table for monitoring all sent emails and automated reminders.

-- 1. Extend notification_settings with full lifecycle columns
alter table if exists notification_settings
  add column if not exists onboarding_offer_email_enabled boolean not null default true,
  add column if not exists onboarding_offer_subject text not null default 'Offer of Employment — NavGurukul Foundation',
  add column if not exists onboarding_offer_reminder_enabled boolean not null default true,
  add column if not exists onboarding_offer_reminder_interval_days integer not null default 2,
  add column if not exists onboarding_offer_max_reminders integer not null default 3,
  add column if not exists onboarding_doc_reminder_enabled boolean not null default true,
  add column if not exists onboarding_doc_reminder_days_before integer not null default 5,
  add column if not exists onboarding_welcome_email_enabled boolean not null default true,
  add column if not exists onboarding_it_alert_enabled boolean not null default true,
  add column if not exists confirmation_manager_notice_days integer not null default 30,
  add column if not exists confirmation_letter_email_enabled boolean not null default true,
  add column if not exists appraisal_cycle_announcement_enabled boolean not null default true,
  add column if not exists appraisal_cycle_announcement_subject text not null default 'Annual Performance Appraisal Cycle Now Open',
  add column if not exists appraisal_deadline_reminder_days integer not null default 3,
  add column if not exists appraisal_results_email_enabled boolean not null default true,
  add column if not exists offboarding_resignation_ack_enabled boolean not null default true,
  add column if not exists offboarding_resignation_ack_subject text not null default 'Acknowledgment of Resignation — NavGurukul',
  add column if not exists offboarding_clearance_reminder_interval_days integer not null default 2,
  add column if not exists offboarding_exit_interview_days_before integer not null default 3,
  add column if not exists offboarding_experience_letter_email_enabled boolean not null default true;

-- 2. Create email_delivery_logs table
create table if not exists email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  recipient_email text not null,
  recipient_role text,
  category text not null, -- 'onboarding', 'confirmation', 'appraisal', 'offboarding', 'system'
  notification_type text not null,
  subject text not null,
  body_preview text,
  body_html text,
  status text not null default 'delivered', -- 'delivered', 'sent', 'failed', 'queued'
  error_message text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_email_delivery_logs_category on email_delivery_logs(category);
create index if not exists idx_email_delivery_logs_status on email_delivery_logs(status);
create index if not exists idx_email_delivery_logs_sent_at on email_delivery_logs(sent_at desc);

-- Enable RLS
alter table email_delivery_logs enable row level security;
create policy "allow public read email_delivery_logs" on email_delivery_logs for select to public using (true);
create policy "allow public write email_delivery_logs" on email_delivery_logs for all to public using (true) with check (true);
