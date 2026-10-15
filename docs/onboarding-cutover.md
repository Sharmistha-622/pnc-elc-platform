# Onboarding cutover runbook

Moving from the Google Apps Script to the ELC automation, without a joiner
getting two welcome emails or none.

**One named owner runs this.** Two people half-running it is the scenario where
both systems are live at once.

## Before you start

- [ ] `ONBOARDING_MODE=off` in production. Confirm in the badge at
      `/onboarding/employee`, not just in the env file.
- [ ] All onboarding migrations applied.
- [ ] Env vars set per `.env.example`: alert channel, intro channel, CC list,
      batch facilitators, sandbox targets.
- [ ] The decisions in `onboarding-decisions.md` marked "provisionally settled"
      have been confirmed by P&C, or consciously accepted as-is.

## 1. Sandbox rehearsal

Point a copy at `pnc-elc-dev` with dummy joiners.

- [ ] `ONBOARDING_MODE=sandbox`, sandbox email and Slack channel set.
- [ ] Use `ONBOARDING_TODAY_OVERRIDE` to walk a dummy joiner from DOJ−2 to
      DOJ+15, one day at a time.
- [ ] Check each step arrives at the sandbox address, and that **nothing**
      reaches a real address. Check the Slack welcome names the time the
      manager connect was actually booked for.
- [ ] Deliberately break something (unset `SLACK_BOT_TOKEN`) and confirm the
      run defers rather than fails, and the summary says so.

## 2. Import the legacy state

Run against dev first, then production.

```bash
# Export each tracker tab to CSV into ./legacy-export:
#   communication.csv, calendar.csv, tasks.csv, hr.csv
# Do NOT export the P&C Operations password column.

node -r ts-node/register scripts/import-legacy-onboarding.ts --dir ./legacy-export
# review the dry-run output, then:
node -r ts-node/register scripts/import-legacy-onboarding.ts --dir ./legacy-export --confirm
```

- [ ] Dry run reports a sensible number of matched updates and few unmatched
      emails. Investigate the unmatched before confirming — they are usually
      people with no journey yet.
- [ ] After the import, spot-check three joiners against the spreadsheet.

The import only ever moves a step out of `pending`, so it cannot overwrite
something this system already did, and it can be re-run safely.

## 3. Shadow run — five working days

Both systems running, only one of them sending.

- [ ] `ONBOARDING_MODE=dry_run` in production. Apps Script **stays live**.
- [ ] Each morning, compare the run summary's "would have sent" list against
      the Automation Logs sheet for the same day.
- [ ] Record every difference and explain it. An unexplained difference stops
      the cutover.

Five consecutive clean days. Not four.

## 4. Cutover day

Pick a day with **no joiners** — ideally a Friday after that week's joiners
have passed DOJ+1.

- [ ] Run the import once more, to catch anything the Apps Script did during
      the shadow period.
- [ ] Delete **every** Apps Script trigger, including the daily
      `scheduleExact8AMRun` scheduler that recreates the 08:00 trigger. Missing
      this one is how both systems end up running tomorrow morning.
- [ ] Confirm in the Apps Script editor that the trigger list is empty.
- [ ] Set `ONBOARDING_MODE=live`.
- [ ] Trigger a run by hand and read the summary end to end.
- [ ] Tell P&C it is live, and what they now do in the drawer rather than the
      sheet.

## 5. The first week

- [ ] Read every run summary. A quiet channel on a day with joiners means the
      cron did not fire.
- [ ] Check the health strip at `/onboarding/employee` daily.
- [ ] Ask P&C whether anything that should have arrived did not. The automation
      cannot report a mail it never knew to send.

## Rollback

Available for 30 days, because the import never writes back to the sheets — the
legacy state stays intact and current as of cutover.

1. `ONBOARDING_MODE=off`. This stops everything immediately and needs no
   deploy if the variable is managed in the hosting dashboard.
2. Re-run `setupMasterTrigger()` in the Apps Script project.
3. Confirm the 08:00 trigger exists.
4. Reconcile by hand anything sent by ELC after the last spreadsheet update —
   `onboarding_logs`, filtered to the window, is the list.

After 30 days the spreadsheet is far enough out of date that rolling back would
re-send. At that point, archive the Apps Script project rather than keeping it
as a fallback that no longer works.
