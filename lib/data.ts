/**
 * Cached data access for pages. Server-side only.
 *
 * The whole league (four championships) is fetched once and reused by every
 * page, then refreshed in the background at most every 10 minutes, so the
 * site stays well inside FACEIT's rate limits no matter how many visitors
 * it gets.
 */

import { cacheLife } from "next/cache";
import {
  DIVISIONS,
  getChampionshipMatches,
  getChampionshipSubscriptions,
  getMatchStats,
  type RawMatchStats,
} from "./faceit";
import { buildDivision, type DivisionData, type League } from "./league";
import { mockLeague, mockMatchStats } from "./mock";
import { aggregatePlayerStats, matchesWithPlayedMaps, type DivisionStats } from "./stats";

export type LeagueResult = { ok: true; league: League } | { ok: false; error: string };

export type DataMode = "live" | "mock" | "missing-key";

/** FACEIT_API_KEY=mock shows generated sample data, for previewing the UI. */
export function dataMode(): DataMode {
  const key = process.env.FACEIT_API_KEY?.trim();
  if (!key) return "missing-key";
  if (key.toLowerCase() === "mock") return "mock";
  return "live";
}

async function fetchLiveLeague(): Promise<LeagueResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 86400 });

  try {
    const divisions: DivisionData[] = [];
    for (const info of DIVISIONS) {
      const matches = await getChampionshipMatches(info.championshipId);
      const subscriptions = await getChampionshipSubscriptions(info.championshipId);
      divisions.push(buildDivision(info, matches, subscriptions));
    }
    return { ok: true, league: { fetchedAt: Date.now(), divisions } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error loading FACEIT data." };
  }
}

export async function getLeague(): Promise<LeagueResult> {
  const mode = dataMode();
  if (mode === "missing-key") {
    return { ok: false, error: "FACEIT_API_KEY is not set. Copy env.local.example to .env.local and add your key." };
  }
  if (mode === "mock") return { ok: true, league: mockLeague() };
  return fetchLiveLeague();
}

/* ---------- Player statistics ---------- */

export type StatsResult = { ok: true; stats: DivisionStats } | { ok: false; error: string };

/**
 * Season player statistics for one division. This needs one FACEIT request
 * per played match, so each division is cached on its own and refreshed at
 * most once an hour.
 */
async function fetchLiveDivisionStats(divisionNumber: number): Promise<StatsResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 604800 });

  try {
    const league = await fetchLiveLeague();
    if (!league.ok) return league;
    const division = league.league.divisions.find((d) => d.division === divisionNumber);
    if (!division) return { ok: false, error: `Division ${divisionNumber} was not found.` };

    const matches = matchesWithPlayedMaps(division);
    const responses = await Promise.all(matches.map((match) => getMatchStats(match.id)));
    const statsByMatch = new Map<string, RawMatchStats | null>(matches.map((match, i) => [match.id, responses[i]]));
    return { ok: true, stats: aggregatePlayerStats(division, statsByMatch) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error loading player stats." };
  }
}

export async function getDivisionPlayerStats(divisionNumber: number): Promise<StatsResult> {
  const mode = dataMode();
  if (mode === "missing-key") {
    return { ok: false, error: "FACEIT_API_KEY is not set. Copy env.local.example to .env.local and add your key." };
  }
  if (mode === "mock") {
    const division = mockLeague().divisions.find((d) => d.division === divisionNumber);
    if (!division) return { ok: false, error: `Division ${divisionNumber} was not found.` };
    return { ok: true, stats: aggregatePlayerStats(division, mockMatchStats(division)) };
  }
  return fetchLiveDivisionStats(divisionNumber);
}
