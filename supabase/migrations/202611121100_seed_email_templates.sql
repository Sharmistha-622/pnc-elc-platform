-- ============================================================================
-- Seed Email Center templates for every email the platform sends (#161)
-- ----------------------------------------------------------------------------
-- Safe to re-run: index uses IF NOT EXISTS and rows use ON CONFLICT DO NOTHING
-- so existing operator edits are preserved.
--
-- Check query:
--   select key, is_active from public.email_templates order by key;
-- ============================================================================

create index if not exists idx_email_templates_key
  on public.email_templates (key);

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
    'tmpl-ob-invite',
    'onboarding_invitation',
    'Candidate Onboarding Portal Invitation',
    'onboarding',
    'Sent when a candidate is invited or re-invited to complete their onboarding portal.',
    'Welcome to NavGurukul — complete your onboarding',
    $body$<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.6">
    <h2 style="color:#111827;font-size:20px;margin:0 0 16px">Welcome aboard, {{first_name}}</h2>

    <p>We are delighted to have you joining NavGurukul as
    <strong>{{job_title}}</strong>{{joining_clause}}.</p>

    <p>Before you start, please complete your onboarding. It takes about 20 minutes
    and covers your personal details, documents, our policies and your letters.</p>

    <p style="margin:28px 0">
      <a href="{{portal_link}}"
         style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
        Open your onboarding portal
      </a>
    </p>

    <p style="font-size:13px;color:#6b7280">
      If the button does not work, paste this link into your browser:<br />
      <a href="{{portal_link}}" style="color:#4f46e5;word-break:break-all">{{portal_link}}</a>
    </p>

    <p style="font-size:13px;color:#6b7280">
      This link is personal to you. Please do not forward it — it gives access to
      your onboarding record.
    </p>

    <p style="font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:28px">
      Questions? Just reply to this email and the People &amp; Culture team will help.
    </p>
  </div>$body$,
    '["candidate_name","first_name","job_title","joining_date","joining_clause","portal_link"]'::jsonb,
    true,
    '{"trigger_event":"Candidate created or invitation resent by P&C","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-conf-self-invite',
    'review_confirmation_self_invite',
    'Confirmation Review: Employee Self-Reflection Invite',
    'confirmation',
    'Sent to the employee when their probation confirmation review cycle opens.',
    'Your confirmation review is due — self-reflection and peer nominations',
    '<p>Hi {{recipient_name}},</p><p>Your confirmation review is due now. Please fill in your self-reflection form, and nominate {{peer_range}} colleagues who know your work to give peer feedback.{{due_clause}}</p><p>Your peers are asked for their feedback as soon as you submit. Your manager is filling in their own review at the same time.</p><p><a href="{{review_url}}">Open my review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","peer_range","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Confirmation review cycle opened","cadence_summary":"Once each morning when due","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-appr-self-invite',
    'review_appraisal_self_invite',
    'Appraisal Review: Employee Self-Reflection Invite',
    'appraisal',
    'Sent to the employee when their appraisal review cycle opens.',
    'Your appraisal review is due — self-reflection and peer nominations',
    '<p>Hi {{recipient_name}},</p><p>Your appraisal review is due now. Please fill in your self-reflection form, and nominate {{peer_range}} colleagues who know your work to give peer feedback.{{due_clause}}</p><p>Your peers are asked for their feedback as soon as you submit. Your manager is filling in their own review at the same time.</p><p><a href="{{review_url}}">Open my review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","peer_range","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Appraisal review cycle opened","cadence_summary":"Immediate dispatch on launch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-conf-peer-invite',
    'review_confirmation_peer_invite',
    'Confirmation Review: Peer Feedback Invite',
    'confirmation',
    'Sent to each nominated peer during a confirmation review cycle.',
    '{{employee_name}} has nominated you for peer feedback',
    '<p>Hi {{recipient_name}},</p><p>{{employee_name}} has nominated you to give peer feedback for their confirmation review.{{due_clause}}</p><p>Your answers go to their manager and PnC without your name. {{employee_name}} does not see them.</p><p><a href="{{review_url}}">Give feedback</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Peer nominated in confirmation review","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-appr-peer-invite',
    'review_appraisal_peer_invite',
    'Appraisal Review: Peer Feedback Invite',
    'appraisal',
    'Sent to each nominated peer during an appraisal review cycle.',
    '{{employee_name}} has nominated you for peer feedback',
    '<p>Hi {{recipient_name}},</p><p>{{employee_name}} has nominated you to give peer feedback for their appraisal review.{{due_clause}}</p><p>Your answers go to their manager and PnC without your name. {{employee_name}} does not see them.</p><p><a href="{{review_url}}">Give feedback</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Peer nominated in appraisal review","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-conf-mgr-invite',
    'review_confirmation_manager_invite',
    'Confirmation Review: Manager Assessment Invite',
    'confirmation',
    'Sent to the reporting manager when a confirmation review cycle opens.',
    '{{employee_name}}''s confirmation review: your manager review',
    '<p>Hi {{recipient_name}},</p><p>{{employee_name}}''s confirmation review has started. Please fill in your manager review.{{due_clause}}</p><p>You will see their self-reflection and their peers'' feedback in My Reviews as it comes in, and PnC will set up a meeting with the two of you once enough is in.</p><p><a href="{{review_url}}">Fill in the manager review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Confirmation review cycle opened","cadence_summary":"Once each morning when due","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-appr-mgr-invite',
    'review_appraisal_manager_invite',
    'Appraisal Review: Manager Assessment Invite',
    'appraisal',
    'Sent to the reporting manager when an appraisal review cycle opens.',
    '{{employee_name}}''s appraisal review: your manager review',
    '<p>Hi {{recipient_name}},</p><p>{{employee_name}}''s appraisal review has started. Please fill in your manager review.{{due_clause}}</p><p>You will see their self-reflection and their peers'' feedback in My Reviews as it comes in, and PnC will set up a meeting with the two of you once enough is in.</p><p><a href="{{review_url}}">Fill in the manager review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Appraisal review cycle opened","cadence_summary":"Immediate dispatch on launch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-conf-self-rem',
    'review_confirmation_self_reminder',
    'Confirmation Review: Self-Reflection Reminder',
    'confirmation',
    'Reminder sent to the employee when their confirmation self-reflection is pending.',
    'Reminder: your confirmation self-reflection',
    '<p>Hi {{recipient_name}},</p><p>A reminder that your self-reflection for your confirmation review is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Confirmation self-reflection overdue","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-appr-self-rem',
    'review_appraisal_self_reminder',
    'Appraisal Review: Self-Reflection Reminder',
    'appraisal',
    'Reminder sent to the employee when their appraisal self-reflection is pending.',
    'Reminder: your appraisal self-reflection',
    '<p>Hi {{recipient_name}},</p><p>A reminder that your self-reflection for your appraisal review is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Appraisal self-reflection overdue","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-conf-peer-rem',
    'review_confirmation_peer_reminder',
    'Confirmation Review: Peer Feedback Reminder',
    'confirmation',
    'Reminder sent to a nominated peer when their confirmation feedback is pending.',
    'Reminder: peer feedback for {{employee_name}}',
    '<p>Hi {{recipient_name}},</p><p>A reminder that your peer feedback for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Confirmation peer feedback pending","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-appr-peer-rem',
    'review_appraisal_peer_reminder',
    'Appraisal Review: Peer Feedback Reminder',
    'appraisal',
    'Reminder sent to a nominated peer when their appraisal feedback is pending.',
    'Reminder: peer feedback for {{employee_name}}',
    '<p>Hi {{recipient_name}},</p><p>A reminder that your peer feedback for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Appraisal peer feedback pending","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-conf-mgr-rem',
    'review_confirmation_manager_reminder',
    'Confirmation Review: Manager Review Reminder',
    'confirmation',
    'Reminder sent to the manager when their confirmation review is pending.',
    'Reminder: manager review for {{employee_name}}',
    '<p>Hi {{recipient_name}},</p><p>A reminder that your manager review for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Confirmation manager review pending","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-appr-mgr-rem',
    'review_appraisal_manager_reminder',
    'Appraisal Review: Manager Review Reminder',
    'appraisal',
    'Reminder sent to the manager when their appraisal review is pending.',
    'Reminder: manager review for {{employee_name}}',
    '<p>Hi {{recipient_name}},</p><p>A reminder that your manager review for {{employee_name}} is still waiting on you.{{due_clause}}</p><p><a href="{{review_url}}">Open it now</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["recipient_name","employee_name","due_date","due_clause","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Appraisal manager review pending","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-escalation',
    'review_escalation',
    'Review Cycle: Needs PnC Escalation',
    'confirmation',
    'Sent to PnC when a participant has not responded after the maximum automatic reminders.',
    'Needs PnC: {{employee_name}}''s {{review_kind}} review is stuck',
    '<p>{{stuck_summary}}, after {{reminder_count}} {{reminder_word}}.</p><p>No more automatic reminders will go to them. You can follow up, send a reminder yourself, or adjust the reviewers from the cycle page.</p><p><a href="{{review_url}}">Open the review cycle</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["employee_name","respondent_name","review_kind","stuck_summary","reminder_count","reminder_word","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Automatic reminders exhausted","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-ready-meeting',
    'review_ready_for_meeting',
    'Review Cycle: Ready for Meeting Notice',
    'confirmation',
    'Sent to PnC once self-reflection, manager review, and minimum peer reviews are submitted.',
    'Ready for meeting: {{employee_name}}''s {{review_kind}} review',
    '<p>{{employee_name}}''s self-reflection and {{manager_possessive}} manager review are in, with {{peers_done}} of {{peers_asked}} peer reviews.</p><p>{{meeting_note}}</p><p><a href="{{review_url}}">Open the review cycle</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["employee_name","manager_name","manager_possessive","review_kind","peers_done","peers_asked","meeting_note","review_url"]'::jsonb,
    true,
    '{"trigger_event":"All required review submissions received","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-meeting-invite',
    'review_meeting_invite',
    'Review Cycle: Calendar Meeting Invite',
    'confirmation',
    'Sent with the iCalendar invite when a confirmation or appraisal review meeting is booked or rescheduled.',
    '{{review_kind_title}} review meeting: {{employee_name}}',
    '<p>A {{review_kind}} review meeting for {{employee_name}} with {{manager_label}} and PnC is set for <strong>{{meeting_when}}</strong>.</p><p>The calendar invitation is attached. After the meeting the manager records the decision on the platform.</p><p><a href="{{review_url}}">Open the review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["employee_name","manager_name","manager_label","review_kind","review_kind_title","meeting_when","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Review meeting booked or rescheduled","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-decision-recorded',
    'review_decision_recorded',
    'Review Cycle: Decision Recorded for PnC',
    'confirmation',
    'Sent to PnC when the reporting manager records a review decision.',
    'Decision recorded: {{employee_name}}''s {{review_kind}} review',
    '<p>{{manager_name}} has recorded a decision on {{employee_name}}''s {{review_kind}} review: <strong>{{decision}}</strong>.</p><p>It is waiting for PnC to review and close.</p><p><a href="{{review_url}}">Review the decision</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["employee_name","manager_name","review_kind","decision","review_url"]'::jsonb,
    true,
    '{"trigger_event":"Manager records review decision","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-rev-decision-returned',
    'review_decision_returned',
    'Review Cycle: Decision Returned by PnC',
    'confirmation',
    'Sent to the reporting manager when PnC returns a review decision for revision.',
    'PnC returned the decision on {{employee_name}}''s {{review_kind}} review',
    '<p>Hi {{manager_name}},</p><p>PnC has sent your decision on {{employee_name}}''s {{review_kind}} review back to you with a note. Please read it and record the decision again.</p><p><a href="{{review_url}}">Open the review</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
    '["employee_name","manager_name","review_kind","review_url"]'::jsonb,
    true,
    '{"trigger_event":"PnC returns review decision","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-cf-legacy-peer-req',
    'peer_feedback_request',
    'Confirmation: Peer Feedback Request',
    'confirmation',
    'Sent when peers are nominated on a confirmation review.',
    'Peer Feedback Requested',
    '<p>Hi {{peer_name}},</p><p>You''ve been nominated to provide feedback as part of a confirmation review. Please share your feedback using the link below:</p><p><a href="{{feedback_link}}">{{feedback_link}}</a></p><p>Thank you!</p>',
    '["peer_name","feedback_link"]'::jsonb,
    true,
    '{"trigger_event":"Peers nominated on confirmation","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-cf-legacy-self-req',
    'employee_self_feedback_request',
    'Confirmation: Employee Self-Feedback Request',
    'confirmation',
    'Sent to the employee when a confirmation review is initiated.',
    'Your Confirmation Review: Please Fill Your Self-Feedback',
    '<p>Hi {{employee_name}},</p><p>Your confirmation review has started, and your peers have been asked for feedback. Please fill in your own self-feedback form using the link below:</p><p><a href="{{form_link}}">{{form_link}}</a></p><p>Thank you!</p>',
    '["employee_name","form_link"]'::jsonb,
    true,
    '{"trigger_event":"Confirmation review initiated","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-cf-legacy-peer-rem',
    'peer_feedback_reminder',
    'Confirmation: Peer Feedback Reminder',
    'confirmation',
    'Sent by the morning reminder job to peers with pending feedback.',
    'Reminder: Peer Feedback Requested',
    '<p>Hi {{peer_name}},</p><p>This is a friendly reminder to share your feedback:</p><p><a href="{{feedback_link}}">{{feedback_link}}</a></p><p>Thank you!</p>',
    '["peer_name","feedback_link"]'::jsonb,
    true,
    '{"trigger_event":"Pending peer feedback","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-off-1',
    'offboarding_resignation_ack',
    'Resignation Acknowledgment & Notice Period Schedule',
    'offboarding',
    'Sent to departing employee acknowledging receipt of resignation and establishing Last Working Day.',
    'Acknowledgment of Resignation — NavGurukul Foundation',
    $body$Dear {{employee_name}},

We acknowledge receipt of your formal resignation submitted on {{resignation_date}}.

As per organization policy, your notice period is {{notice_period_duration}}, and your Last Working Day (LWD) has been recorded as {{last_working_day}}.

Please access your offboarding portal to track your clearance checkpoints, knowledge handover schedule, and asset return process:
• Offboarding Checklist: {{offboarding_portal_link}}

Should you have any questions regarding transition or documentation, please contact {{hr_poc_name}}.

Sincerely,
People & Culture Operations
NavGurukul Foundation$body$,
    '["employee_name","resignation_date","notice_period_duration","last_working_day","offboarding_portal_link","hr_poc_name"]'::jsonb,
    true,
    '{"trigger_event":"Resignation accepted by HR & recorded with LWD","cadence_summary":"Immediate formal confirmation of LWD","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-off-2',
    'offboarding_clearance_reminder',
    'Departmental Clearance & Handover Reminder',
    'offboarding',
    'Sent to employee and department heads (IT, Finance, Operations) 5 days before LWD.',
    'Action Required: Clearance Checkpoints for {{employee_name}} (LWD: {{last_working_day}})',
    $body$Dear {{employee_name}},

With your Last Working Day on {{last_working_day}}, please ensure all departmental clearance items are settled:

• Knowledge Handover & Document Transfer
• IT Asset & Laptop Return
• Financial Dues & Expense Reimbursement Submissions

View and Track Clearance Status: {{clearance_link}}
Pending Department Sign-offs: {{pending_departments}}

Completing these clearances ensures timely processing of your Full & Final (F&F) settlement and relieving documents.

Best regards,
People & Culture & Finance Teams
NavGurukul Foundation$body$,
    '["employee_name","last_working_day","pending_departments","clearance_link"]'::jsonb,
    true,
    '{"trigger_event":"Departmental clearances pending prior to LWD","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  ),
  (
    'tmpl-ob-off-4',
    'offboarding_relieving_experience_letter',
    'Relieving & Experience Letter Issued',
    'offboarding',
    'Sent on/after LWD with formal relieving documents, F&F settlement summary, and PF transfer guide.',
    'Relieving Documents & Service Certificate — NavGurukul Foundation',
    $body$Dear {{employee_name}},

We hereby confirm that your employment with NavGurukul Foundation for Social Welfare as {{job_title}} concluded on {{last_working_day}}.

We take this opportunity to thank you for your valuable contributions, dedication, and efforts during your tenure with us.

Your official Relieving Letter, Service Certificate, and Full & Final Settlement summary are now ready for download:
• Download Relieving Documents: {{document_download_link}}

For any subsequent queries regarding Form 16, PF transfer, or taxation statements, please contact {{finance_poc_email}}.

We wish you the very best in all your future personal and professional endeavors!

Warm regards,
People & Culture & Operations
NavGurukul Foundation for Social Welfare$body$,
    '["employee_name","job_title","last_working_day","document_download_link","finance_poc_email"]'::jsonb,
    true,
    '{"trigger_event":"All clearances completed & F&F settlement approved","cadence_summary":"On or after Last Working Day","is_automated":true}'::jsonb
  ),
  (
    'tmpl-dpdp-ack',
    'privacy_request_acknowledgment',
    'Privacy Request: Receipt Acknowledgment',
    'system',
    'Sent to the principal acknowledging receipt of a DPDP rights request.',
    'We have your request {{reference}}',
    '<p>We received your request ({{request_type}}) on {{received_date}}, reference <strong>{{reference}}</strong>.</p><p>We will answer by {{due_date}}. Quote the reference if you write to us about it.</p>{{contact_block}}',
    '["reference","request_type","received_date","due_date","contact_block"]'::jsonb,
    true,
    '{"trigger_event":"DPDP privacy request submitted","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-dpdp-answer',
    'privacy_request_answer',
    'Privacy Request: Official Answer',
    'system',
    'Sent to the principal when their DPDP rights request is answered.',
    'Answer to your request {{reference}}',
    '<p>{{answer_text}}</p>{{retention_note}}{{contact_block}}',
    '["reference","answer_text","retention_note","contact_block"]'::jsonb,
    true,
    '{"trigger_event":"DPDP privacy request answered","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
  ),
  (
    'tmpl-dpdp-escalation',
    'privacy_request_escalation',
    'Privacy Request: Due Date Escalation',
    'system',
    'Sent to the privacy escalation contact when an open request passes 80% of its statutory window.',
    'Privacy request {{reference}} is close to its due date',
    '<p>Request {{reference}} ({{request_type}}) is due on {{due_date}} and is still open.</p><p><a href="{{request_url}}">Open it in the request queue</a>.</p>',
    '["reference","request_type","due_date","request_url"]'::jsonb,
    true,
    '{"trigger_event":"Privacy request past 80% of statutory window","cadence_summary":"Once each morning","is_automated":true}'::jsonb
  )
on conflict (id) do nothing;
