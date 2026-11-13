-- ============================================================================
-- Seed Email Center templates for onboarding lifecycle events (#151)
-- ----------------------------------------------------------------------------
-- Safe to re-run: rows use ON CONFLICT DO NOTHING so existing operator edits
-- are preserved.
--
-- Check query:
--   select key, is_active from public.email_templates
--   where key in (
--     'onboarding_submitted_candidate',
--     'onboarding_submitted_pnc',
--     'onboarding_document_rejected',
--     'onboarding_changes_requested',
--     'onboarding_approved',
--     'onboarding_correction_requested'
--   )
--   order by key;
-- ============================================================================

insert into public.email_templates (
  id,
  key,
  action_name,
  category,
  description,
  subject,
  body_text,
  available_variables,
  is_active,
  cadence
)
values
  (
    'tmpl-ob-submitted-cand',
    'onboarding_submitted_candidate',
    'Onboarding: Submission Received (Candidate)',
    'onboarding',
    'Sent to the candidate when they submit their completed onboarding portal.',
    'We have received your onboarding details — NavGurukul',
    '<p>Hi {{first_name}},</p><p>We have received your onboarding submission for <strong>{{job_title}}</strong>{{joining_clause}}.</p><p><strong>What happens next:</strong> the People &amp; Culture team will verify your uploaded documents and details. We will write to you as soon as everything is approved, or if any document or detail needs an update.</p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["candidate_name","first_name","job_title","joining_date","joining_clause"]'::jsonb,
    true,
    '{"trigger_event":"Candidate submits onboarding portal","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-submitted-pnc',
    'onboarding_submitted_pnc',
    'Onboarding: Submission Received (PnC Alert)',
    'onboarding',
    'Sent to the PnC mailbox when a candidate submits their onboarding portal.',
    'Onboarding submitted: {{candidate_name}} ({{job_title}})',
    '<p><strong>{{candidate_name}}</strong> ({{job_title}}) has submitted their onboarding details, documents, policy confirmations, and signed letters.</p><p><strong>What happens next:</strong> verify their uploaded documents and complete Final Review on the review page.</p><p><a href="{{review_url}}">Open the onboarding review page</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["candidate_name","job_title","joining_date","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Candidate submits onboarding portal","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-doc-rejected',
    'onboarding_document_rejected',
    'Onboarding: Document Rejected',
    'onboarding',
    'Sent to the candidate with a fresh portal link when P&C rejects an uploaded document.',
    'Action required: please re-upload your {{document_type}}',
    '<p>Hi {{first_name}},</p><p>The People &amp; Culture team reviewed your <strong>{{document_type}}</strong> and asked for a new upload:</p><p><em>{{rejection_reason}}</em></p><p><a href="{{portal_link}}">Open your onboarding portal to upload a replacement</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["candidate_name","first_name","document_type","rejection_reason","portal_link"]'::jsonb,
    true,
    '{"trigger_event":"P&C rejects an uploaded onboarding document","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-changes-req',
    'onboarding_changes_requested',
    'Onboarding: Changes Requested',
    'onboarding',
    'Sent to the candidate with a fresh portal link when P&C requests changes on their onboarding record.',
    'Action required: updates requested on your onboarding record',
    '<p>Hi {{first_name}},</p><p>The People &amp; Culture team reviewed your onboarding record for <strong>{{job_title}}</strong> and requested the following changes:</p><p><em>{{reviewer_note}}</em></p><p><a href="{{portal_link}}">Open your onboarding portal to update your record</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["candidate_name","first_name","job_title","reviewer_note","portal_link"]'::jsonb,
    true,
    '{"trigger_event":"P&C moves onboarding status to changes_requested","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-approved',
    'onboarding_approved',
    'Onboarding: Approved & Day-One Readiness',
    'onboarding',
    'Sent to the candidate when their onboarding is approved or set up, explaining what to expect on Day 1 without login credentials.',
    'Your onboarding is approved — see you on Day 1!',
    '<p>Hi {{first_name}},</p><p>Your onboarding for <strong>{{job_title}}</strong>{{joining_clause}} has been approved.</p><p><strong>What to expect on Day 1:</strong> you will meet your reporting manager ({{manager_name}}) and onboarding buddy ({{buddy_name}}) for your induction and orientation. The People &amp; Culture team will share your official Workspace sign-in instructions with you separately.</p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["candidate_name","first_name","job_title","joining_date","joining_clause","manager_name","buddy_name","location"]'::jsonb,
    true,
    '{"trigger_event":"P&C approves onboarding or provisions official account","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-correction-req',
    'onboarding_correction_requested',
    'Onboarding: Employment Terms Correction Requested (PnC Alert)',
    'onboarding',
    'Sent to the PnC mailbox when a candidate requests a correction on the employment terms step.',
    'Correction requested on employment terms: {{candidate_name}}',
    '<p><strong>{{candidate_name}}</strong> ({{job_title}}) asked for a correction on the employment terms step of their onboarding portal:</p><p><em>{{correction_notes}}</em></p><p><a href="{{review_url}}">Open the onboarding review page</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["candidate_name","job_title","correction_notes","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Candidate requests correction on employment terms step","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  )
on conflict (id) do nothing;
