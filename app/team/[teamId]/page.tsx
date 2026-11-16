import Link from "next/link";
import { Suspense } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { DataError, Diff, Loading, MockBanner, percent, th } from "@/components/ui";
import { StatsView } from "@/components/StatsView";
import { dataMode, getDivisionPlayerStats, getLeague } from "@/lib/data";
import {
  computeRecords,
  findTeam,
  groupStandings,
  isDisqualified,
  playoffSpots,
  type Match,
} from "@/lib/league";

const h2 = "mb-2 mt-10 font-display text-2xl font-semibold";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

function formatDate(ms: number | null): string {
  return ms ? dateFormat.format(new Date(ms)) : "TBD";
}

function MatchRow({ match, teamId, logos }: { match: Match; teamId: string; logos: Map<string, string | null> }) {
  const side = match.teamIds[0] === teamId ? 0 : 1;
  const other = side === 0 ? 1 : 0;
  const finished = match.status === "finished";

  let outcome = match.status === "cancelled" ? "Cancelled" : match.status === "ongoing" ? "Live" : "Upcoming";
  let tone = "text-muted";
  if (finished) {
    if (match.winner === side) {
      outcome = match.forfeitBy === other ? "Win by forfeit" : "Win";
      tone = "font-semibold text-accent";
    } else if (match.winner === other) {
      outcome = match.forfeitBy === side ? "Forfeit" : "Loss";
      tone = "text-faint";
    } else {
      outcome = "Draw";
    }
  }

  const playedMaps = match.maps.filter((map) => !map.forfeit);
  const opponentId = match.teamIds[other];

  return (
    <tr className="border-b border-line hover:bg-surface">
      <td className="px-3 py-2 text-faint">{match.round !== null ? match.round : ""}</td>
      <td className="px-3 py-2 text-muted">
        {formatDate(finished ? (match.finishedAt ?? match.scheduledAt) : match.scheduledAt)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <TeamLogo src={logos.get(opponentId) ?? null} name={match.teamNames[other]} size={24} />
          <Link href={`/team/${opponentId}`} className="font-semibold hover:text-accent">
            {match.teamNames[other]}
          </Link>
        </div>
      </td>
      <td className={`px-3 py-2 ${tone}`}>{outcome}</td>
      <td className="px-3 py-2 text-right font-semibold">
        {finished ? `${match.mapScore[side]}-${match.mapScore[other]}` : ""}
      </td>
      <td className="px-3 py-2 text-muted">
        {playedMaps.map((map) => `${map.scores[side]}-${map.scores[other]}`).join(", ")}
      </td>
      <td className="px-3 py-2 text-right">
        {match.url ? (
          <a href={match.url} target="_blank" rel="noreferrer" className="text-muted underline hover:text-accent">
            Match room
          </a>
        ) : null}
      </td>
    </tr>
  );
}

async function TeamDetails({ params }: Pick<PageProps<"/team/[teamId]">, "params">) {
  const { teamId } = await params;
  const result = await getLeague();
  if (!result.ok) return <DataError message={result.error} />;

  const found = findTeam(result.league, teamId);
  if (!found) {
    return <p className="text-muted">No team with this id is in the four Fall 2026 divisions.</p>;
  }

  const { team, division } = found;
  const record = computeRecords(division).get(team.id);
  const rank =
    team.group !== null ? groupStandings(division, team.group).find((row) => row.teamId === team.id)?.rank : undefined;
  const matches = division.matches.filter((match) => match.teamIds.includes(team.id));
  const logos = new Map(division.teams.map((t) => [t.id, t.avatar]));

  const statsResult = await getDivisionPlayerStats(division.division);
  const teamPlayers = statsResult.ok ? statsResult.stats.players.filter((player) => player.teamId === team.id) : [];

  const summary = record
    ? [
        {
          label: "Matches",
          value: `${record.matchWins}-${record.matchLosses}`,
          detail: percent(record.matchWins, record.played),
        },
        {
          label: "Maps",
          value: `${record.mapWins}-${record.mapLosses}`,
          detail: <Diff value={record.mapWins - record.mapLosses} />,
        },
        {
          label: "Rounds",
          value: `${record.roundWins}-${record.roundLosses}`,
          detail: <Diff value={record.roundWins - record.roundLosses} />,
        },
        { label: "Forfeits", value: String(record.forfeits), detail: record.forfeits === 1 ? "match" : "matches" },
      ]
    : [];

  return (
    <>
      <MockBanner mode={dataMode()} />

      <div className="flex items-center gap-5">
        <TeamLogo src={team.avatar} name={team.name} size={88} />
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">{team.name}</h1>
          <p className="mt-2 text-muted">
            {division.name}
            {team.group !== null ? `, group ${team.group}` : ""}
            {record && isDisqualified(record) ? (
              <>
                {", "}
                <span className="text-accent">disqualified from playoffs ({record.forfeits} forfeits)</span>
              </>
            ) : rank ? (
              <>
                {", "}
                <span className={rank <= playoffSpots(division.division) ? "text-accent" : ""}>
                  ranked {rank} in group
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {summary.length > 0 ? (
        <dl className="mt-6 grid grid-cols-2 border-y border-line sm:grid-cols-4">
          {summary.map((stat) => (
            <div key={stat.label} className="border-line px-3 py-3 sm:border-l sm:first:border-l-0">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="font-display text-3xl font-bold leading-tight tabular-nums">{stat.value}</dd>
              <dd className="text-sm text-muted tabular-nums">{stat.detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <h2 className={h2}>Matches</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-left">
              <th className={th}>Round</th>
              <th className={th}>Date</th>
              <th className={th}>Opponent</th>
              <th className={th}>Result</th>
              <th className={`${th} text-right`}>Maps</th>
              <th className={th}>Round scores</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <MatchRow key={match.id} match={match} teamId={team.id} logos={logos} />
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={h2}>Player stats</h2>
      {teamPlayers.length > 0 ? (
        <StatsView players={teamPlayers} divisions={[]} showTeam={false} />
      ) : (
        <p className="text-muted">
          {statsResult.ok ? "No played maps with statistics yet." : `Player stats did not load: ${statsResult.error}`}
        </p>
      )}

      <h2 className={h2}>Roster</h2>
      {team.members.length > 0 ? (
        <p className="max-w-[75ch] text-muted">{team.members.map((member) => member.nickname).join(", ")}</p>
      ) : (
        <p className="text-muted">FACEIT returned no roster for this team.</p>
      )}
    </>
  );
}

export default function TeamPage({ params }: PageProps<"/team/[teamId]">) {
  return (
    <>
      <p className="mb-6 text-sm">
        <Link href="/rankings" className="text-muted underline hover:text-accent">
          Season rankings
        </Link>
      </p>
      <Suspense fallback={<Loading label="team" />}>
        <TeamDetails params={params} />
      </Suspense>
    </>
  );
}
