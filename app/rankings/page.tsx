import { Suspense } from "react";
import { RankingsView, type RankingsDivision } from "@/components/RankingsView";
import { DataError, Loading, MockBanner, PageTitle } from "@/components/ui";
import { dataMode, getLeague } from "@/lib/data";
import { groupStandings, playoffSpots } from "@/lib/league";

export const metadata = { title: "Season rankings | NECC CS2" };

async function Rankings() {
  const result = await getLeague();
  if (!result.ok) return <DataError message={result.error} />;

  const divisions: RankingsDivision[] = result.league.divisions.map((division) => ({
    division: division.division,
    name: division.name,
    playoffSpots: playoffSpots(division.division),
    groups: division.groups.map((group) => ({ group, standings: groupStandings(division, group) })),
  }));

  return (
    <>
      <MockBanner mode={dataMode()} />
      <RankingsView divisions={divisions} />
    </>
  );
}

export default function RankingsPage() {
  return (
    <>
      <PageTitle title="Season rankings" />
      <Suspense fallback={<Loading label="standings" />}>
        <Rankings />
      </Suspense>
    </>
  );
}
