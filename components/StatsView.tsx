"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { adr, hsPercent, kd, kpr, type PlayerLine } from "@/lib/stats";

type Column = {
  key: string;
  label: string;
  title: string;
  value: (p: PlayerLine) => number;
  format: (n: number) => string;
};

const whole = (n: number) => String(Math.round(n));

const COLUMNS: Column[] = [
  { key: "maps", label: "Maps", title: "Maps played", value: (p) => p.maps, format: whole },
  { key: "kills", label: "K", title: "Kills", value: (p) => p.kills, format: whole },
  { key: "deaths", label: "D", title: "Deaths", value: (p) => p.deaths, format: whole },
  { key: "assists", label: "A", title: "Assists", value: (p) => p.assists, format: whole },
  { key: "kd", label: "K/D", title: "Kills per death", value: kd, format: (n) => n.toFixed(2) },
  { key: "adr", label: "ADR", title: "Average damage per round", value: adr, format: (n) => n.toFixed(1) },
  { key: "kpr", label: "KPR", title: "Kills per round", value: kpr, format: (n) => n.toFixed(2) },
  { key: "hs", label: "HS%", title: "Share of kills that were headshots", value: hsPercent, format: (n) => `${n.toFixed(0)}%` },
  { key: "mvps", label: "MVPs", title: "Round MVP awards", value: (p) => p.mvps, format: whole },
  { key: "multi", label: "3K+", title: "Rounds with 3 or more kills", value: (p) => p.tripleKills + p.quadroKills + p.pentaKills, format: whole },
];

const PAGE_SIZE = 50;
const MIN_MAPS_OPTIONS = [1, 3, 5, 8];

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        "rounded-xs border px-3 py-1 text-sm font-medium " +
        (selected
          ? "border-foreground bg-foreground text-background"
          : "border-line text-muted hover:border-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

export function StatsView({
  players,
  divisions,
  showTeam = true,
}: {
  players: PlayerLine[];
  /** Division numbers to offer as filters. Leave empty to hide the filter. */
  divisions: number[];
  showTeam?: boolean;
}) {
  const [division, setDivision] = useState<number | null>(null);
  const [minMaps, setMinMaps] = useState(divisions.length > 0 ? 3 : 1);
  const [sortKey, setSortKey] = useState("adr");
  const [descending, setDescending] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0];
    const direction = descending ? -1 : 1;
    return players
      .filter((p) => (division === null || p.division === division) && p.maps >= minMaps)
      .sort((a, b) => direction * (column.value(a) - column.value(b)) || a.nickname.localeCompare(b.nickname));
  }, [players, division, minMaps, sortKey, descending]);

  function sortBy(key: string) {
    if (key === sortKey) setDescending((value) => !value);
    else {
      setSortKey(key);
      setDescending(true);
    }
    setShown(PAGE_SIZE);
  }

  const visible = rows.slice(0, shown);

  return (
    <div>
      {divisions.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <Pill selected={division === null} onClick={() => { setDivision(null); setShown(PAGE_SIZE); }}>
              All divisions
            </Pill>
            {divisions.map((d) => (
              <Pill key={d} selected={division === d} onClick={() => { setDivision(d); setShown(PAGE_SIZE); }}>
                Division {d}
              </Pill>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            Minimum maps
            <select
              value={minMaps}
              onChange={(event) => { setMinMaps(Number(event.target.value)); setShown(PAGE_SIZE); }}
              className="rounded-xs border border-line bg-background px-2 py-1 text-foreground"
            >
              {MIN_MAPS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] tabular-nums">
          <thead className="text-sm text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Player</th>
              {showTeam ? <th className="px-3 py-2 text-left font-medium">Team</th> : null}
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="px-2 py-2 text-right font-medium"
                  aria-sort={sortKey === column.key ? (descending ? "descending" : "ascending") : undefined}
                >
                  <button
                    type="button"
                    title={column.title}
                    onClick={() => sortBy(column.key)}
                    className={"hover:text-foreground " + (sortKey === column.key ? "text-accent" : "")}
                  >
                    {column.label}
                    {sortKey === column.key ? (descending ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((player, index) => (
              <tr key={`${player.playerId}:${player.teamId}`} className="border-b border-line hover:bg-surface">
                <td className="px-3 py-2 text-faint">{index + 1}</td>
                <td className="px-3 py-2 font-semibold">
                  <a
                    href={`https://www.faceit.com/en/players/${encodeURIComponent(player.nickname)}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`${player.nickname} on FACEIT`}
                    className="hover:text-accent hover:underline"
                  >
                    {player.nickname}
                  </a>
                </td>
                {showTeam ? (
                  <td className="px-3 py-2 text-muted">
                    <Link href={`/team/${player.teamId}`} className="hover:text-foreground hover:underline">
                      {player.teamName}
                    </Link>{" "}
                    <span className="text-faint">D{player.division}</span>
                  </td>
                ) : null}
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={"px-2 py-2 text-right " + (sortKey === column.key ? "font-semibold text-foreground" : "text-muted")}
                  >
                    {column.format(column.value(player))}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + (showTeam ? 3 : 2)} className="px-3 py-6 text-center text-muted">
                  No players match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {rows.length > shown ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted">
          <span>
            Showing {shown} of {rows.length} players.
          </span>
          <button
            type="button"
            onClick={() => setShown((value) => value + PAGE_SIZE)}
            className="rounded-xs border border-line px-3 py-1 hover:border-muted hover:text-foreground"
          >
            Show {Math.min(PAGE_SIZE, rows.length - shown)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
