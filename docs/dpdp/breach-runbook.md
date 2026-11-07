# Breach runbook

What to do when something goes wrong with personal data or with the
platform's security. It covers personal data breaches (DPDP Act s. 8(6);
DPDP Rules 2025 r. 7) and cyber incidents that must be reported to CERT-In
(CERT-In Directions of 28 April 2022).

This page has no names or phone numbers. The people to call are in
**Settings → DPDP & Privacy → Breach response**, and the Privacy & Grievance
Officer is in **Contact & grievance**.

## The two clocks

Both clocks start when someone **notices** the incident, not when it is
confirmed.

| Report | Deadline | When it applies | Rule |
|---|---|---|---|
| CERT-In incident report | **6 hours** | A reportable cyber incident: unauthorised access, a compromised account or server, a data leak, malware and the like | CERT-In Directions, direction (ii) |
| Intimation to the Data Protection Board | Without delay | Any personal data breach | DPDP Rules r. 7(2)(a) |
| Message to each affected person | Without delay | Any personal data breach | DPDP Rules r. 7(1) |
| Detailed report to the Board | **72 hours** (or longer if the Board allows it) | Any personal data breach | DPDP Rules r. 7(2)(b) |

The platform works out both deadlines from the time you enter. They cannot
be typed in, and the time noticed cannot be moved once a report has gone out.

## Step by step

1. **Record it now.** Go to **Privacy cases → Incidents → Record an
   incident**. Enter the time it was noticed, whether personal data was
   affected, and whether it is a reportable cyber incident. Don't wait for
   the full picture: the countdowns start from the time you enter, so a late
   entry doesn't buy time.
2. **Contain it.** Revoke the link, rotate the key, disable the account, or
   take the system offline. Write down what you did under **What is known →
   What has been done to contain it**.
3. **Call the breach contacts** listed in Settings: the Privacy & Grievance
   Officer, the platform owner and, for a cyber incident, whoever files with
   CERT-In.
4. **Report to CERT-In within 6 hours** if it is a reportable cyber
   incident. Use the **Incident report to CERT-In** draft on the incident
   page and file it through CERT-In's reporting channel. Then record the
   time under **Reports made**.
5. **Tell the Board and the people affected without delay** (personal data
   breaches). Use the **Breach report to the Data Protection Board** and
   **Breach message to affected people** drafts. Send them yourself, then
   record when each went out.
6. **Send the detailed report to the Board within 72 hours.** Bring the
   draft up to date first: the cause, who caused it, what was done, and the
   report on telling the people affected. Record when it was sent.
7. **Close the incident** once it is resolved, with a note on how. A closed
   incident stays in the register for the privacy-records retention period.

## The drafts

The drafts come from the breach templates published in **Settings → DPDP &
Privacy → Notices**. Each template must carry the placeholders its rule
requires before it can be published. The checker (DPDP-28) turns red until
all three templates are published with every Rule 7 element.

The incident page fills each placeholder from **What is known** and the
privacy contact, and lists any it has nothing for yet. **The platform never
sends a breach message itself.** You check each draft, finish it and send it,
then record the time.

## Writing it down

- Describe systems, data categories and counts. Don't name the people
  affected in the incident record. The register is evidence of what
  happened and what was done, not a list of who.
- Keep evidence (logs, screenshots) outside the platform, in the place the
  platform owner names. Don't paste production logs into the incident.
- If a claim or inquiry may follow, place a **legal hold** (Privacy cases →
  Legal holds) on the people or records concerned, so retention does not
  delete what you may need.

## Who can see incidents

Super Admin and PnC Admin (`privacyCases`). Platform Admin and Exec View see
only the counts in the compliance checker (DPDP-27).

## Checks

- **DPDP-27** (static and database): the register exists, and its deadlines
  follow `CERT_IN_REPORT_HOURS` and `BOARD_DETAILED_REPORT_HOURS`.
- **DPDP-28** (in the app): all three breach templates are published, each
  with every Rule 7 element.
- The daily DPDP job counts open incidents and any past a deadline with no
  report recorded.
