// ============================================================================
// The sidebar navigation tree.
// ----------------------------------------------------------------------------
// The shape of the nav lives here rather than inside `app-sidebar.tsx` so that
// it can be read, tested and reasoned about without rendering anything. The
// component's job is to draw what this module returns.
//
// Two rules are enforced here rather than by convention:
//
//   Two levels, never three. `NavLeaf` has no `items`, so a sub-item cannot
//   itself carry children — a third level is a type error, not a review note.
//
//   Nothing renders that the role cannot open. `visibleSections` prunes
//   children, then items, then whole sections, so an empty group takes its
//   label and its separator with it.
// ============================================================================

import {
  BarChart3,
  BadgeCheck,
  ClipboardList,
  Compass,
  DatabaseBackup,
  FileCheck2,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  Mail,
  PenTool,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  User,
  UserMinus,
  UserPlus,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { canAccessRoute, type UserRole } from "@/lib/role-constants";

/**
 * How a path decides whether an item is the current one.
 *
 * `prefix` (the default) matches the item's url and everything under it;
 * `exact` matches only the url itself. The two escape hatches exist because
 * three routes genuinely do not nest the way their nav entry does — see the
 * entries that use them below.
 */
export type NavMatch = {
  /** Default `prefix`. */
  match?: "exact" | "prefix";
  /** Extra prefixes that also light this item up. */
  alsoActiveFor?: string[];
  /** Prefixes under `url` that belong to a *different* item. */
  notActiveFor?: string[];
};

/** A sub-item. Deliberately has no `items`: the tree stops here. */
export type NavLeaf = NavMatch & {
  title: string;
  url: string;
  icon: LucideIcon;
};

/** A top-level item, with at most one level of children beneath it. */
export type NavItem = NavLeaf & {
  items?: NavLeaf[];
};

/**
 * A labelled run of items.
 *
 * A section with no `label` renders as a bare group with no heading — used
 * only for Dashboard, which sits alone above the first separator.
 */
export type NavSection = {
  id: string;
  label?: string;
  items: NavItem[];
};

/**
 * The sitemap.
 *
 * Four groups, each answering one question a person arrives with:
 *
 *   My Workspace    what is mine — my profile, what I've been asked to fill
 *                   in, the people who report to me
 *   People          the employee lifecycle, in the order it runs: hire,
 *                   directory, confirm, appraise, exit — then the letters
 *                   each step produces
 *   Insights        org-wide numbers
 *   Administration  how the platform itself is run
 *
 * Only places belong here, never actions: "New Confirmation" is a button on
 * the Confirmations screen, not a destination of its own. Anything a role
 * cannot open is pruned before it renders (`visibleSections`), so an Employee
 * sees Dashboard, My Profile and My Forms and nothing else.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard, match: "exact" }],
  },

  {
    id: "workspace",
    label: "My Workspace",
    items: [
      { title: "My Profile", url: "/profile", icon: User },
      { title: "My Forms", url: "/my-forms", icon: Inbox },
      // Hidden by `visibleSections` for anyone with no direct reports, however
      // senior: an empty team page is a dead end, not a feature.
      { title: "My Team", url: "/my-team", icon: Users2 },
    ],
  },

  {
    id: "people",
    label: "People",
    items: [
      {
        title: "Onboarding",
        url: "/onboarding",
        icon: UserPlus,
        // The P&C-facing candidate screens sit under /manage for historical
        // reasons but belong to this item.
        alsoActiveFor: ["/manage/onboarding"],
        items: [
          { title: "Overview", url: "/onboarding", icon: Compass, match: "exact" },
          {
            title: "Candidates",
            url: "/onboarding/candidate",
            icon: UserPlus,
            alsoActiveFor: ["/manage/onboarding", "/onboarding/review"],
          },
          { title: "New Joiners", url: "/onboarding/employee", icon: BadgeCheck },
        ],
      },
      { title: "Employees", url: "/employees", icon: Users },
      { title: "Confirmations", url: "/confirmations", icon: ClipboardList },
      { title: "Appraisals", url: "/appraisals", icon: TrendingUp },
      { title: "Offboarding", url: "/offboarding", icon: UserMinus },
      {
        // One entry rather than three: the letters, the templates they are
        // drafted from, and who signs them are one job.
        title: "Letters",
        url: "/manage/letters",
        icon: FileCheck2,
        items: [
          { title: "Issued Letters", url: "/manage/letters", icon: FileCheck2 },
          { title: "Templates", url: "/manage/letter-templates", icon: FileText },
          { title: "Signatories", url: "/manage/signatories", icon: PenTool },
        ],
      },
    ],
  },

  {
    id: "insights",
    label: "Insights",
    items: [{ title: "Reports", url: "/reports", icon: BarChart3 }],
  },

  {
    id: "admin",
    label: "Administration",
    items: [
      {
        title: "Users & Roles",
        url: "/manage/users",
        icon: ShieldCheck,
        alsoActiveFor: ["/manage/roles"],
      },
      { title: "Settings", url: "/manage/settings", icon: SlidersHorizontal },
      { title: "Email Center", url: "/manage/emails", icon: Mail },
      {
        title: "Data Management",
        url: "/data-management",
        icon: DatabaseBackup,
        // The form builder has its own entry below, so it must not also light
        // up the hub it happens to live under.
        notActiveFor: ["/data-management/forms"],
      },
      { title: "Form Builder", url: "/data-management/forms", icon: ClipboardList },
      { title: "Audit Trail", url: "/audit", icon: History },
    ],
  },
];

function startsWithSegment(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * Whether `item` is the one the current path belongs to.
 *
 * This replaces the twenty-five hand-written `pathname.startsWith(...)`
 * expressions the nav used to carry, each of which had to be found and edited
 * whenever a route moved.
 */
export function isItemActive(pathname: string, item: NavLeaf): boolean {
  if (item.notActiveFor?.some((p) => startsWithSegment(pathname, p))) return false;
  if (item.alsoActiveFor?.some((p) => startsWithSegment(pathname, p))) return true;
  return item.match === "exact" ? pathname === item.url : startsWithSegment(pathname, item.url);
}

/** True when the item itself, or any child of it, is the current one. */
export function isItemOnPath(pathname: string, item: NavItem): boolean {
  return (
    isItemActive(pathname, item) || !!item.items?.some((child) => isItemActive(pathname, child))
  );
}

/**
 * The sections this role may actually see.
 *
 * Pruning runs bottom-up — children, then items, then sections — so a role
 * that can reach none of a group's screens never sees its heading. A parent
 * whose own url is out of reach still renders when a child is reachable, and
 * points at the first child that is.
 *
 * `hasReports: false` also drops My Team. The route stays open to the role —
 * someone may gain a reportee tomorrow — but a link to an empty page is noise.
 * Left undefined, the role alone decides.
 *
 * This is navigation only. `requireFeature` on each route group and the check
 * in `middleware.ts` are what actually enforce access; hiding a link has never
 * been a control.
 */
export function visibleSections(
  role: UserRole | null | undefined,
  options: { hasReports?: boolean } = {}
): NavSection[] {
  const shows = (url: string) =>
    canAccessRoute(role, url) && !(url === "/my-team" && options.hasReports === false);

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.flatMap((item) => {
      if (!item.items) {
        return shows(item.url) ? [item] : [];
      }
      const items = item.items.filter((child) => shows(child.url));
      if (items.length === 0) return [];
      return [{ ...item, items, url: items[0].url }];
    }),
  })).filter((section) => section.items.length > 0);
}
