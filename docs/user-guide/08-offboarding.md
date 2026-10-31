# 8. Offboarding and exits

**For:** Super Admin, PnC Admin, PnC Ops, Fin Admin.
**Sidebar:** People › **Offboarding** (`/offboarding`).

Managers and employees can't open this screen. PnC records the manager's
decision and the employee's choices on their behalf.

The **Offboarding & Separation Hub** works in two stages:

```
 Stage 1: Resignation & Retention Window          Stage 2: Active Offboarding & Clearances
 ───────────────────────────────────────          ─────────────────────────────────────────────────────────
 Resignation in ─► Manager + PnC review ─► ─►     Initiated ─► Notice Period ─► Clearances ─► NDC Sign-off ─► F&F Settlement ─► Exited
                   accept / retain / hold
```

## Stage 1: Resignation & Retention Window

### Recording a resignation

Click **Initiate Resignation** and choose where it came from:

- **Platform Portal**
- **Ingest Email**: paste the sender, subject and body of the resignation
  email as evidence
- **P&C Intake**

Fill in: employee, resignation date, notice period (days), proposed last
working day (LWD), primary reason, details, and the employee's comments. Then
click **Submit for Review**.

### Reviewing it

Tiles and tabs: *All / Pending / On Hold / Retention Proposed / Disagreements
/ Accepted / Withdrawn*. Filter by source and department.

**Review Request** opens two panels, **Reporting Manager Review** and
**People & Culture (P&C) Review**. Each has notes and three buttons:

- **Accept Resignation**
- **Propose Retention**
- **Put on Hold (7d)**

What happens next:

| Manager | PnC | Result |
|---|---|---|
| Accept | Accept | Resignation accepted. **An offboarding case is created automatically** (Stage 2). |
| Retain | Retain | The employee is asked. PnC records *Employee Accepts Withdrawal (Stay)* or *Employee Declines (Proceed with Exit)*. |
| They disagree | | PnC resolves it: *Accept Resignation & Initiate Exit* or *Propose Retention to Employee*. |

The employee gets a resignation acknowledgement email.

## Stage 2: Active Offboarding & Clearances

Tabs: *All Cases / Notice Period / Clearance / F&F Pending / Completed*. Filter
by exit type (Resignation, Immediate Relieving, Termination, Mutual
Separation, Contract End), department, or search.

- **Manage Case** opens the case.
- **Send Reminders** emails the employee about clearances still pending.

### The case page

At the top: a countdown to the **last working day**, **Adjust Last Working
Day** (proposed date, actual date and a reason), and **Complete Exit & Mark
Exited**.

Progress: **1. Initiated → 2. Notice Period → 3. Clearances → 4. NDC
Sign-Off → 5. F&F Settlement**.

| Tab | What you do |
|---|---|
| **Overview & Timeline** | Terms, a clearance health check, the activity log. |
| **Exit Checklist** | Tick off and add notes: Knowledge Handover (employee), Manager Handover Acceptance (manager), IT Asset & Hardware Return Inspection (IT), Exit Interview & Feedback (employee), Expense Claims & Financial Dues Verification (finance). |
| **Asset Clearances** | Each asset: *Pending Return, Returned & Inspected, Cleared, Damaged, Under Recovery, Waived / Gifted*; record condition and any recovery amount (₹). Once every asset is cleared, IT's clearance is marked cleared. |
| **Departmental NDC** | The **No Dues Certificate**, signed off by four departments: Reporting Manager, IT & Asset Operations, **Finance & Accounts**, People & Culture. Each is *Pending, Under Review, Cleared (Approved)* or *Blocked / Exception* (with a reason). When all four are cleared, F&F moves to *Computation Pending*. |
| **F&F Settlement** | The full-and-final, edited by **Finance**. See below. |
| **Documents & Closure** | **Generate / Preview** the No Dues Certificate and the Relieving & Experience Certificate, **Print / Save as PDF**, then **Confirm & Execute Final Exit Closure**. |

### Full-and-final (F&F) settlement

**Update Settlement** records:

- status: *Awaiting Clearance → Computation Pending → Under Review →
  Processing Disbursement → Processed & Paid* (or *Blocked*);
- payable days, leave encashment days, asset and other deductions;
- the bank **UTR** and remarks.

Only roles that may edit salary can save it: **Fin Admin, PnC Admin, Super
Admin**. PnC Ops sees the status but no amounts.

With the default settings, **F&F can't be marked processed until all four
No Dues departments have cleared.**

### Closing the exit

**Confirm & Execute Final Exit Closure** works only once every asset and
every NDC department is cleared. It:

- sets the employee to **Exited**, with an exit date (they move to the
  directory's *Exited Employees* tab);
- emails the relieving letter.

## Settings

**Administration › Settings › Offboarding** sets the defaults: notice period
(30 days), F&F timeline (30 days after LWD), retention hold (7 days),
clearance reminder frequency (every 2 days), manager escalation (5 days
before LWD), and three rules: *complete No Dues before F&F*, *assets
returned before closure*, *allow immediate relieving / notice waiver*.

> ⚠️ **Before relying on this module, read
> [Known limitations › Offboarding](13-known-limitations.md#offboarding).**
> Parts of it can show sample cases, and the asset, attendance and leave
> panels use placeholder data.
