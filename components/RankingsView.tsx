"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { Standing } from "@/lib/league";
import { TeamLogo } from "./TeamLogo";
import { Diff, ForfeitTag, percent, th } from "./ui";

export type RankingsDivision = {
  division: number;
  name: string;
  /** How many teams per group advance to playoffs. */
  playoffSpots: number;
  groups: { group: number; standings: Standing[] }[];
};

const COLUMN_COUNT = 5;

function Row({ row, qualifies }: { row: Standing; qualifies: boolean }) {
  return (
    <tr className="border-b border-line hover:bg-surface">
      <td
        className={
          "px-1 py-3 text-center font-display text-2xl font-bold leading-none " +
          (qualifies ? "text-accent" : "text-faint")
        }
      >
        {row.rank}
      </td>
      <td className="px-2 py-3 sm:px-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamLogo src={row.avatar} name={row.teamName} size={36} />
          <Link href={`/team/${row.teamId}`} className="truncate text-base font-semibold hover:text-accent">
            {row.teamName}
          </Link>
          <ForfeitTag count={row.forfeits} />
        </div>
      </td>
      <td className="px-2 py-3 text-right sm:px-3">
        <span className="font-semibold">
          {row.matchWins}-{row.matchLosses}
          {row.matchDraws ? `-${row.matchDraws}` : ""}
        </span>
        <span className="ml-2 hidden text-muted sm:inline">{percent(row.matchWins, row.played)}</span>
      </td>
      <td className="px-2 py-3 text-right sm:px-3">
        <span className="mr-2 hidden text-muted sm:inline">
          {row.mapWins}-{row.mapLosses}
        </span>
        <Diff value={row.mapWins - row.mapLosses} />
      </td>
      <td className="px-2 py-3 text-right sm:px-3">
        <span className="mr-2 hidden text-muted sm:inline">
          {row.roundWins}-{row.roundLosses}
        </span>
        <Diff value={row.roundWins - row.roundLosses} />
      </td>
    </tr>
  );
}

export function RankingsView({ divisions }: { divisions: RankingsDivision[] }) {
  const [divisionNumber, setDivisionNumber] = useState(divisions[0]?.division ?? 1);
  const [groupByDivision, setGroupByDivision] = useState<Record<number, number>>({});

  const division = divisions.find((d) => d.division === divisionNumber) ?? divisions[0];
  if (!division) return <p className="text-muted">No divisions found.</p>;

  const groupNumber = groupByDivision[division.division] ?? division.groups[0]?.group;
  const group = division.groups.find((g) => g.group === groupNumber) ?? division.groups[0];

  return (
    <div>
      <div role="tablist" aria-label="Division" className="flex flex-wrap gap-x-4 border-b border-line sm:gap-x-7">
        {divisions.map((d) => {
          const selected = d.division === division.division;
          return (
            <button
              key={d.division}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDivisionNumber(d.division)}
              className={
                "-mb-px border-b-2 pb-2 font-display text-lg font-semibold sm:text-2xl " +
                (selected ? "border-accent text-foreground" : "border-transparent text-faint hover:text-foreground")
              }
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {division.groups.length > 0 ? (
        <div role="tablist" aria-label="Group" className="mt-4 flex flex-wrap gap-2">
          {division.groups.map((g) => {
            const selected = g.group === group.group;
            return (
              <button
                key={g.group}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setGroupByDivision((current) => ({ ...current, [division.division]: g.group }))}
                className={
                  "rounded-xs border px-3 py-1 text-sm font-medium " +
                  (selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-line text-muted hover:border-muted hover:text-foreground")
                }
              >
                Group {g.group}
              </button>
            );
          })}
        </div>
      ) : null}

      {group ? (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full table-fixed tabular-nums">
              <colgroup>
                <col className="w-10 sm:w-14" />
                <col />
                <col className="w-16 sm:w-36" />
                <col className="w-12 sm:w-28" />
                <col className="w-14 sm:w-36" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-right">
                  <th className={`${th} text-center`}>#</th>
                  <th className={`${th} text-left`}>Team</th>
                  <th className={`${th} !px-2 sm:!px-3`}>
                    <span className="sm:hidden">W-L</span>
                    <span className="hidden sm:inline">Matches</span>
                  </th>
                  <th className={`${th} !px-2 sm:!px-3`}>Maps</th>
                  <th className={`${th} !px-2 sm:!px-3`}>
                    <span className="sm:hidden">Rds</span>
                    <span className="hidden sm:inline">Rounds</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((row, index) => (
                  <Fragment key={row.teamId}>
                    <Row row={row} qualifies={row.rank <= division.playoffSpots} />
                    {index === division.playoffSpots - 1 && index < group.standings.length - 1 ? (
                      <tr aria-hidden="true">
                        <td colSpan={COLUMN_COUNT} className="p-0">
                          <div className="flex items-center gap-3 text-xs font-medium text-accent">
                            <span className="h-0.5 flex-1 bg-accent" />
                            Playoff line
                            <span className="h-0.5 w-3 bg-accent sm:w-6" />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[75ch] text-sm text-faint">
            The top {division.playoffSpots} teams in each {division.name} group make playoffs. Ties are broken by match
            wins, then map differential, round differential and head-to-head record. Forfeited maps count toward match
            and map records but add no rounds.
          </p>
        </>
      ) : (
        <p className="mt-5 text-muted">No groups have been set up for {division.name} yet.</p>
      )}
    </div>
  );
}
