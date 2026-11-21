import { Suspense } from "react";
import { StatsView } from "@/components/StatsView";
import { DataError, Loading, MockBanner, PageTitle } from "@/components/ui";
import { dataMode, getAllPlayerStats } from "@/lib/data";

export const metadata = { title: "Player stats | NECC CS2" };

async function Stats() {
  const results = await getAllPlayerStats();

  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return <DataError message={failed.error} />;

  const divisions = results.flatMap((result) => (result.ok ? [result.stats] : []));
  const players = divisions.flatMap((d) => d.players);
  const expected = divisions.reduce((sum, d) => sum + d.matchesExpected, 0);
  const covered = divisions.reduce((sum, d) => sum + d.matchesWithStats, 0);
  const maps = divisions.reduce((sum, d) => sum + d.mapsCounted, 0);
  const playoffs = divisions.reduce((sum, d) => sum + d.playoffMatchesExpected, 0);

  return (
    <>
      <MockBanner mode={dataMode()} />
      <StatsView players={players} divisions={divisions.map((d) => d.division)} />
      <p className="mt-4 max-w-[75ch] text-sm text-faint">
        {players.length} players across {maps} maps. FACEIT had statistics for {covered} of {expected} played matches
        {playoffs > 0 ? `, ${playoffs} of them playoff matches` : ""}. Forfeited maps are not counted.
      </p>
    </>
  );
}

export default function StatsPage() {
  return (
    <>
      <PageTitle title="Player stats">Regular season and playoff totals. Select a column heading to sort by it.</PageTitle>
      <Suspense fallback={<Loading label="player stats (this can take a little while the first time)" />}>
        <Stats />
      </Suspense>
    </>
  );
}
