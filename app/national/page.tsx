import Link from "next/link";
import { Suspense } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { DataError, Diff, ForfeitTag, Loading, MockBanner, PageTitle, percent, th } from "@/components/ui";
import { dataMode, getLeague } from "@/lib/data";
import { nationalRankings } from "@/lib/league";

export const metadata = { title: "National rankings | NECC CS2" };

async function National() {
  const result = await getLeague();
  if (!result.ok) return <DataError message={result.error} />;
  const rows = nationalRankings(result.league);

  return (
    <>
      <MockBanner mode={dataMode()} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-right">
              <th className={`${th} text-center`}>#</th>
              <th className={`${th} text-left`}>Team</th>
              <th className={`${th} text-left`}>Division</th>
              <th className={th}>Matches</th>
              <th className={th}>Win rate</th>
              <th className={th}>Maps</th>
              <th className={th}>Rounds</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-b border-line hover:bg-surface">
                <td className="w-12 px-3 py-2 text-center font-display text-xl font-bold leading-none text-faint">
                  {row.rank}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <TeamLogo src={row.avatar} name={row.teamName} size={28} />
                    <Link href={`/team/${row.teamId}`} className="font-semibold hover:text-accent">
                      {row.teamName}
                    </Link>
                    <ForfeitTag count={row.forfeits} />
                  </div>
                </td>
                <td className="px-3 py-2 text-muted">
                  D{row.division}
                  {row.group !== null ? `, group ${row.group}` : ""}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {row.matchWins}-{row.matchLosses}
                  {row.matchDraws ? `-${row.matchDraws}` : ""}
                </td>
                <td className="px-3 py-2 text-right text-muted">{percent(row.matchWins, row.played)}</td>
                <td className="px-3 py-2 text-right">
                  <span className="mr-2 text-muted">
                    {row.mapWins}-{row.mapLosses}
                  </span>
                  <Diff value={row.mapWins - row.mapLosses} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Diff value={row.roundWins - row.roundLosses} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function NationalPage() {
  return (
    <>
      <PageTitle title="National rankings">
        Every team in one list. Higher divisions rank above lower ones. Within a division, teams are ordered by match
        win rate, then match wins, map differential and round differential.
      </PageTitle>
      <Suspense fallback={<Loading label="rankings" />}>
        <National />
      </Suspense>
    </>
  );
}
