# PNC ELC — Settings Configuration Audit

> **Phase 0 Deliverable** — Full repository audit before any implementation begins.
>
> Generated: 2026-09-26
>
> This document catalogs every candidate configuration value found in the codebase,
> classifies it, and provides the rationale for making it configurable or keeping it in code.

---

## Classification Legend

| Classification | Meaning |
|---|---|
| **CONFIGURABLE** | Should become a Settings value. PNC may reasonably change this. |
| **KEEP AS CODE** | Technical/implementation constant. No business reason to expose. |
| **ENVIRONMENT ONLY** | Must remain in `.env` / environment variables. Never in Settings UI. |
| **SECURITY SENSITIVE** | Secrets, keys, credentials. Must NEVER appear in Settings UI. |
| **NEEDS BUSINESS CONFIRMATION** | Value is ambiguous or contradicts approved requirements. |

---

## 1. Confirmation Timeline Rules

> ⚠️ **DISCREPANCY DETECTED** between code and approved ELC requirements.

| Area | Current Location | Current Value | Approved ELC Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|---|
| Apprentice Non-Tech confirmation | `getConfirmationTriggerDate.ts:7` | 1 month | 1 month | Business may change probation window | `confirmation_rules.apprentice_nontech.offset_value` | integer | 1 | **CONFIGURABLE** |
| Apprentice Tech confirmation | `getConfirmationTriggerDate.ts:8` | **3 months** | **2 months** | ⚠️ Code says 3, approved requirement says 2 | `confirmation_rules.apprentice_tech.offset_value` | integer | **2** (per approved req) | **CONFIGURABLE** |
| Intern confirmation | `getConfirmationTriggerDate.ts:9` | 3 months | 3 months | Business may change probation window | `confirmation_rules.intern.offset_value` | integer | 3 | **CONFIGURABLE** |
| FTE confirmation | `getConfirmationTriggerDate.ts:10` | **12 months** | **3 months** | ⚠️ Code says 12, approved requirement says 3 | `confirmation_rules.fte.offset_value` | integer | **3** (per approved req) | **CONFIGURABLE** |
| FTC confirmation | `getConfirmationTriggerDate.ts:11` | 3 months | 3 months (fulltime_associate) | Business may change probation window | `confirmation_rules.ftc.offset_value` | integer | 3 | **CONFIGURABLE** |
| Contractor confirmation | `getConfirmationTriggerDate.ts:12` | `null` (not calculated) | **Manual** (decided 2026-11-11, #145) | Handled by hand; no rule | `confirmation_rules.contractor.enabled` | boolean | false | **DECIDED** |
| Confirmation offset unit | `getConfirmationTriggerDate.ts` | Hard-coded as months | months | Allow future flexibility (days/weeks) | `confirmation_rules.*.offset_unit` | enum | months | **CONFIGURABLE** |
| Confirmation trigger basis | `getConfirmationTriggerDate.ts` | Always joining_date | Joining date | Different types may use different bases | `confirmation_rules.*.trigger_basis` | enum | joining_date | **CONFIGURABLE** |
| Confirmation enabled per type | Not implemented | All types except contractor | Per business rule | Allow enabling/disabling per type | `confirmation_rules.*.enabled` | boolean | true (except contractor) | **CONFIGURABLE** |

### Impact Notes
- The `apprentice_tech` value (3 vs 2 months) is a **material discrepancy**. The approved ELC requirement says 2 months. The seed/default must use the approved value.
- The `fte` value (12 vs 3 months) is a **major discrepancy**. The approved ELC calls it "fulltime_associate → 3 months". Code has 12 months. Default must use the approved value.

---

## 2. Appraisal Reference Date Rules

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| Intern appraisal reference basis | `getAppraisalReferenceDate.ts:6-8` | conversion_date | May need to change which date triggers appraisal | `appraisal_rules.intern.reference_basis` | enum | conversion_date | **CONFIGURABLE** |
| FTE appraisal reference basis | `getAppraisalReferenceDate.ts:10-13` | joining_date | May need to change basis | `appraisal_rules.fte.reference_basis` | enum | joining_date | **CONFIGURABLE** |
| FTC appraisal reference basis | `getAppraisalReferenceDate.ts:10-13` | joining_date | May need to change basis | `appraisal_rules.ftc.reference_basis` | enum | joining_date | **CONFIGURABLE** |
| FTE/FTC appraisal offset | `getAppraisalReferenceDate.ts:12` | 6 months | Business-specific reference calculation | `appraisal_rules.fte.offset_value` | integer | 6 | **CONFIGURABLE** |
| Appraisal offset unit | `getAppraisalReferenceDate.ts:12` | months | Allow future flexibility | `appraisal_rules.*.offset_unit` | enum | months | **CONFIGURABLE** |
| Apprentice appraisal eligibility | `getAppraisalReferenceDate.ts:16-17` | Not eligible (returns null) | **Not eligible** (decided 2026-11-11, #145) | `appraisal_rules.apprentice_tech.eligible` | boolean | false | **CONFIGURABLE** |
| Contractor appraisal eligibility | `getAppraisalReferenceDate.ts:16-17` | Not eligible (returns null) | **Not eligible** (decided 2026-11-11, #145) | `appraisal_rules.contractor.eligible` | boolean | false | **CONFIGURABLE** |

---

## 3. Appraisal Cohort / Cycle Rules

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| July cycle — cohort start month | `getAppraisalCohort.ts:6` | April (4) | Cycle boundaries are business policy | `appraisal_cycles.july.cohort_start_month` | integer (1-12) | 4 | **CONFIGURABLE** |
| July cycle — cohort end month | `getAppraisalCohort.ts:6` | September (9) | Cycle boundaries are business policy | `appraisal_cycles.july.cohort_end_month` | integer (1-12) | 9 | **CONFIGURABLE** |
| July cycle — cycle month | `getAppraisalCohort.ts:7` | July (7) | When the cycle actually happens | `appraisal_cycles.july.cycle_month` | integer (1-12) | 7 | **CONFIGURABLE** |
| December cycle — cohort start month | `getAppraisalCohort.ts:8-9` | October (10) | Cycle boundaries are business policy | `appraisal_cycles.december.cohort_start_month` | integer (1-12) | 10 | **CONFIGURABLE** |
| December cycle — cohort end month | `getAppraisalCohort.ts:8-9` | March (3) | Cycle boundaries are business policy | `appraisal_cycles.december.cohort_end_month` | integer (1-12) | 3 | **CONFIGURABLE** |
| December cycle — cycle month | `getAppraisalCohort.ts:9` | December (12) | When the cycle actually happens | `appraisal_cycles.december.cycle_month` | integer (1-12) | 12 | **CONFIGURABLE** |
| Cycle names | `getAppraisalCohort.ts` | 'july', 'december' | Display names may change | `appraisal_cycles.*.name` | text | july, december | **CONFIGURABLE** |

---

## 4. Peer Feedback Configuration

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| Peer nomination count | `confirmations/new/page.tsx:20-26` | 5 fixed slots | Business says "4-5 reviewers" | `peer_feedback_settings.default_peers` | integer | 5 | **CONFIGURABLE** |
| Minimum peers | `confirmations/new/page.tsx:128` | 4 (implied by "4-5 reviewers") | Min peers should be enforced | `peer_feedback_settings.minimum_peers` | integer | 4 | **CONFIGURABLE** |
| Maximum peers | `confirmations/new/page.tsx:128` | 5 (implied by "4-5 reviewers") | Max peers should be enforced | `peer_feedback_settings.maximum_peers` | integer | 5 | **CONFIGURABLE** |
| Red flag — response rate threshold | `getCompiledFeedback.ts:58` | 0.5 (50%) | Threshold is a business decision | `peer_feedback_settings.red_flag_response_threshold` | decimal | 0.50 | **CONFIGURABLE** |
| Red flag — keyword list | `getCompiledFeedback.ts:23` | 7 keywords | Keywords should be admin-managed | `red_flag_keywords` table | text[] | 7 default keywords | **CONFIGURABLE** |

---

## 5. Peer Reminder Behaviour

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| Reminder enabled | `sendPeerReminders.ts` | Always enabled (no toggle) | Should be toggleable | `notification_settings.peer_reminder_enabled` | boolean | true | **CONFIGURABLE** |
| Reminder email subject | `sendPeerReminders.ts:33` | 'Reminder: Peer Feedback Requested' | Email content is a business decision | `notification_settings.peer_reminder_subject` | text | 'Reminder: Peer Feedback Requested' | **CONFIGURABLE** |
| Reminder max attempts | Not implemented | Unlimited | Should limit to avoid spam | `notification_settings.peer_max_reminders` | integer | 3 | **NEEDS BUSINESS CONFIRMATION** |
| Reminder interval | Not implemented | Every cron run | Should have minimum interval | `notification_settings.peer_reminder_interval_days` | integer | 3 | **NEEDS BUSINESS CONFIRMATION** |
| Response deadline | Not implemented | No deadline | Should have configurable deadline | `notification_settings.peer_response_deadline_days` | integer | 7 | **NEEDS BUSINESS CONFIRMATION** |

---

## 6. Notification / Email Configuration

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| Sender email | `.env:6` / `sendEmail.ts:16` | env variable | Already env-based | N/A | env | env value | **ENVIRONMENT ONLY** |
| Peer request email subject | `nominatePeers.ts:40` | 'Peer Feedback Requested' | Email content is a business decision | `notification_settings.peer_request_subject` | text | 'Peer Feedback Requested' | **CONFIGURABLE** |
| App URL in emails | `nominatePeers.ts:35`, `sendPeerReminders.ts:28` | env variable | Must remain environment variable | N/A | env | env value | **ENVIRONMENT ONLY** |
| Google OAuth credentials | `.env:3-5` | OAuth client ID/secret/refresh token | Security credentials | N/A | env | env value | **SECURITY SENSITIVE** |
| Cron secret | `.env:8` | Bearer token for cron endpoints | Auth for cron endpoints | N/A | env | env value | **SECURITY SENSITIVE** |

---

## 7. Calendar Configuration

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| Default meeting duration | `generateCalendarLink.ts:5` | 30 minutes | Business may want different review durations | `general_settings.default_meeting_duration_minutes` | integer | 30 | **CONFIGURABLE** |
| Calendar provider URL | `generateCalendarLink.ts:31` | Google Calendar URL | Implementation constant | N/A | const | Google Calendar URL | **KEEP AS CODE** |

---

## 8. Employee Types

| Area | Current Location | Current Value | Why Configurable | Classification |
|---|---|---|---|---|
| Employee types lookup | `employee_types` table | 8 types | Master data — admin should manage | **CONFIGURABLE** (via existing table) |
| Confirmation form options | `confirmations/new/page.tsx:117-123` | 5 hard-coded options | Should come from DB/config | **CONFIGURABLE** (refactor to use DB) |
| Employee type DB enum | `employees table:1-8` | SQL enum (6 values) | Legacy constraint | **KEEP AS CODE** |

---

## 9. Onboarding Defaults

| Area | Current Location | Current Value | Why Configurable | Proposed Setting | Type | Default | Classification |
|---|---|---|---|---|---|---|---|
| Default probation period | `onboarding tables`, `service.ts` (×8), `templates.ts` (×4) | '3 Months' | Varies by employee type | `general_settings.default_probation_period` | text | '3 Months' | **CONFIGURABLE** |
| Default notice period | `onboarding tables`, `service.ts` (×8), `templates.ts` (×2) | '1 Month' | May vary | `general_settings.default_notice_period` | text | '1 Month' | **CONFIGURABLE** |
| Official email domain | `service.ts` (×4) | '@navgurukul.org' | Organization-specific | `general_settings.email_domain` | text | 'navgurukul.org' | **CONFIGURABLE** |
| Organization name | `templates.ts` (×10+), `letter-templates` (×5+) | 'NavGurukul Foundation for Social Welfare' | Organization branding | `general_settings.organization_name` | text | 'NavGurukul Foundation for Social Welfare' | **CONFIGURABLE** |
| Authorized signatory title | `letter-templates/utils.ts:43` | 'People & Culture Lead, NavGurukul' | May change with personnel | `general_settings.authorized_signatory_title` | text | 'People & Culture Lead, NavGurukul' | **CONFIGURABLE** |

---

## 10. Document Routing

| Area | Current Location | Current Value | Classification | Reason |
|---|---|---|---|---|
| drive_folder categories | `documents table:5` | team_member, verification_docs | **KEEP AS CODE** | Security boundary — must not become a UI setting |
| Document types | Not formalized | Free text column | **CONFIGURABLE** | Should be lookup table |
| Signed status | `documents table:7` | unsigned, signed | **KEEP AS CODE** | Workflow state |

---

## 11. Role & Permission System

| Area | Current Location | Current Value | Classification |
|---|---|---|---|
| ELC roles | `role-constants.ts` | 7 roles (Super Admin → Member) | **KEEP AS CODE** |
| Auth roles | `roles.ts` + `globals.d.ts` | 4 roles (Admin, Program, Operations, Volunteer) | **KEEP AS CODE** |
| MASTER_USER_ID bypass | `roles.ts:49,84,102` | env variable | **SECURITY SENSITIVE** |

### Role System Resolution
Two incompatible role definitions exist:
1. `role-constants.ts`: 7 roles — ELC UI model
2. `roles.ts` + `globals.d.ts`: 4 roles — actual JWT auth

`roles.ts` is the authoritative auth system. Settings RBAC should use existing `isTrueAdmin()` check. Do NOT create a third role system.

---

## 12. Workflow Statuses (All KEEP AS CODE)

| Table | Values | Reason |
|---|---|---|
| confirmations.status | pending, approved, rescheduled | Workflow states, tightly coupled to logic |
| confirmations.manager_decision | yes, no, null | Binary decision |
| peer_feedback.response_status | pending, submitted, reminded | Workflow states |
| employees.status | active, exited | Lifecycle states |
| appraisals.cycle | july, december | Must match appraisal_cycles config |

---

## Settings Categories Justified by Audit

| Settings Category | Key Configurations | Justified? |
|---|---|---|
| **General** | Org name, email domain, probation/notice defaults, meeting duration, signatory | ✅ |
| **Confirmation** | Per-type timeline rules, peer nomination limits | ✅ |
| **Appraisal** | Per-type eligibility, reference date rules, cycle definitions | ✅ |
| **Peer Feedback** | Min/max peers, red flag threshold, keyword management | ✅ |
| **Notifications** | Email subjects, reminder settings, enable/disable toggles | ✅ |
| **Documents** | Document type master data | ⚠️ Partial |
| **Calendar** | Default meeting duration | ✅ (merge into General) |

### Final Category Decision
Calendar has only one setting (meeting duration). Merge it into General Settings rather than creating a standalone page.

**Final Settings navigation:**
- General (includes calendar + org-wide defaults)
- Confirmation
- Appraisal
- Peer Feedback
- Notifications
- Documents

---

## Critical Discrepancies

| # | Area | Code Value | Approved ELC Value | Resolution |
|---|---|---|---|---|
| 1 | Apprentice Tech confirmation | 3 months | **2 months** | Seed config with **2 months** |
| 2 | FTE confirmation | 12 months | **3 months** | Seed config with **3 months** |

---

## Files Requiring Refactoring

1. `src/lib/confirmations/getConfirmationTriggerDate.ts`
2. `src/lib/appraisals/getAppraisalReferenceDate.ts`
3. `src/lib/appraisals/getAppraisalCohort.ts`
4. `src/lib/appraisals/getAppraisalCohortView.ts`
5. `src/lib/appraisals/getAppraisalReportData.ts`
6. `src/lib/confirmations/getCompiledFeedback.ts`
7. `src/lib/confirmations/sendPeerReminders.ts`
8. `src/lib/confirmations/nominatePeers.ts`
9. `src/lib/calendar/generateCalendarLink.ts`
10. `src/app/(dashboard)/confirmations/new/page.tsx`
11. `src/components/app-sidebar.tsx`
