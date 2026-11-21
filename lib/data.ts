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
import { buildDivision, type DivisionData, type League, type Match } from "./league";
import { mockLeague, mockMatchStats, mockPlayoffs } from "./mock";
import { buildBracket, emptyBracket, playoffMatches, PLAYOFFS, type Bracket } from "./playoffs";
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
 * A match that finished this recently is asked for again on every refresh.
 * FACEIT can take a while to publish a match's statistics after it ends, and
 * a result can still be corrected by an admin, so a first answer of "no
 * statistics" must not be kept.
 */
const RECENT_MATCH_MS = 24 * 60 * 60 * 1000;

/**
 * Statistics for a small batch of finished matches. An old finished match
 * never changes, so its batch is kept for a month. A batch holding a recently
 * finished match (`recent`) is refreshed every 10 minutes instead. Batches
 * are small on purpose: each one finishes in a second or two, which keeps any
 * single cached call short.
 */
async function fetchMatchStatsChunk(matchIds: string[], recent: boolean): Promise<(RawMatchStats | null)[]> {
  // "remote" asks the host (Vercel) to keep these in a shared, durable cache,
  // so a new server instance does not ask FACEIT for every match again.
  "use cache: remote";
  if (recent) cacheLife({ stale: 300, revalidate: 600, expire: 86400 });
  else cacheLife({ stale: 300, revalidate: 2592000, expire: 31536000 });
  return Promise.all(matchIds.map(async (id) => slimMatchStats(await getMatchStats(id))));
}

/**
 * Every playoff match of one division, from all of its brackets. Refreshed on
 * the same 10 minute cycle as the league, so each round's matches are picked
 * up as they finish, through to the finals.
 */
async function fetchLivePlayoffMatches(divisionNumber: number): Promise<Match[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 86400 });

  const perBracket = await Promise.all(
    PLAYOFFS.filter((info) => info.division === divisionNumber).map(async (info) => {
      // A bracket that cannot be read is left out until the next refresh,
      // so the rest of the statistics still load.
      try {
        return playoffMatches(info, await getChampionshipMatches(info.championshipId));
      } catch {
        return [];
      }
    }),
  );
  return perBracket.flat();
}

/**
 * Season player statistics for one division, regular season and playoffs
 * together. This needs one FACEIT request per played match, fetched in
 * batches one after another. Matches are taken oldest first so earlier
 * batches stay the same as the season goes on and only the newest batch has
 * to be fetched again.
 */
async function loadLiveDivisionStats(divisionNumber: number): Promise<StatsResult> {
  try {
    const league = await fetchLiveLeague();
    if (!league.ok) return league;
    const division = league.league.divisions.find((d) => d.division === divisionNumber);
    if (!division) return { ok: false, error: `Division ${divisionNumber} was not found.` };

    const playoffs = await fetchLivePlayoffMatches(divisionNumber);
    const matches = matchesWithPlayedMaps(division, playoffs).sort(
      (a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0) || a.id.localeCompare(b.id),
    );
    // Measured from the league's own fetch time, not the clock, so the answer
    // only changes when the league data does.
    const recentAfter = league.league.fetchedAt - RECENT_MATCH_MS;

    const statsByMatch = new Map<string, RawMatchStats | null>();
    for (let start = 0; start < matches.length; start += STATS_CHUNK_SIZE) {
      const chunk = matches.slice(start, start + STATS_CHUNK_SIZE);
      const recent = chunk.some((match) => match.finishedAt === null || match.finishedAt >= recentAfter);
      const responses = await fetchMatchStatsChunk(
        chunk.map((match) => match.id),
        recent,
      );
      chunk.forEach((match, i) => statsByMatch.set(match.id, responses[i]));
    }
    return { ok: true, stats: aggregatePlayerStats(division, statsByMatch, playoffs) };
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
