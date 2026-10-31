# 1. Getting started

## Signing in

1. Open the platform and click **Sign in with Google**.
2. Choose your **@navgurukul.org** Google account.

There is no password of its own. Personal Gmail and other accounts are turned
away with: *"Sign in with your @navgurukul.org Google account. Personal
accounts cannot use the platform."*

If you followed a link to a particular page, you land on that page after
signing in. Otherwise you land on the **Dashboard**.

**First time?** If nobody has given you a role yet, you sign in as an
**Employee**. If you need more (PnC, Finance, leadership), ask the admin of
your team to give you the right role. See
[Roles and access](02-roles-and-access.md).

**Candidates and new joiners do not sign in.** They use the personal portal
link from their invitation email. If one of them signs in with Google anyway,
they see a notice saying there is no dashboard for them and to use their
invitation link.

## The layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ☰  Dashboard › Page            [Role View Mode]   ☀/☾   (Avatar  Name ▾)  │  ← header
├──────────────────┬────────────────────────────────────────────────────────┤
│ Navgurukul ELC   │                                                        │
│                  │                                                        │
│ Dashboard        │                                                        │
│ MY WORKSPACE     │                  the page you opened                   │
│ PEOPLE           │                                                        │
│ INSIGHTS         │                                                        │
│ ADMINISTRATION   │                                                        │
│                  │                                                        │
│ v2.04.00         │                                                        │
└──────────────────┴────────────────────────────────────────────────────────┘
```

### The header (top bar)

| Item | What it does |
|---|---|
| **☰** | Collapses or expands the sidebar. |
| **Breadcrumb** | Shows where you are, e.g. *Dashboard › Employees*. |
| **Role View Mode** | Only for admins: lets you see the site as a lower role would. See [Viewing as another role](#viewing-as-another-role). |
| **☀ / ☾** | Switches between light and dark mode. |
| **Your name ▾** | Shows your name and email. **Profile** opens My Profile. **Log out** signs you out. (*Notifications* is not built yet.) |

### The sidebar

The sidebar is grouped by what you are trying to do. **You only see the items
your role can open.** An employee sees a short sidebar; a PnC Admin sees most
of it.

| Group | Items | What it's for |
|---|---|---|
| *(top)* | **Dashboard** | Your home page: things waiting on you, and key numbers. |
| **My Workspace** | My Profile · My Forms · My Reviews · My Team | Things about *you*: your profile, forms you've been asked to fill, your reviews, and the people who report to you. |
| **People** | Onboarding (Overview · Candidates · New Joiners) · Employees · Confirmations · Appraisals · Reviews · Offboarding · Letters (Issued Letters · Templates · Signatories) | The employee life cycle, in the order it happens. |
| **Insights** | Reports | Organisation-wide numbers and CSV exports. |
| **Administration** | Users & Roles · Settings · Email Center · Data Management · Form Builder · Audit Trail | How the platform itself is run. |

**My Team** only appears once at least one person reports to you.

The version number at the bottom of the sidebar shows which release you're
on. The **Changelog** page (`/changelog`) lists what changed in each release.

### If you open a page you're not allowed to see

You are taken back to the Dashboard with the message *"That page isn't part
of your role, so you've been brought back to your dashboard."* Nothing is
wrong. Your role just doesn't include that screen. If you think it should,
ask your team's admin.

## Viewing as another role

Admins can check what a colleague with a smaller role would see, using
**Role View Mode** in the header.

- **Super Admin** can view as any role.
- **PnC Admin** can view as **PnC Ops**, **Fin Admin** as **Fin Ops**, and
  **Platform Admin** as **Platform Ops**.
- Other roles don't get the switcher.

Viewing as a role only ever **narrows** what you see. It never shows you more
than your own role allows. Your choice lasts 24 hours; pick **Original Role**
to switch back.

## Addresses worth bookmarking

| Page | Address |
|---|---|
| Dashboard | `/` |
| My Forms | `/my-forms` |
| My Reviews | `/my-reviews` |
| Candidates (PnC) | `/onboarding/candidate` |
| Employees | `/employees` |
| Reviews dashboard (PnC) | `/reviews` |
| Offboarding | `/offboarding` |
| Reports | `/reports` |
