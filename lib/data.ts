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
  getDivisionRaw,
  getMatchStats,
  type RawMatchStats,
} from "./faceit";
import { buildDivision, type DivisionData, type League } from "./league";
import { mockLeague, mockMatchStats, mockPlayoffs } from "./mock";
import { buildBracket, emptyBracket, PLAYOFFS, type Bracket } from "./playoffs";
import { aggregatePlayerStats, matchesWithPlayedMaps, slimMatchStats, type DivisionStats } from "./stats";

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
    const divisions: DivisionData[] = await Promise.all(
      DIVISIONS.map(async (info) => {
        const raw = await getDivisionRaw(info);
        return buildDivision(info, raw.matches, raw.subscriptions, raw.extra);
      }),
    );
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

/** How many matches' statistics are fetched and cached together. */
const STATS_CHUNK_SIZE = 20;

/**
 * Statistics for a small batch of finished matches. A finished match never
 * changes, so a batch is kept for a month. Batches are small on purpose: each
 * one finishes in a second or two, which keeps any single cached call short.
 */
async function fetchMatchStatsChunk(matchIds: string[]): Promise<(RawMatchStats | null)[]> {
  // "remote" asks the host (Vercel) to keep these in a shared, durable cache,
  // so a new server instance does not ask FACEIT for every match again.
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 2592000, expire: 31536000 });
  return Promise.all(matchIds.map(async (id) => slimMatchStats(await getMatchStats(id))));
}

/**
 * Season player statistics for one division. This needs one FACEIT request
 * per played match, fetched in batches one after another. Matches are taken
 * oldest first so earlier batches stay the same as the season goes on and
 * only the newest batch has to be fetched again.
 */
async function loadLiveDivisionStats(divisionNumber: number): Promise<StatsResult> {
  try {
    const league = await fetchLiveLeague();
    if (!league.ok) return league;
    const division = league.league.divisions.find((d) => d.division === divisionNumber);
    if (!division) return { ok: false, error: `Division ${divisionNumber} was not found.` };

    const ids = matchesWithPlayedMaps(division)
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0) || a.id.localeCompare(b.id))
      .map((match) => match.id);

    const statsByMatch = new Map<string, RawMatchStats | null>();
    for (let start = 0; start < ids.length; start += STATS_CHUNK_SIZE) {
      const chunk = ids.slice(start, start + STATS_CHUNK_SIZE);
      const responses = await fetchMatchStatsChunk(chunk);
      chunk.forEach((id, i) => statsByMatch.set(id, responses[i]));
    }
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
  return loadLiveDivisionStats(divisionNumber);
}

/* ---------- Playoff brackets ---------- */

export type PlayoffsResult = { ok: true; brackets: Bracket[] } | { ok: false; error: string };

async function fetchLivePlayoffs(): Promise<PlayoffsResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 86400 });

  const brackets: Bracket[] = await Promise.all(
    PLAYOFFS.map(async (info) => {
      // One bracket failing (for example one that is still being set up on
      // FACEIT) must not take the others down with it.
      try {
        const [matches, subscriptions] = await Promise.all([
          getChampionshipMatches(info.championshipId),
          getChampionshipSubscriptions(info.championshipId),
        ]);
        return buildBracket(info, matches, subscriptions);
      } catch (error) {
        return emptyBracket(info, error instanceof Error ? error.message : "Could not read this bracket.");
      }
    }),
  );
  return { ok: true, brackets };
}

export async function getPlayoffs(): Promise<PlayoffsResult> {
  const mode = dataMode();
  if (mode === "missing-key") {
    return { ok: false, error: "FACEIT_API_KEY is not set. Copy env.local.example to .env.local and add your key." };
  }
  if (mode === "mock") return { ok: true, brackets: mockPlayoffs() };
  return fetchLivePlayoffs();
}

/**
 * Player statistics for every division, loaded one division at a time so the
 * divisions do not queue behind each other in the request throttle.
 */
export async function getAllPlayerStats(): Promise<StatsResult[]> {
  const results: StatsResult[] = [];
  for (const info of DIVISIONS) {
    results.push(await getDivisionPlayerStats(info.division));
  }
  return results;
}
