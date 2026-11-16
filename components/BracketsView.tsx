"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Match } from "@/lib/league";
import type { Bracket, BracketRound, BracketTeam } from "@/lib/playoffs";
import { TeamLogo } from "./TeamLogo";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const formatDate = (ms: number | null) => (ms ? dateFormat.format(new Date(ms)) : "Date to be set");

const STATE_LABEL: Record<Bracket["state"], string> = {
  "not-started": "Not started",
  upcoming: "Upcoming",
  live: "In progress",
  finished: "Finished",
};

type Logos = Map<string, string | null>;

function TeamRow({ match, side, logos }: { match: Match; side: 0 | 1; logos: Logos }) {
  const finished = match.status === "finished";
  const won = finished && match.winner === side;
  const lost = finished && match.winner !== null && match.winner !== side;
  const forfeited = match.forfeitBy === side;

  return (
    <div className={"flex items-center gap-2 px-2 py-1.5 " + (lost ? "text-faint" : "")}>
      <TeamLogo src={logos.get(match.teamIds[side]) ?? null} name={match.teamNames[side]} size={22} />
      <Link
        href={`/team/${match.teamIds[side]}`}
        className={"min-w-0 flex-1 truncate text-sm hover:text-accent " + (won ? "font-semibold" : "")}
      >
        {match.teamNames[side]}
      </Link>
      <span className={"w-6 text-right text-sm tabular-nums " + (won ? "font-semibold text-accent" : "")}>
        {finished ? (forfeited ? "FF" : match.mapScore[side]) : ""}
      </span>
    </div>
  );
}

function MatchBox({ match, logos }: { match: Match | null; logos: Logos }) {
  if (!match) {
    return (
      <div className="w-56 rounded-xs border border-dashed border-line px-2 py-3 text-sm text-faint">
        Waiting on earlier results
      </div>
    );
  }
  const live = match.status === "ongoing";
  return (
    <div className={"w-56 rounded-xs border bg-surface " + (live ? "border-accent" : "border-line")}>
      <TeamRow match={match} side={0} logos={logos} />
      <div className="border-t border-line" />
      <TeamRow match={match} side={1} logos={logos} />
      <div className="flex items-center justify-between border-t border-line px-2 py-1 text-xs text-faint">
        <span className={live ? "text-accent" : ""}>
          {live ? "Live now" : formatDate(match.status === "finished" ? (match.finishedAt ?? match.scheduledAt) : match.scheduledAt)}
        </span>
        {match.url ? (
          <a href={match.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
            Match room
          </a>
        ) : null}
      </div>
    </div>
  );
}

function TeamList({ teams }: { teams: BracketTeam[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
      {teams.map((team) => (
        <li key={team.id} className="flex items-center gap-2">
          <TeamLogo src={team.avatar} name={team.name} size={24} />
          <Link href={`/team/${team.id}`} className="truncate hover:text-accent">
            {team.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One side of a bracket: a column per round, with lines joining matches to the next round. */
function RoundColumns({ rounds, logos }: { rounds: BracketRound[]; logos: Logos }) {
  const lastRound = rounds.length - 1;
  return (
    <div className="flex min-w-max">
      {rounds.map((round, roundIndex) => {
        // True when two matches of the previous round feed each match of this one.
        const joinsTwo = roundIndex > 0 && rounds[roundIndex - 1].slots.length === round.slots.length * 2;
        return (
          <div key={round.name} className="flex flex-col">
            <h4 className="mb-2 px-4 text-sm font-medium text-muted">{round.name}</h4>
            <div className="flex flex-1 flex-col">
              {round.slots.map((slot) => (
                <div key={slot.key} className="relative flex flex-1 items-center px-4 py-2">
                  {roundIndex > 0 ? (
                    <>
                      {joinsTwo ? <span className="absolute bottom-1/4 left-0 top-1/4 border-l border-line" /> : null}
                      <span className="absolute left-0 top-1/2 w-4 border-t border-line" />
                    </>
                  ) : null}
                  {roundIndex < lastRound ? (
                    <span className="absolute right-0 top-1/2 w-4 border-t border-line" />
                  ) : null}
                  <MatchBox match={slot.match} logos={logos} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const h3 = "mb-1 mt-5 px-4 font-display text-xl font-semibold";

function BracketSection({ bracket }: { bracket: Bracket }) {
  const logos: Logos = new Map(bracket.teams.map((team) => [team.id, team.avatar]));
  const double = bracket.format === "double";

  return (
    <section className="border-t border-line py-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-display text-3xl font-bold leading-none">{bracket.region || "Playoff bracket"}</h2>
        <span className={bracket.state === "live" ? "text-accent" : "text-muted"}>
          {STATE_LABEL[bracket.state]}
          {bracket.state === "upcoming" && bracket.firstMatchAt ? `, starts ${formatDate(bracket.firstMatchAt)}` : ""}
        </span>
        <span className="text-sm text-muted">{double ? "Double elimination" : "Single elimination"}</span>
        <a href={bracket.url} target="_blank" rel="noreferrer" className="text-sm text-muted underline hover:text-accent">
          View on FACEIT
        </a>
      </div>

      {bracket.error ? <p className="mt-3 text-muted">FACEIT could not be read for this bracket: {bracket.error}</p> : null}

      {bracket.rounds.length === 0 ? (
        <>
          <p className="mt-3 max-w-[68ch] text-muted">
            {bracket.teams.length > 0
              ? `The bracket has not been drawn yet. ${bracket.teams.length} teams are signed up so far.`
              : "The bracket has not been drawn yet and no teams are signed up."}
          </p>
          {bracket.teams.length > 0 ? <TeamList teams={bracket.teams} /> : null}
        </>
      ) : (
        <div className="mt-2 overflow-x-auto pb-2">
          {double ? <h3 className={h3}>Upper bracket</h3> : <div className="mt-4" />}
          <RoundColumns rounds={bracket.rounds} logos={logos} />

          {double ? (
            <>
              <h3 className={h3}>Lower bracket</h3>
              <RoundColumns rounds={bracket.lowerRounds} logos={logos} />

              <h3 className={h3}>Grand final</h3>
              <div className="flex flex-wrap gap-4 px-4 py-2">
                <MatchBox match={bracket.grandFinal} logos={logos} />
                {bracket.grandFinalReset ? (
                  <div>
                    <MatchBox match={bracket.grandFinalReset} logos={logos} />
                    <p className="mt-1 text-xs text-faint">Deciding match, since the lower-bracket team won the first.</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {bracket.hasThirdPlace ? (
            <div className="mt-4 px-4">
              <h3 className="mb-2 text-sm font-medium text-muted">3rd place match</h3>
              <MatchBox match={bracket.thirdPlace} logos={logos} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function BracketsView({ brackets }: { brackets: Bracket[] }) {
  const divisions = [...new Set(brackets.map((b) => b.division))].sort((a, b) => a - b);
  // A link such as /playoffs?division=3 opens on that division.
  const requested = Number(useSearchParams().get("division"));
  const [division, setDivision] = useState(divisions.includes(requested) ? requested : (divisions[0] ?? 1));
  const shown = brackets.filter((b) => b.division === division);

  if (brackets.length === 0) return <p className="text-muted">No playoff brackets have been set up yet.</p>;

  return (
    <div>
      <div role="tablist" aria-label="Division" className="flex flex-wrap gap-x-4 sm:gap-x-7">
        {divisions.map((d) => {
          const selected = d === division;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDivision(d)}
              className={
                "border-b-2 pb-2 font-display text-lg font-semibold sm:text-2xl " +
                (selected ? "border-accent text-foreground" : "border-transparent text-faint hover:text-foreground")
              }
            >
              Division {d}
            </button>
          );
        })}
      </div>
      {shown.map((bracket) => (
        <BracketSection key={bracket.championshipId} bracket={bracket} />
      ))}
    </div>
  );
}
