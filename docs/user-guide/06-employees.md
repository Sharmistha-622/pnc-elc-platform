# 6. Employee directory and profiles

> **In this chapter.** The employee directory: how to find people, what each
> role sees on a profile, where documents live, and how team, manager and
> status changes reach a record. The directory is the platform's single record
> of who works here. Payroll, reviews and reports all read from it, so
> keeping it accurate matters.

**For:** Super Admin, PnC Admin, PnC Ops, Fin Admin, Fin Ops, Exec View.
**Sidebar:** People › **Employees** (`/employees`).

Managers and employees don't get the directory. Managers see their own
people under **My Team**.

## The directory

Two tabs:

- **Active Employees**: name and email, employment type, team, tenure ("Since
  *date*"), status, and links to **View** (profile) and **Documents**.
- **Exited Employees**: the same, plus joining date and exit date. Anyone
  whose exit is closed in Offboarding moves here.

**Finding people:** search by name, team or employment type, then filter by
**Type**, **Team** and **Status** (*Active / Confirmed*). Click a column header
to sort. **Clear** resets the filters.

**Exporting:** the directory itself has no export button. For a CSV, use
**Reports › Headcount & Demographics › Export CSV** (Super Admin, PnC Admin,
Fin Admin, Exec View).

## An employee's profile (`/employees/<id>/profile`)

What you see depends on your role:

| Role | You see |
|---|---|
| **PnC Admin, PnC Ops, Super Admin** | The full form: first/last name, phone, official and personal email, permanent and mailing address, emergency contact, address-proof and photo-ID type and number. **Save Profile Changes** saves edits. |
| **Fin Admin, Fin Ops, Exec View** | A notice: *"Personal details — ID numbers, addresses and contact numbers — are visible only to the employee and to People & Culture."* |

Everyone who can open the profile also sees the **Employee Audit Trail**, a
history of everything done to that person across onboarding, confirmation,
appraisal and offboarding.

## An employee's documents (`/employees/<id>/documents`)

**PnC Admin, PnC Ops and Super Admin only.** Finance and Exec View can see
the *Documents* link, but opening it shows *"You do not have access to
employee documents."*

See [Onboarding › Employee documents](05-onboarding-and-letters.md#employee-documents-employeesiddocuments).

## Changing someone's team, manager or status

- **Team, manager, type, joining or confirmation date for many people at
  once:** use **Data Management › Import Employee Data** (see
  [Administration](10-administration.md#import-employee-data)).
- **A person's system role or department:** **Users & Roles**.
- **Confirmation date:** set automatically when PnC accepts a *Confirm*
  decision (see [Reviews](07-reviews.md)).
- **Exited:** set automatically when an offboarding case is closed (see
  [Offboarding](08-offboarding.md)).

## Keeping the directory accurate

The directory feeds everything else:

| If this is wrong… | …this goes wrong |
|---|---|
| Reporting manager | Reviews go to the wrong person, or **never open** (no manager = no review) |
| Joining or conversion date | Confirmation and appraisal reviews open at the wrong time |
| Employee type | The wrong probation length, letter template and salary split |
| Team | Reports and the team filters are off |
| Email | The person sees *"Employee Record Not Linked"* and can't use My Forms or My Reviews |

**Good practice for PnC:** after each batch of joiners, use the **Reviews**
dashboard's *Due, not started* card to spot anyone with *No manager on
record*, and fix them with a small import file (just `email` and
`manager_email`).
