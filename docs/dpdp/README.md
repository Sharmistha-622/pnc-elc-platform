# Data protection (DPDP)

How the platform meets the Digital Personal Data Protection Act 2023 and the
DPDP Rules 2025, where each part lives, and how to check it. The legal
reasoning is in [`legal-blueprint.md`](legal-blueprint.md); what to do in an
incident is in [`breach-runbook.md`](breach-runbook.md).

The Act's main duties apply from **13 May 2027**. The IT Act's reasonable
security practices and CERT-In's 6-hour reporting apply now.

## Where things are

| Who | Where | What |
|---|---|---|
| Super Admin, PnC Admin (edit); Platform Admin, Exec View (read) | **Settings → DPDP & Privacy** (`/manage/settings/dpdp`) | Every privacy setting, the retention rules, the notices and the compliance checker |
| Super Admin, PnC Admin | **Privacy cases** (`/manage/privacy`) | Rights requests, incidents, legal holds, guardian consent |
| Every staff member | **My Privacy** (`/my-privacy`) | Their own data summary, consents, processors, requests and nomination |
| Candidates | The onboarding portal, step 0 | The candidate notice, optional consents, and a rights request form |

Roles and features: `privacy`, `privacyEdit`, `privacyCases` and `myPrivacy` in
`src/lib/role-constants.ts`; the readable copy is the "Privacy (DPDP)" section
of [`../rbac.md`](../rbac.md).

## The settings tab

Each sub-tab edits one area. A change to a retention rule, the retention mode
or a published notice asks for a reason, and every change is written to the
settings change log (old value, new value, who, why).

| Sub-tab | What you set |
|---|---|
| Contact & grievance | The Privacy & Grievance Officer's name, role, email and phone; the grievance period; the period for each request type; the Data Protection Board's complaint link |
| Notices | Candidate, employee and contractor/volunteer notices and the three breach templates. A version can be published only when its checklist passes (every Rule 3 element; every Rule 7 placeholder); published versions never change |
| Consent purposes | The optional purposes people may agree to, each separate and unticked |
| Data collection | Which optional personal fields the portal asks for, and which document types may be copied to Drive (never identity or bank documents) |
| Retention | The period for each rule, the dry-run/live switch (Super Admin only), the latest daily run and, for privacy case roles, the legal holds |
| Children | The guardian verification methods allowed |
| Links & staging | The invitation validity period and the sealing budgets |
| Breach response | Who to call in an incident |
| Processors | Each processor's purpose, region, agreement status and review date |
| Owner attestations | Confirmations only an owner can give (repository visibility, region, log drain, agreements), each with a review date |
| Compliance checker | The checks below, with a score, when each last passed and how to fix it. The report downloads as JSON or CSV, counts only |

### Locked values

These come from the law and cannot be changed in the UI or in the database.
Each is in `src/lib/dpdp/constants.ts` with its reference.

| Value | Limit | Reference |
|---|---|---|
| Grievance and request periods | at most 90 days | Rules r. 14(3) |
| Nothing deleted before it is | 1 year old | Rules r. 8(3) |
| Logs kept at least | 1 year | Rules r. 6(1)(e) |
| Detailed breach report to the Board | within 72 hours | Rules r. 7(2)(b) |
| Cyber incident report to CERT-In | within 6 hours | CERT-In Directions 2022 |
| A child is anyone under | 18 | Act s. 2(f), s. 9 |
| Statutory registers, EPF/ESI registers | at least 5 years | Wage and Social Security Codes |
| Payroll and TDS records | at least 6 years | Income-tax Rules |

### Counsel to confirm

Every retention period is seeded from the defaults in
`src/lib/dpdp/retention-defaults.ts` and marked "counsel to confirm" in the
UI. The 1-year floor applies to every hard delete: withdrawn joiners'
documents go at the later of 90 days after withdrawal and 1 year after
upload. POSH case files have no default period and are report-only until
counsel decides.

## The daily job

`/api/cron/dpdp-retention` runs every night at 02:00 IST (`vercel.json`). It
checks the cron secret first and then:

1. Plans every retention rule (`src/lib/dpdp/retention/planner.ts`). A record
   is due when its rule's period has run **and** it is at least a year old.
   A legal hold on the person or the record pauses it.
2. In **dry-run** mode (the default) it deletes nothing and reports what is
   due. In **live** mode it deletes withdrawn joiners' staged files, closed
   requests and incidents, and revoked nominations, and purges logs and spent
   consent records through `dpdp_purge_rows()`, which applies the floor and
   the holds in the database.
3. Exited people's records, their Drive folders and the vault are reported
   as instructions with counts: those are erased by hand.
4. Escalates rights requests past 80% of their period, and counts incidents
   past a reporting deadline.
5. Writes a counts-only report to `retention_runs`, shown under Retention.

Switch to live only after reviewing a few dry-run reports.

## Requirement, where, and check

The checker (`src/lib/dpdp/checks/`) runs each check in one or more modes:
**static** over the code (`npm run dpdp:check`, and CI), **db** as a named check
in `supabase/tests/dpdp_probe.sql` (CI's RLS job runs `scripts/dpdp-probe.sh`),
**runtime** over live settings and counts (the checker tab), and
**attestation** from owner confirmations.

| Requirement | Where | Check |
|---|---|---|
| Personal fields start empty; optional fields follow settings | Portal `personal-details-step.tsx`; `src/lib/onboarding/personal-details-schema.ts` | DPDP-01, 44 |
| Servers in India | `vercel.json` regions | DPDP-02 |
| Identity and bank documents never copied to Drive | `src/lib/onboarding/document-classes.ts` | DPDP-03 |
| Repository and security-review owner steps | Owner attestations | DPDP-05, 06 |
| Every personal column inventoried | `src/lib/dpdp/inventory.ts`; `supabase/tests/dpdp_inventory.sql` | DPDP-07 |
| Notices with every Rule 3 element, in English and Hindi | Settings → Notices; `src/lib/dpdp/notices.ts` | DPDP-10, 11 |
| Notice before the first field; acknowledgment with version | Portal step 0; `consent_records` | DPDP-12 |
| Consent records; one-step withdrawal; nothing pre-ticked | `src/lib/dpdp/consent/`; `ConsentChoices` | DPDP-13, 14 |
| Privacy contact everywhere; published grievance period | Footer, portal, notices, rights emails; `dpdp_settings` | DPDP-15, 16 |
| Access, correction, completion, erasure, nomination | My Privacy; portal; Privacy cases → Requests; `src/lib/dpdp/requests/` | DPDP-17 to 21 |
| Retention rules, the daily job, the floor, legal holds, withdrawn documents | `src/lib/dpdp/retention/`; `202611071040_retention.sql` | DPDP-22 to 26 |
| Incident register, deadlines, breach templates | Privacy cases → Incidents; `src/lib/dpdp/incidents/` | DPDP-27, 28 |
| Logs kept a year, append-only, written by the server only | `202611071040_retention.sql`; `202611071090_server_written_logs.sql`; `src/lib/logs/writer.ts` | DPDP-29, 40 |
| Age check and guardian consent | `src/lib/dpdp/children.ts`; Privacy cases → Guardian consent | DPDP-30 |
| Processor register | Settings → Processors | DPDP-31 |
| Sensitive data in the vault, sealed on time | `src/lib/vault/`; `docs/vault-inventory.md` | DPDP-32 to 36 |
| Audit descriptions without reasons or amounts | `src/lib/audit/events.ts` | DPDP-41 |
| Email logs without message bodies | `src/lib/email/sendEmail.ts`; `202611071095_email_log_bodies.sql` | DPDP-42 |

The checker itself is the record of where things stand: run it in the app or
with `npm run dpdp:check`.

## Migrations

Core, in filename order. Each is safe to re-run.

| File | Adds |
|---|---|
| `202611071010_dpdp_settings.sql` | Settings, retention rules, notices, purposes, processors, attestations, check results |
| `202611071020_consent_records.sql` | Consent and acknowledgment records |
| `202611071030_privacy_requests.sql` | Rights requests and nominations |
| `202611071040_retention.sql` | Legal holds, run reports, append-only logs, the purge path |
| `202611071050_privacy_incidents.sql` | The incident register |
| `202611071060_guardian_consent.sql` | Guardian consent status |
| `202611071090_server_written_logs.sql` | Log tables written by the server only |
| `202611071095_email_log_bodies.sql` | Email logs without bodies (apply with the deploy) |

## For developers

- **A new personal-data column** goes into `src/lib/dpdp/inventory.ts` in the
  same change. Run `npm run dpdp:inventory` to regenerate
  `supabase/tests/dpdp_inventory.sql`; the DPDP probe fails on any column the
  inventory does not name. A new sensitive field goes in the vault
  (`docs/vault-inventory.md`).
- **A new log write** goes through `logWriter()` (`src/lib/logs/writer.ts`).
  Sessions cannot write log tables.
- **A new audit helper** puts reasons, notes and amounts in `metadata`, never
  the description.
- **Dates** in DPDP code take `today` as an argument, so tests can fix it.
- Run `npm run dpdp:check` and `scripts/dpdp-probe.sh` (needs a scratch
  Postgres) before you push.
