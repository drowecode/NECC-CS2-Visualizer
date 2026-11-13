/**
 * Aggregates FACEIT per-map statistics into season totals per player.
 * Pure functions, no network and no Next.js imports.
 */

import type { RawMatchStats } from "./faceit";
import type { DivisionData } from "./league";

export type PlayerLine = {
  playerId: string;
  nickname: string;
  teamId: string;
  teamName: string;
  division: number;
  maps: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  damage: number;
  mvps: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
};

export type DivisionStats = {
  division: number;
  /** Finished matches that had at least one played map. */
  matchesExpected: number;
  /** Of those, how many FACEIT returned statistics for. */
  matchesWithStats: number;
  mapsCounted: number;
  players: PlayerLine[];
};

/** FACEIT sends every statistic as a string; missing or blank becomes 0. */
function num(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Reads the first key that exists, since FACEIT's key names vary a little by game. */
function pick(stats: Record<string, string | number> | undefined, ...keys: string[]): number {
  if (!stats) return 0;
  for (const key of keys) {
    if (stats[key] !== undefined && stats[key] !== "") return num(stats[key]);
  }
  return 0;
}

/** Matches worth asking FACEIT for statistics: finished, with a map that was really played. */
export function matchesWithPlayedMaps(division: DivisionData) {
  return division.matches.filter((match) => match.status === "finished" && match.maps.some((map) => !map.forfeit));
}

export function aggregatePlayerStats(
  division: DivisionData,
  statsByMatch: Map<string, RawMatchStats | null>,
): DivisionStats {
  const teamNames = new Map(division.teams.map((team) => [team.id, team.name]));
  const players = new Map<string, PlayerLine>();
  let matchesWithStats = 0;
  let mapsCounted = 0;

  for (const match of matchesWithPlayedMaps(division)) {
    const stats = statsByMatch.get(match.id);
    if (!stats?.rounds?.length) continue;
    matchesWithStats += 1;

    for (const map of stats.rounds) {
      const rounds = pick(map.round_stats, "Rounds");
      // A map with 0 or 1 rounds was forfeited, not played.
      if (rounds <= 1) continue;
      mapsCounted += 1;

      for (const team of map.teams ?? []) {
        const teamId = team.team_id ?? "";
        for (const player of team.players ?? []) {
          if (!player.player_id) continue;
          const key = `${player.player_id}:${teamId}`;
          let line = players.get(key);
          if (!line) {
            line = {
              playerId: player.player_id,
              nickname: player.nickname ?? "?",
              teamId,
              teamName: teamNames.get(teamId) ?? "Unknown team",
              division: division.division,
              maps: 0,
              rounds: 0,
              kills: 0,
              deaths: 0,
              assists: 0,
              headshots: 0,
              damage: 0,
              mvps: 0,
              tripleKills: 0,
              quadroKills: 0,
              pentaKills: 0,
            };
            players.set(key, line);
          }
          const s = player.player_stats;
          line.nickname = player.nickname ?? line.nickname;
          line.maps += 1;
          line.rounds += rounds;
          line.kills += pick(s, "Kills");
          line.deaths += pick(s, "Deaths");
          line.assists += pick(s, "Assists");
          line.headshots += pick(s, "Headshots", "Headshot");
          // Total damage if FACEIT gives it; otherwise rebuild it from the per-round average.
          const damage = pick(s, "Damage");
          line.damage += damage > 0 ? damage : pick(s, "ADR") * rounds;
          line.mvps += pick(s, "MVPs");
          line.tripleKills += pick(s, "Triple Kills");
          line.quadroKills += pick(s, "Quadro Kills");
          line.pentaKills += pick(s, "Penta Kills");
        }
      }
    }
  }

  return {
    division: division.division,
    matchesExpected: matchesWithPlayedMaps(division).length,
    matchesWithStats,
    mapsCounted,
    players: [...players.values()],
  };
}

/* ---------- Derived numbers ---------- */

export const kd = (p: PlayerLine) => (p.deaths ? p.kills / p.deaths : p.kills);
export const adr = (p: PlayerLine) => (p.rounds ? p.damage / p.rounds : 0);
export const kpr = (p: PlayerLine) => (p.rounds ? p.kills / p.rounds : 0);
export const hsPercent = (p: PlayerLine) => (p.kills ? (p.headshots / p.kills) * 100 : 0);
