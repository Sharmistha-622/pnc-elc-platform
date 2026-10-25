import { ShieldAlert } from "lucide-react";

import { DashboardGreeting } from "@/components/dashboard-greeting";
import { requireFeature } from "@/lib/rbac/requireFeature";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getHasReports } from "@/lib/employees/hasReports";
import { TONES } from "@/lib/ui/tone";
import { AtAGlance } from "./_components/dashboard/at-a-glance";
import { WaitingOnYou } from "./_components/dashboard/waiting-on-you";

/**
 * The home screen, composed per role by `src/lib/dashboard/widgets.ts`.
 *
 * It replaced a grid of eight shortcut cards that every role was shown, most
 * of which led somewhere the role was then refused. The sidebar is the way
 * around the app; this page is what is waiting on you, and the few numbers
 * your job turns on.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [{ role }, { denied }, hasReports] = await Promise.all([
    requireFeature("dashboard"),
    searchParams,
    getHasReports(),
  ]);
  const data = await getDashboardData(role, { hasReports });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <DashboardGreeting />

      {denied && <DeniedNotice />}

      {data && (
        <>
          <p className="-mt-2 text-sm text-muted-foreground">{data.focus}</p>
          <WaitingOnYou groups={data.tasks} />
          <AtAGlance stats={data.stats} />
        </>
      )}
    </div>
  );
}

/**
 * Middleware sends a refused request here with `?denied=`. The path itself is
 * not echoed back: it came from the URL, and repeating attacker-chosen text on
 * a trusted page is how a phishing link borrows the app's voice.
 */
function DeniedNotice() {
  return (
    <div role="status" className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${TONES.warning.soft}`}>
      <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
      That page isn&apos;t part of your role, so you&apos;ve been brought back to your dashboard.
    </div>
  );
}
