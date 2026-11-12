import { TeamChart } from '@/components/shared/team-chart/TeamChart'
import { TeamChartError } from '@/components/shared/team-chart/TeamChartError'
import { getOrgChart } from '@/lib/org/getTeamChart'

/** Everyone in the organisation, by team. Super Admin and PnC Admin (layout gate). */
export default async function OrgChartPage() {
  const result = await getOrgChart()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 pb-20 md:p-6 lg:p-8">
      {result.ok ? (
        <TeamChart chart={result.chart} title="Org chart" headingLevel="h1" emptyText="Nobody is on the chart yet." />
      ) : (
        <TeamChartError message={result.error} />
      )}
    </div>
  )
}
