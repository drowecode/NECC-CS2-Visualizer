/**
 * Aggregates FACEIT per-map statistics into season totals per player,
 * regular season and playoffs together.
 * Pure functions, no network and no Next.js imports.
 */

import type { RawMatchStats } from "./faceit";
import type { DivisionData, Match } from "./league";

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
  /** How many of the expected matches are playoff matches. */
  playoffMatchesExpected: number;
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

/** The only statistics the site reads. Everything else FACEIT sends is dropped before caching. */
const ROUND_KEYS = ["Rounds", "Map"];
const PLAYER_KEYS = [
  "Kills",
  "Deaths",
  "Assists",
  "Headshots",
  "Headshot",
  "Damage",
  "ADR",
  "MVPs",
  "Triple Kills",
  "Quadro Kills",
  "Penta Kills",
];

function keep(stats: Record<string, string | number> | undefined, keys: string[]) {
  const kept: Record<string, string | number> = {};
  for (const key of keys) {
    if (stats?.[key] !== undefined) kept[key] = stats[key];
  }
  return kept;
}

/** A much smaller copy of a match's statistics, holding only what aggregatePlayerStats uses. */
export function slimMatchStats(stats: RawMatchStats | null): RawMatchStats | null {
  if (!stats?.rounds) return null;
  return {
    rounds: stats.rounds.map((map) => ({
      round_stats: keep(map.round_stats, ROUND_KEYS),
      teams: (map.teams ?? []).map((team) => ({
        team_id: team.team_id,
        players: (team.players ?? []).map((player) => ({
          player_id: player.player_id,
          nickname: player.nickname,
          player_stats: keep(player.player_stats, PLAYER_KEYS),
        })),
      })),
    })),
  };
}

const hasPlayedMap = (match: Match) => match.status === "finished" && match.maps.some((map) => !map.forfeit);

/**
 * Matches worth asking FACEIT for statistics: finished, with a map that was
 * really played. `playoffMatches` are the division's playoff bracket matches,
 * which live in separate FACEIT championships and are counted with the
 * regular season.
 */
export function matchesWithPlayedMaps(division: DivisionData, playoffMatches: Match[] = []): Match[] {
  const seen = new Set<string>();
  return [...division.matches, ...playoffMatches].filter((match) => {
    if (seen.has(match.id) || !hasPlayedMap(match)) return false;
    seen.add(match.id);
    return true;
  });
}

export function aggregatePlayerStats(
  division: DivisionData,
  statsByMatch: Map<string, RawMatchStats | null>,
  playoffMatches: Match[] = [],
): DivisionStats {
  const counted = matchesWithPlayedMaps(division, playoffMatches);
  const regularIds = new Set(division.matches.map((match) => match.id));
  // Names from the playoff matches first, so the regular season name wins.
  const teamNames = new Map<string, string>();
  for (const match of playoffMatches) match.teamIds.forEach((id, i) => teamNames.set(id, match.teamNames[i]));
  for (const team of division.teams) teamNames.set(team.id, team.name);
  const players = new Map<string, PlayerLine>();
  let matchesWithStats = 0;
  let mapsCounted = 0;

  for (const match of counted) {
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
    matchesExpected: counted.length,
    matchesWithStats,
    playoffMatchesExpected: counted.filter((match) => !regularIds.has(match.id)).length,
    mapsCounted,
    players: [...players.values()],
  };
}

/* ---------- Derived numbers ---------- */

export const kd = (p: PlayerLine) => (p.deaths ? p.kills / p.deaths : p.kills);
export const adr = (p: PlayerLine) => (p.rounds ? p.damage / p.rounds : 0);
export const kpr = (p: PlayerLine) => (p.rounds ? p.kills / p.rounds : 0);
export const hsPercent = (p: PlayerLine) => (p.kills ? (p.headshots / p.kills) * 100 : 0);
