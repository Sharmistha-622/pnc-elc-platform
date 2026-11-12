-- ============================================================================
-- Seed Email Center template for Form Builder "Send this form" (#162)
-- ----------------------------------------------------------------------------
-- Safe to re-run: ON CONFLICT DO NOTHING preserves existing operator edits.
--
-- Check query:
--   select key, is_active from public.email_templates where key = 'form_assigned';
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
values (
  'tmpl-form-assigned',
  'form_assigned',
  'Form Builder: Form Assigned',
  'system',
  'Sent to a person when a published form is assigned to them from Form Builder.',
  'New form assigned to you: {{form_name}}',
  '<p>Hi {{recipient_name}},</p><p>You have been asked to fill in <strong>{{form_name}}</strong>.{{due_clause}}</p><p><a href="{{form_url}}">Open the form in My Forms</a></p><p style="color:#6b7280;font-size:12px">Sent by the NavGurukul Employee Lifecycle platform.</p>',
  '["recipient_name","form_name","due_clause","form_url"]'::jsonb,
  true,
  '{"trigger_event":"Form sent from Form Builder","cadence_summary":"Immediate dispatch","is_automated":true}'::jsonb
)
on conflict (id) do nothing;
