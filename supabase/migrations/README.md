# Database migrations

These files are applied by hand in the Supabase SQL Editor, because there is no migration runner.
Apply them in filename order.

## Standing up a project from scratch

Run these three, in this order, on an empty project:

1. `202610151400_full_schema.sql` — pg_dump baseline. Creates 21 tables.
2. `202610152100_complete_schema_for_new_project.sql` — everything else the
   application needs. Takes the schema to 56 tables.
3. `202610160300_enforce_nitin_super_admin.sql` — pins nitin@navgurukul.org to
   Super Admin via `current_app_role()` and a trigger on the roles table.

Step 2 is not optional. The baseline dump was taken from a database holding
only 21 tables, but the application queries 50. On its own it leaves the
candidate onboarding hub, offboarding, settings, letters, emails, signatories,
resignations and the org lookups (departments, campuses, locations) all
pointing at tables that do not exist.

Step 2 also:

- adds `code`, `status` and `updated_at` to `employee_types` and seeds the
  eight NavGurukul employment types. The dump's `employee_types` is
  `(id, name, description, created_at)`, which the code cannot use — it reads
  `code` and `status`.
- adds `employees.exit_date`, read by offboarding and reports.
- creates `letter_templates`, `candidate_letters`, `email_templates` and
  `email_provider_config`, which exist in the live database but were never
  captured in any migration in this repo.

It deliberately does **not** create the onboarding automation tables
(`onboarding_journeys`, `onboarding_steps`, `onboarding_tasks`,
`onboarding_logs`). That feature was reverted; the tables are meant to be absent.

Step 2 is safe to re-run: tables use `create table if not exists`, policies are
dropped before being created, and seeds are `on conflict do nothing`.

### Verified

All three files were applied in order against a clean PostgreSQL instance.
Result: 56 tables, all 50 tables referenced by `.from(...)` in `src/` present,
the four automation tables absent, and a second run of steps 2 and 3 completing
with no errors and no duplicate seed rows.

## Moving between Supabase projects

| Environment | Project ref |
| --- | --- |
| Local (`.env`) | `txtrrlojxznqchanlecx` |
| Vercel live (pnc-elc-platform.vercel.app) | `rtixhlqwldzdfixgehdm` |

Local already points at the new project. Run both files above there, then
switch the Vercel environment variables over once the data is moved.

Note that these files create schema only — they carry no row data beyond the
lookup seeds. Moving the existing records out of `rtixhlqwldzdfixgehdm` is a
separate data export/import step.

## Archive

`supabase/archive/migrations/` holds the original per-feature migrations that
predate the baseline. They are the source most of step 2 was composed from.
Keep them: four of the modules in step 2 exist nowhere else.
