---
trigger: always_on
description: RBAC system architecture and how to register a new feature
---

# Role-Based Access Control (RBAC) Settings

This project uses a **role-based, feature-scoped** access control system. A user
holds exactly one role; each feature declares which roles may reach it.

## CRITICAL RULE: Registering new features

**Every time a new feature, page, or module is built, it MUST be added to the
RBAC matrix.** A route that isn't registered is reachable by every signed-in
user, including `Employee`.

To register one:

1. Open `src/lib/role-constants.ts`.
2. Add the feature to the `Feature` union — e.g. `"onboarding"`.
3. Add its entry to `FEATURE_ACCESS` listing every role code allowed in:
   `onboarding: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin"],`
   Role **codes**, not display names — `roleLabel()` turns a code into a label.
4. Map its route prefix in `ROUTE_FEATURE`: `["/onboarding", "onboarding"],`
   Map the API routes that serve it too, or the screen is gated and its data
   is not.
5. Gate the route group with a `layout.tsx` that awaits `requireFeature`:

   ```tsx
   import { requireFeature } from '@/lib/rbac/requireFeature'

   export default async function Layout({ children }: { children: React.ReactNode }) {
     await requireFeature('onboarding')
     return <>{children}</>
   }
   ```

6. Add it to the sidebar in `src/lib/navigation/sidebar-nav.ts` if it has a
   screen. `visibleSections()` prunes against the same `canAccessRoute`, so a
   registered feature needs no extra wiring in the component.
7. Start every exported server action and route handler with a guard from
   `src/lib/rbac/guard.ts` (`guard(feature)`, `guardResource(resource, level)`).
   A route gate does not cover them: the browser calls them directly.
8. If a role should see a number on its dashboard, add a widget to
   `src/lib/dashboard/widgets.ts`.

`src/lib/rbac/layout-gates.test.ts` fails if a page has no gate, or if its
gate and middleware disagree. `src/lib/security/guardrails.test.ts` fails if
a server action has no guard.

Adding the feature to `Feature` without adding it to `FEATURE_ACCESS` is a type
error, which is deliberate — the matrix cannot silently fall out of date.

### Why an unregistered route is the dangerous case

`canAccessRoute` returns `true` when no prefix matches a *screen*. That is a
deliberate fail-open for genuinely public-to-staff screens. An unmatched
`/api/` path is refused. That fail-open is also how
`/offboarding`, `/reports`, `/audit`, `/my-team`, `/my-forms` and `/profile`
were reachable by every signed-in user, candidates included, until they were
registered. `src/lib/navigation/sidebar-nav.test.ts` now fails if a nav item
points at a route no feature claims.

## Navigation

The sidebar is data, not markup: `src/lib/navigation/sidebar-nav.ts` holds
`NAV_SECTIONS`, and `src/components/app-sidebar.tsx` draws what
`visibleSections(role)` returns.

- **Two levels, never three.** `NavLeaf` has no `items`, so a sub-item cannot
  carry children — a third level is a type error. Anything that wants more
  depth belongs in in-page tabs, the way `/manage/settings` already does it.
- **Pruning is bottom-up**: children, then items, then whole sections, so a
  group whose every screen is out of reach takes its label and separator with
  it rather than heading an empty space.
- **Hiding a link is not access control.** `requireFeature` in each route
  group's `layout.tsx` and the check in `middleware.ts` are what enforce it.

## Portal-only roles

`candidate` and `pre_joiner` appear in no `FEATURE_ACCESS` list at all. They
reach the platform through the token portal at `/onboarding/[token]` and have
no dashboard. Because they can still hold a session, the ordinary denial path
(`redirect('/')`) would loop, so `middleware.ts` sends them to
`/portal-notice` instead. `isPortalOnlyRole()` is the single test for this.

## Route access is not write access

`platformConfig` opens `/manage/settings` and `/manage/emails` to PnC Admin,
whose own process the rules in them describe. The matrix gives that role
`config: view`, and `src/lib/settings/access.ts` is where that holds: every
write in `settings/service.ts`, and `updateOffboardingSettings` behind the
Offboarding tab, returns `platformConfigRefusal()` first when it is non-null.
Those files carry `'use server'`, so each exported write is a server action the
browser can call directly — a read-only form is presentation, not a control.
A settings write added anywhere else needs the same two lines.

The refusal is returned as `{ success: false, error }`, not thrown: the forms
call these inside `startTransition`, where a throw reaches the error boundary
and replaces the page.

Emulation narrows, never widens: the guard requires both the effective and the
original role to be able to write.

## How the engine works

- A user's role lives in their Supabase auth `app_metadata.role`, read on the
  server by `getCurrentUserRole()` (`src/lib/rbac/getCurrentUserRole.ts`).
- `requireFeature(feature)` (`src/lib/rbac/requireFeature.ts`) is the single
  enforcement point: it redirects to `/login` when there is no session, and to
  `/` when the role is not in that feature's list.
- `canAccessRoute(role, url)` in `src/lib/role-constants.ts` answers the same
  question for navigation, so the sidebar hides what the user cannot open.
- **Fail-safe default:** an authenticated user with no role of their own is
  treated as `DEFAULT_ROLE` (`employee`). An anonymous caller resolves to
  `null`, which every check denies outright.
- `ROLE_HIERARCHY` ranks roles numerically. It governs impersonation
  (`canImpersonate`) only — it is **not** a privilege ladder: a higher rank does
  not implicitly grant a lower-ranked role's features. Feature access is decided
  solely by membership in `FEATURE_ACCESS`.

## Assigning roles

- Roles are assigned at `/manage/roles` and `/manage/users`, which are
  themselves gated behind the `manageUsers` feature.
- `setUserRole()` (`src/lib/rbac/setUserRole.ts`) enforces the rules that the UI
  must not be trusted to enforce: only `platform_admin`/`super_admin` may assign at all,
  only a `Super Admin` may grant or modify an admin role, a user may never
  change their own role, and the role must appear in `ASSIGNABLE_ROLES`.
- Writing a role uses the service-role client, so it is server-only — never
  call it from a Client Component (see `security.md`).
- **Break-glass** (`src/lib/rbac/breakGlass.ts`) is the one exception, and it is
  by account, not by role. The named accounts reach `/manage/users` whatever
  role they hold (middleware lets them through for that route only; the layout
  uses `requireFeatureOrBreakGlass`), and `updateUserAllocations` falls back to
  `canBreakGlassChange` when the ordinary rules refuse them. Never Super Admin,
  in either direction. Its switch lives in `break_glass_settings`, a table
  closed to sessions, and only `guard(['super_admin'])` writes it. It does not
  reach `setUserRole`, `createUserWithRole` or any other screen.

## Enforcement boundary

RBAC decides which *routes and features* a user reaches. It is not row-level
security: Supabase RLS policies remain the authorization layer for data (see
`data-access.md`). A page passing `requireFeature` does not entitle its queries
to bypass RLS.
