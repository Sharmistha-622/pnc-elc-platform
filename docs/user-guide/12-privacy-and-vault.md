# 12. Data privacy and the vault

## Two stores

The platform keeps data in two separate places:

| | **The platform** (also called *core*) | **The vault** |
|---|---|---|
| What's in it | Names, teams, dates, managers, statuses, workflows, settings, templates | Things that would harm a person if they leaked: **salary**, **bank details**, **government ID numbers and scans** (Aadhaar, PAN, UAN, passport), and **what colleagues wrote** in reviews |
| Who can log in | All staff (with Google) | **Only** Super Admin, PnC Admin, Fin Admin, Fin Ops and Exec View, by **separate invitation** |
| Can the tech team read it? | Yes | **No, never** |
| Where | — | India (Mumbai) |

Every read from the vault is logged. Getting a role on the platform **doesn't
give you vault access**. That's a separate invitation.

## "Sealing": how data moves into the vault

Some sensitive data has to be worked on before it goes into the vault. PnC
Ops has to check a document, and a manager has to read feedback during a
review. That data starts on the platform and is **sealed** into the vault
when the work is done:

| What | Sealed when | Target |
|---|---|---|
| An ID document a candidate uploads | **PnC verifies it** (*Verify and secure*) | within 14 days |
| Written review feedback | **The review closes** | within 30 days |

After sealing, the platform keeps only a trace: *that* it happened, who did
it, when, and for a document the **last four characters** of its number. That
is why PnC Ops can verify documents, and managers can read feedback during a
review, **without a vault login**.

**Until it's sealed, the tech team could technically read it.** So:

- **Verify documents promptly.** Don't leave submitted dossiers waiting.
- **Close reviews** once the decision is made.

## Today's status

| Item | Status |
|---|---|
| ID documents sealed on verification | Built |
| Logged reading of salary and feedback from the vault | Built |
| Older peer-feedback sealing | Built, but nothing triggers it yet |
| New review-form answers and decision notes | **Still on the platform**, not yet sealed |
| Bank details entered straight into the vault | **Not built.** Bank proof is an uploaded document for now. |
| Salaries (CTC) stored in the vault | **Not built.** CTCs and letters are still on the platform, protected by role rules. |
| Payroll export | Not built |

## Your responsibilities

- **Only look at what your work needs.** The platform limits what you can
  see, but you're responsible for what you do with it.
- **Don't download or share** salary, bank, ID or feedback data outside the
  platform unless your process requires it.
- **If you can see something you think you shouldn't, report it** to a PnC
  Admin. That's treated as a defect, and it gets fixed.
- **Don't type salary, bank or ID numbers into free-text fields** (notes,
  reasons, comments) or into import files.
- **Peer feedback is anonymous** to the employee. Never pass on who said
  what.
