import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPathname,
  mockCreateServerSupabaseClient,
  mockGetCurrentEmployee,
  mockGetMyForms,
} = vi.hoisted(() => ({
  mockPathname: vi.fn(() => "/employees"),
  mockCreateServerSupabaseClient: vi.fn(),
  mockGetCurrentEmployee: vi.fn(),
  mockGetMyForms: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

vi.mock("@/lib/forms/currentEmployee", () => ({
  getCurrentEmployee: mockGetCurrentEmployee,
}));

vi.mock("@/lib/forms/getMyForms", () => ({
  getMyForms: mockGetMyForms,
}));

import { getWaitingTasks } from "@/lib/dashboard/getDashboardData";
import {
  HeaderNotificationsList,
  flattenNotificationTasks,
} from "@/components/header-user-menu";
import {
  HeaderHelpTrigger,
  HelpPanelView,
  resolveHelpPanelForRoute,
} from "@/components/header-help-trigger";

describe("Notifications menu and Help panel button (#163)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCurrentEmployee.mockResolvedValue({
      employee: { id: "emp-1" },
      email: "asha@example.org",
    });

    mockGetMyForms.mockResolvedValue({
      items: [
        {
          requestId: "req-101",
          formName: "Annual Self-Assessment",
          aboutName: "Asha Verma",
          status: "Not started",
          canOpen: true,
        },
        {
          requestId: "req-102",
          formName: "Completed Survey",
          aboutName: null,
          status: "Submitted",
          canOpen: true,
        },
      ],
    });

    mockCreateServerSupabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "peer_feedback") {
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    eq: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "pf-201",
                          created_at: "2026-11-10T00:00:00Z",
                          confirmations: { employee_id: "emp-2" },
                        },
                      ],
                      error: null,
                    }),
                    ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "directory") {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({
                data: [{ id: "emp-2", name: "Rohan Das" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "employees") {
          return {
            select: () => ({
              eq: () => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: "emp-3" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "confirmations") {
          return {
            select: () => ({
              in: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: "conf-301",
                            employees: { name: "Kiran Rao" },
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    });
  });

  it("loads the caller's dashboard tasks with the same role rules and renders them in the Notifications menu", async () => {
    // Ordinary employee with no direct reports gets myForms + myPeerFeedback only
    const employeeTasks = await getWaitingTasks("employee", { hasReports: false });
    expect(employeeTasks.map((g) => g.id)).toEqual(["myForms", "myPeerFeedback"]);

    const flatEmployee = flattenNotificationTasks(employeeTasks);
    expect(flatEmployee).toEqual([
      {
        id: "req-101",
        title: "Annual Self-Assessment",
        detail: "About Asha Verma",
        href: "/my-forms/req-101",
        groupId: "myForms",
        groupLabel: "Forms to fill in",
      },
      {
        id: "pf-201",
        title: "Feedback for Rohan Das",
        detail: "Probation confirmation",
        href: "/feedback/pf-201",
        groupId: "myPeerFeedback",
        groupLabel: "Feedback you've been asked for",
      },
    ]);

    const menuHtml = renderToStaticMarkup(
      <HeaderNotificationsList tasks={employeeTasks} />
    );
    expect(menuHtml).toContain("Annual Self-Assessment");
    expect(menuHtml).toContain("/my-forms/req-101");
    expect(menuHtml).toContain("Feedback for Rohan Das");
    expect(menuHtml).toContain("/feedback/pf-201");
    expect(menuHtml).not.toContain("Confirm Kiran Rao");

    // Manager (or employee with direct reports) also receives teamDecisions
    const managerTasks = await getWaitingTasks("manager", { hasReports: true });
    expect(managerTasks.map((g) => g.id)).toEqual([
      "myForms",
      "myPeerFeedback",
      "teamDecisions",
    ]);
    const managerHtml = renderToStaticMarkup(
      <HeaderNotificationsList tasks={managerTasks} />
    );
    expect(managerHtml).toContain("Confirm Kiran Rao");
    expect(managerHtml).toContain("/confirmations/conf-301/manager-decision");
  });

  it("renders the Help button and opens the Help panel for the current page", () => {
    mockPathname.mockReturnValue("/employees");

    const triggerHtml = renderToStaticMarkup(<HeaderHelpTrigger />);
    expect(triggerHtml).toContain("Help: Employee Directory &amp; Records");
    expect(triggerHtml).toContain("Open page help");

    const resolved = resolveHelpPanelForRoute("/employees", "pnc_admin");
    expect(resolved).not.toBeNull();
    expect(resolved?.helpId).toBe("employees.overview");
    expect(resolved?.entry.title).toBe("Employee Directory & Records");

    const panelHtml = renderToStaticMarkup(
      <HelpPanelView
        entry={resolved!.entry}
        visibleSections={resolved!.visibleSections}
      />
    );
    expect(panelHtml).toContain("Employee Directory &amp; Records");
    expect(panelHtml).toContain("Directory Management");
  });
});
