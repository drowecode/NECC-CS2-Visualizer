/**
 * Turns raw FACEIT responses into the league model the pages use,
 * and computes standings. Pure functions, no network and no Next.js imports.
 */

import type { RawMatch, RawSubscription } from "./faceit";

export type Member = { id: string; nickname: string };

export type Team = {
  id: string;
  name: string;
  avatar: string | null;
  division: number;
  group: number | null;
  members: Member[];
};

export type MapResult = {
  /** Round scores, in the same order as Match.teamIds. */
  scores: [number, number];
  /** Index into Match.teamIds, or null when FACEIT gives no winner. */
  winner: 0 | 1 | null;
  /** True when the map was not actually played (see isForfeitMap). */
  forfeit: boolean;
};

export type Match = {
  id: string;
  division: number;
  group: number | null;
  round: number | null;
  status: "finished" | "upcoming" | "ongoing" | "cancelled";
  scheduledAt: number | null; // ms since epoch
  finishedAt: number | null; // ms since epoch
  teamIds: [string, string];
  teamNames: [string, string];
  /** Index into teamIds, or null for a draw or an unfinished match. */
  winner: 0 | 1 | null;
  /** Map wins per team, same order as teamIds. */
  mapScore: [number, number];
  maps: MapResult[];
  /** Index of the team that forfeited the whole match, or null. */
  forfeitBy: 0 | 1 | null;
  url: string | null;
};

export type DivisionData = {
  division: number;
  name: string;
  championshipId: string;
  groups: number[];
  teams: Team[];
  matches: Match[];
};

export type League = {
  fetchedAt: number;
  divisions: DivisionData[];
};

export type Standing = {
  teamId: string;
  teamName: string;
  avatar: string | null;
  division: number;
  group: number | null;
  rank: number;
  played: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  mapWins: number;
  mapLosses: number;
  roundWins: number;
  roundLosses: number;
  /** Whole matches this team forfeited. */
  forfeits: number;
};

/* ---------- Normalising raw data ---------- */

const FACTIONS = ["faction1", "faction2"] as const;

/**
 * FACEIT fills uneven groups with a placeholder team called "bye". Matches
 * against it are automatic 2-0 results, not real games, so the placeholder
 * and its matches are left out of everything.
 */
function isBye(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "bye";
}

function involvesBye(raw: RawMatch): boolean {
  return FACTIONS.some((key) => isBye(raw.teams?.[key]?.name));
}

/** FACEIT timestamps are in seconds; convert to milliseconds. */
function toMs(value: number | undefined): number | null {
  if (!value) return null;
  return value < 1e12 ? value * 1000 : value;
}

function normaliseStatus(status: string | undefined): Match["status"] {
  const s = (status ?? "").toUpperCase();
  if (s === "FINISHED") return "finished";
  if (s === "CANCELLED" || s === "ABORTED") return "cancelled";
  if (s === "ONGOING" || s === "READY" || s === "CONFIGURING" || s === "VOTING" || s === "PAUSED") {
    return "ongoing";
  }
  return "upcoming";
}

/**
 * The Data API has no forfeit flag. A real CS2 map cannot end with the
 * winner on 0 or 1 rounds, and FACEIT records a forfeited map as 1-0,
 * so any map where neither side passed 1 round is treated as a forfeit.
 */
function isForfeitMap(scores: [number, number]): boolean {
  return Math.max(scores[0], scores[1]) <= 1;
}

function factionIndex(value: string | undefined): 0 | 1 | null {
  if (value === "faction1") return 0;
  if (value === "faction2") return 1;
  return null;
}

export function normaliseMatch(raw: RawMatch, division: number): Match | null {
  const a = raw.teams?.faction1;
  const b = raw.teams?.faction2;
  if (!a?.faction_id || !b?.faction_id) return null; // bye or not yet seeded

  const status = normaliseStatus(raw.status);

  const maps: MapResult[] = (raw.detailed_results ?? []).map((result) => {
    const scores: [number, number] = [
      Number(result.factions?.faction1?.score ?? 0),
      Number(result.factions?.faction2?.score ?? 0),
    ];
    return { scores, winner: factionIndex(result.winner), forfeit: isForfeitMap(scores) };
  });

  const winner = status === "finished" ? factionIndex(raw.results?.winner) : null;

  // Map wins: count map winners when we have them, otherwise use the summary score.
  let mapScore: [number, number] = [
    maps.filter((m) => m.winner === 0).length,
    maps.filter((m) => m.winner === 1).length,
  ];
  if (mapScore[0] + mapScore[1] === 0 && raw.results?.score) {
    mapScore = [Number(raw.results.score.faction1 ?? 0), Number(raw.results.score.faction2 ?? 0)];
  }

  // A whole-match forfeit: finished, has a winner, and no map was really played.
  let forfeitBy: 0 | 1 | null = null;
  if (status === "finished" && winner !== null && maps.every((m) => m.forfeit)) {
    forfeitBy = winner === 0 ? 1 : 0;
  }

  return {
    id: raw.match_id,
    division,
    group: raw.group ?? null,
    round: raw.round ?? null,
    status,
    scheduledAt: toMs(raw.scheduled_at),
    finishedAt: toMs(raw.finished_at),
    teamIds: [a.faction_id, b.faction_id],
    teamNames: [a.name ?? "Unknown team", b.name ?? "Unknown team"],
    winner,
    mapScore,
    maps,
    forfeitBy,
    url: raw.faceit_url ? raw.faceit_url.replace("{lang}", "en") : null,
  };
}

export function buildDivision(
  info: { division: number; name: string; championshipId: string },
  allRawMatches: RawMatch[],
  rawSubscriptions: RawSubscription[],
): DivisionData {
  const rawMatches = allRawMatches.filter((raw) => !involvesBye(raw));
  const matches = rawMatches
    .map((raw) => normaliseMatch(raw, info.division))
    .filter((m): m is Match => m !== null)
    .sort((x, y) => (x.scheduledAt ?? 0) - (y.scheduledAt ?? 0));

  const teams = new Map<string, Team>();

  for (const sub of rawSubscriptions) {
    const id = sub.team?.team_id;
    if (!id || isBye(sub.team?.name)) continue;
    teams.set(id, {
      id,
      name: sub.team?.name ?? "Unknown team",
      avatar: sub.team?.avatar || null,
      division: info.division,
      group: sub.group ?? null,
      members: (sub.team?.members ?? [])
        .filter((m) => m.user_id)
        .map((m) => ({ id: m.user_id as string, nickname: m.nickname ?? "?" })),
    });
  }

  // Fill in anything the subscriptions list did not give us from the matches.
  for (const raw of rawMatches) {
    for (const key of FACTIONS) {
      const faction = raw.teams?.[key];
      if (!faction?.faction_id) continue;
      const existing = teams.get(faction.faction_id);
      if (!existing) {
        teams.set(faction.faction_id, {
          id: faction.faction_id,
          name: faction.name ?? "Unknown team",
          avatar: faction.avatar || null,
          division: info.division,
          group: raw.group ?? null,
          members: (faction.roster ?? [])
            .filter((p) => p.player_id)
            .map((p) => ({ id: p.player_id as string, nickname: p.nickname ?? "?" })),
        });
      } else {
        if (existing.group === null && raw.group != null) existing.group = raw.group;
        if (!existing.avatar && faction.avatar) existing.avatar = faction.avatar;
      }
    }
  }

  const groups = [...new Set([...teams.values()].map((t) => t.group).filter((g): g is number => g !== null))].sort(
    (x, y) => x - y,
  );

  return {
    ...info,
    groups,
    teams: [...teams.values()].sort((x, y) => x.name.localeCompare(y.name)),
    matches,
  };
}

/* ---------- Standings ---------- */

/** Teams per group that advance to playoffs, by division. Every division takes the top 4. */
const PLAYOFF_SPOTS: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 4 };

export function playoffSpots(division: number): number {
  return PLAYOFF_SPOTS[division] ?? 4;
}

function emptyStanding(team: Team): Standing {
  return {
    teamId: team.id,
    teamName: team.name,
    avatar: team.avatar,
    division: team.division,
    group: team.group,
    rank: 0,
    played: 0,
    matchWins: 0,
    matchLosses: 0,
    matchDraws: 0,
    mapWins: 0,
    mapLosses: 0,
    roundWins: 0,
    roundLosses: 0,
    forfeits: 0,
  };
}

/** Unranked records for every team in a division. */
export function computeRecords(division: DivisionData): Map<string, Standing> {
  const records = new Map<string, Standing>();
  for (const team of division.teams) records.set(team.id, emptyStanding(team));

  for (const match of division.matches) {
    if (match.status !== "finished") continue;
    for (const side of [0, 1] as const) {
      const record = records.get(match.teamIds[side]);
      if (!record) continue;
      const other = side === 0 ? 1 : 0;

      record.played += 1;
      if (match.winner === side) record.matchWins += 1;
      else if (match.winner === other) record.matchLosses += 1;
      else record.matchDraws += 1;

      record.mapWins += match.mapScore[side];
      record.mapLosses += match.mapScore[other];

      // Forfeited maps count for map records but have no real rounds.
      for (const map of match.maps) {
        if (map.forfeit) continue;
        record.roundWins += map.scores[side];
        record.roundLosses += map.scores[other];
      }

      if (match.forfeitBy === side) record.forfeits += 1;
    }
  }
  return records;
}

/** Head-to-head match wins of team a over team b, minus b over a. */
function headToHead(matches: Match[], a: string, b: string): number {
  let diff = 0;
  for (const match of matches) {
    if (match.status !== "finished" || match.winner === null) continue;
    const [x, y] = match.teamIds;
    if (!((x === a && y === b) || (x === b && y === a))) continue;
    diff += match.teamIds[match.winner] === a ? 1 : -1;
  }
  return diff;
}

/**
 * Tiebreakers, in order: total match wins, map win differential,
 * round win differential, head-to-head record. Team name settles anything left.
 */
export function compareStandings(matches: Match[]) {
  return (a: Standing, b: Standing): number =>
    b.matchWins - a.matchWins ||
    b.mapWins - b.mapLosses - (a.mapWins - a.mapLosses) ||
    b.roundWins - b.roundLosses - (a.roundWins - a.roundLosses) ||
    headToHead(matches, b.teamId, a.teamId) ||
    a.teamName.localeCompare(b.teamName);
}

/** A team that has forfeited this many whole matches is disqualified from playoffs. */
export const FORFEIT_LIMIT = 2;

export function isDisqualified(record: { forfeits: number }): boolean {
  return record.forfeits >= FORFEIT_LIMIT;
}

/**
 * Ranked standings for one group of a division. Disqualified teams drop to
 * the bottom of the group, so every eligible team below them moves up.
 */
export function groupStandings(division: DivisionData, group: number): Standing[] {
  const records = computeRecords(division);
  const byRecord = compareStandings(division.matches);
  return [...records.values()]
    .filter((record) => record.group === group)
    .sort((a, b) => Number(isDisqualified(a)) - Number(isDisqualified(b)) || byRecord(a, b))
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

/**
 * One list across all divisions. Higher divisions rank above lower ones;
 * inside a division teams are ordered by match win rate, then match wins,
 * map differential and round differential.
 */
export function nationalRankings(league: League): Standing[] {
  const all: Standing[] = [];
  for (const division of league.divisions) {
    all.push(...computeRecords(division).values());
  }
  const winRate = (s: Standing) => (s.played ? s.matchWins / s.played : 0);
  return all
    .sort(
      (a, b) =>
        a.division - b.division ||
        winRate(b) - winRate(a) ||
        b.matchWins - a.matchWins ||
        b.mapWins - b.mapLosses - (a.mapWins - a.mapLosses) ||
        b.roundWins - b.roundLosses - (a.roundWins - a.roundLosses) ||
        a.teamName.localeCompare(b.teamName),
    )
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

export function findTeam(league: League, teamId: string): { team: Team; division: DivisionData } | null {
  for (const division of league.divisions) {
    const team = division.teams.find((t) => t.id === teamId);
    if (team) return { team, division };
  }
  return null;
}
