import Link from "next/link";
import { Suspense } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { DataError, ForfeitTag, Loading, MockBanner, th } from "@/components/ui";
import { dataMode, getAllPlayerStats, getLeague, getPlayoffs } from "@/lib/data";
import { nationalRankings } from "@/lib/league";
import { bracketLabel } from "@/lib/playoffs";
import { adr, kd } from "@/lib/stats";

export const metadata = { title: "NECC CS2 | Fall 2026" };

const ROWS = 8;
const MIN_MAPS = 3;
const RULEBOOK = "/necc-cs2-rulebook.pdf";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

const h2 = "font-display text-3xl font-bold leading-none";
const more = "text-sm font-medium text-accent underline";

function SectionHead({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className={h2}>{title}</h2>
      <Link href={href} className={more}>
        {label}
      </Link>
    </div>
  );
}

async function TopTeams() {
  const result = await getLeague();
  if (!result.ok) return <DataError message={result.error} />;
  const rows = nationalRankings(result.league).slice(0, ROWS);

  return (
    <table className="w-full tabular-nums">
      <thead>
        <tr className="border-b border-line text-left">
          <th className={`${th} w-10 text-center`}>#</th>
          <th className={th}>Team</th>
          <th className={`${th} text-right`}>Matches</th>
          <th className={`${th} text-right`}>Maps</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.teamId} className="border-b border-line hover:bg-surface">
            <td className="px-3 py-2 text-center font-display text-xl font-bold leading-none text-faint">{row.rank}</td>
            <td className="px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <TeamLogo src={row.avatar} name={row.teamName} size={28} />
                <Link href={`/team/${row.teamId}`} className="truncate font-semibold hover:text-accent">
                  {row.teamName}
                </Link>
                <span className="text-sm text-faint">D{row.division}</span>
                <ForfeitTag count={row.forfeits} />
              </div>
            </td>
            <td className="px-3 py-2 text-right font-semibold">
              {row.matchWins}-{row.matchLosses}
            </td>
            <td className="px-3 py-2 text-right text-muted">
              {row.mapWins}-{row.mapLosses}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function TopPlayers() {
  const results = await getAllPlayerStats();
  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return <DataError message={failed.error} />;

  const players = results
    .flatMap((result) => (result.ok ? result.stats.players : []))
    .filter((player) => player.maps >= MIN_MAPS)
    .sort((a, b) => adr(b) - adr(a))
    .slice(0, ROWS);

  return (
    <>
      <table className="w-full tabular-nums">
        <thead>
          <tr className="border-b border-line text-left">
            <th className={`${th} w-10 text-center`}>#</th>
            <th className={th}>Player</th>
            <th className={`${th} text-right`}>Maps</th>
            <th className={`${th} text-right`}>K/D</th>
            <th className={`${th} text-right`}>ADR</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={`${player.playerId}:${player.teamId}`} className="border-b border-line hover:bg-surface">
              <td className="px-3 py-2 text-center font-display text-xl font-bold leading-none text-faint">
                {index + 1}
              </td>
              <td className="px-3 py-2">
                <a
                  href={`https://www.faceit.com/en/players/${encodeURIComponent(player.nickname)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold hover:text-accent hover:underline"
                >
                  {player.nickname}
                </a>
                <Link href={`/team/${player.teamId}`} className="block truncate text-sm text-muted hover:text-foreground">
                  {player.teamName}, D{player.division}
                </Link>
              </td>
              <td className="px-3 py-2 text-right text-muted">{player.maps}</td>
              <td className="px-3 py-2 text-right text-muted">{kd(player).toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-semibold">{adr(player).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-faint">
        Ranked by average damage per round, players with {MIN_MAPS} or more maps.
      </p>
    </>
  );
}

async function PlayoffSummary() {
  const result = await getPlayoffs();
  if (!result.ok) return <DataError message={result.error} />;
  if (result.brackets.length === 0) return <p className="text-muted">No playoff brackets have been set up yet.</p>;

  return (
    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {result.brackets.map((bracket) => {
        let status = "Bracket not drawn yet";
        if (bracket.state === "finished") status = "Finished";
        else if (bracket.state === "live") status = "In progress";
        else if (bracket.state === "upcoming") {
          status = bracket.firstMatchAt ? `Starts ${dateFormat.format(new Date(bracket.firstMatchAt))}` : "Upcoming";
        }
        return (
          <li key={bracket.championshipId} className="border-b border-line">
            <Link
              href={`/playoffs?division=${bracket.division}`}
              className="group flex items-baseline justify-between gap-3 py-2 hover:bg-surface"
            >
              <span className="font-semibold underline decoration-line underline-offset-4 group-hover:text-accent group-hover:decoration-accent">
                {bracketLabel(bracket)}
              </span>
              <span className={bracket.state === "live" ? "text-accent" : "text-muted"}>{status}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="mb-10">
        <h1 className="font-display text-5xl font-bold leading-none tracking-tight sm:text-7xl">
          NECC Counter-Strike 2
        </h1>
        <p className="mt-3 max-w-[60ch] text-lg text-muted">
          Fall 2026 standings, playoff brackets and player stats for all four divisions, updated from FACEIT throughout
          the day.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/rankings" className={more}>
            Group standings
          </Link>
          <Link href="/playoffs" className={more}>
            Playoff brackets
          </Link>
        </p>
      </div>

      <MockBanner mode={dataMode()} />

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
        <section>
          <SectionHead title="National rankings" href="/national" label="Full rankings" />
          <Suspense fallback={<Loading label="rankings" />}>
            <TopTeams />
          </Suspense>
        </section>

        <section>
          <SectionHead title="Player leaders" href="/stats" label="All player stats" />
          <Suspense fallback={<Loading label="player stats" />}>
            <TopPlayers />
          </Suspense>
        </section>
      </div>

      <section className="mt-12">
        <SectionHead title="Playoffs" href="/playoffs" label="See the brackets" />
        <Suspense fallback={<Loading label="brackets" />}>
          <PlayoffSummary />
        </Suspense>
      </section>

      <section className="mt-12 border-l-2 border-accent bg-surface px-5 py-4">
        <h2 className={h2}>Rules</h2>
        <p className="mt-2 max-w-[68ch] text-muted">
          The NECC Counter-Strike 2 rulebook covers rosters, match setup, scheduling, forfeits and playoffs for Fall
          2026 and Spring 2027.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/rules" className={more}>
            Read the rulebook
          </Link>
          <a href={RULEBOOK} download="NECC-CS2-Rulebook.pdf" className="text-sm font-medium text-muted underline hover:text-accent">
            Download the PDF
          </a>
        </p>
      </section>
    </>
  );
}
