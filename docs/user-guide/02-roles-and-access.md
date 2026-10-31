# 2. Roles and access

Everything you can see and do on the platform comes from your **role**. Each
person has exactly one. This chapter explains the roles in plain words. The
official version is [`docs/rbac.md`](../rbac.md).

## The basic idea

The platform holds two kinds of data:

- **General data:** name, team, email, joining date, manager, status. Most
  staff roles can see some of this.
- **Sensitive data:** salary, bank details, ID numbers (Aadhaar, PAN) and
  what people wrote about each other in reviews. Only a few roles can see
  it. Much of it lives in a separate, locked store called the **vault** (see
  [Data privacy and the vault](12-privacy-and-vault.md)).

Seeing data your role doesn't allow counts as a defect, **even for the
developers**. If you can see something you shouldn't, tell a PnC Admin.

## The roles

| Team | Role | In one line |
|---|---|---|
| Owner | **Super Admin** | Can see and do everything. Held by the platform owner. |
| PnC | **PnC Admin** | Runs People & Culture: makes offers (enters CTC), issues letters, closes reviews, sees salary. |
| PnC | **PnC Ops** | Runs the day-to-day pipeline: invites candidates, verifies documents, chases reviews, runs exits. **No salary.** |
| Finance | **Fin Admin** | Sees the directory and salary/bank data, settles full-and-final, reads letters. |
| Finance | **Fin Ops** | Sees the directory; will prepare payroll. Read-only today. |
| Leadership | **Exec View** | Read-only view of the directory, reviews and reports. |
| Platform | **Platform Admin** | Looks after settings, templates, emails and forms. **Sees no personal data.** |
| Platform | **Platform Ops** | Read-only version of Platform Admin. |
| Line | **Manager** | Sees and reviews their own team. |
| Everyone | **Employee** | Sees their own profile, forms and reviews. |
| Onboarding | **Pre-joiner** / **Candidate** | Use only the onboarding portal link. They have no dashboard. |

> **Note on managers.** The platform is meant to make someone a *Manager*
> automatically when people report to them, but that isn't switched on yet.
> Most line managers are therefore stored as **Employee**. That's fine: they
> still see **My Team** and **My Reviews** for their reports. They just can't
> open the org-wide Confirmations and Appraisals screens.

## What each role can see

`Edit` = read and change · `View` = read only · `Own` = only your own record ·
`—` = nothing.

| Role | General (name, team, email) | Identity & documents (phone, ID) | Bank | Salary | Performance (feedback, decisions) | Config (templates, settings) |
|---|---|---|---|---|---|---|
| Super Admin | Edit | Edit | Edit | Edit | Edit | Edit |
| PnC Admin | Edit | Edit | View | Edit | Edit | View |
| PnC Ops | Edit | Edit | — | — | Status only | — |
| Fin Admin | View | — | Edit | Edit | Outcomes only | — |
| Fin Ops | View | — | View | View (payroll export) | — | — |
| Exec View | View | — | — | View | View | — |
| Platform Admin | View | — | — | — | — | Edit |
| Platform Ops | View | — | — | — | — | View |
| Manager | Own team | — | — | — | Own team | — |
| Employee | Own | Own (view) | Own (view) | Own, through letters | Own outcomes | — |

## Which screens each role gets

| Screen | Super Admin | PnC Admin | PnC Ops | Fin Admin | Fin Ops | Exec View | Platform Admin | Platform Ops | Manager | Employee |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard, My Profile, My Forms, My Reviews, Changelog | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| My Team *(if you have reports)* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Employees (directory) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| Onboarding (pipeline) | ✓ | ✓ | ✓ | ✓ *(view)* | | | | | | |
| Create a candidate (offer) | ✓ | ✓ | | | | | | | | |
| Letters, Templates, Signatories | ✓ | ✓ *(edit)* | | ✓ *(view)* | | | | | | |
| Confirmations | ✓ | ✓ | ✓ | | | ✓ *(view)* | | | ✓ | |
| Appraisals | ✓ | ✓ | | ✓ | | ✓ | | | ✓ | |
| Reviews (org-wide dashboard) | ✓ | ✓ | ✓ | | | ✓ | | | | |
| Offboarding | ✓ | ✓ | ✓ | ✓ | | | | | | |
| Reports | ✓ | ✓ | | ✓ | | ✓ | | | | |
| Users & Roles | ✓ | ✓ *(PnC roles)* | | ✓ *(Finance roles)* | | | ✓ *(Platform Ops)* | | | |
| Settings, Email Center | ✓ | ✓ *(view only)* | | | | | ✓ | | | |
| Data Management, Form Builder, Audit Trail | ✓ | ✓ | | | | | ✓ | ✓ *(view)* | | |

## Who can give someone a role

Roles are changed in **Administration › Users & Roles**.

- **Super Admin** can give any role.
- **PnC Admin** can give **PnC Admin** or **PnC Ops**, and nothing else.
- **Fin Admin** can give **Fin Admin** or **Fin Ops**, and nothing else.
- **Platform Admin** can give **Platform Ops** only.
- **Exec View** and **Platform Admin** can only be given by Super Admin.
- **Nobody can change their own role.**
- **Manager, Employee, Pre-joiner and Candidate** are set by the system,
  never by hand.

**A role in the platform doesn't give access to the vault.** Vault access is
a separate invitation. See [Data privacy and the vault](12-privacy-and-vault.md).

## A candidate's role over time

A person's role follows their status automatically:

| Status | Role |
|---|---|
| Offer pending | Candidate |
| Offer accepted → Documents submitted → Documents verified | Pre-joiner |
| Active (joined) → Confirmed | Employee |
| Withdrawn (declined, offer pulled, or no-show) | none: access ends the same day; the record is kept |

If someone also holds a team role (e.g. an employee who is also PnC Admin),
the team role wins.
