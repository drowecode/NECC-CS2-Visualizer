/**
 * FACEIT Data API v4 client (server-side only).
 *
 * Reference: https://docs.faceit.com/api/data
 * The API key is read from FACEIT_API_KEY and must never reach the browser,
 * so only import this file from server code (server components, scripts).
 *
 * This file has no Next.js imports on purpose, so `npm run check-data`
 * can use it from plain Node.
 */

// FACEIT_API_BASE is only for pointing tests at a local stand-in server.
const BASE_URL = process.env.FACEIT_API_BASE?.trim() || "https://open.faceit.com/data/v4";

/** The four NECC Fall 2026 CS2 championships. */
export const DIVISIONS = [
  { division: 1, name: "Division 1", championshipId: "e2497840-ac7a-46f3-bfc7-82f13bfbf9c4" },
  { division: 2, name: "Division 2", championshipId: "e1c831e0-0be2-4d12-acf4-a621453e881f" },
  { division: 3, name: "Division 3", championshipId: "74a64284-61ba-4de5-a47c-d4475dd4ea53" },
  { division: 4, name: "Division 4", championshipId: "c7ba4f3b-ca6b-47f3-9f3f-34e6b343108f" },
] as const;

/* ---------- Raw response types (only the fields this site uses) ---------- */

export type RawPlayer = {
  player_id?: string;
  nickname?: string;
  avatar?: string;
  game_skill_level?: number;
};

export type RawFaction = {
  faction_id?: string;
  name?: string;
  avatar?: string;
  roster?: RawPlayer[];
};

export type RawMatch = {
  match_id: string;
  competition_id?: string;
  group?: number;
  round?: number;
  best_of?: number;
  status?: string;
  scheduled_at?: number;
  started_at?: number;
  finished_at?: number;
  faceit_url?: string;
  teams?: Record<string, RawFaction>;
  results?: { winner?: string; score?: Record<string, number> };
  detailed_results?: {
    winner?: string;
    factions?: Record<string, { score?: number }>;
  }[];
};

export type RawSubscription = {
  group?: number;
  status?: string;
  team?: {
    team_id?: string;
    name?: string;
    nickname?: string;
    avatar?: string;
    members?: {
      user_id?: string;
      nickname?: string;
      avatar?: string;
      country?: string;
      skill_level?: number;
    }[];
  };
};

type Page<T> = { items?: T[]; start?: number; end?: number };

/* ---------- Request helper: throttled, retries on 429 and 5xx ---------- */

export class FaceitError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "FaceitError";
  }
}

const MIN_GAP_MS = 70; // requests start at most about 14 times per second
const MAX_ATTEMPTS = 5;

let nextSlot = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Spaces out request start times. Each caller reserves the next free time
 * slot and waits for it, so many requests can be in flight at once without
 * ever starting faster than one per MIN_GAP_MS.
 */
async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_GAP_MS;
  if (slot > now) await sleep(slot - now);
}

export function hasApiKey(): boolean {
  return Boolean(process.env.FACEIT_API_KEY?.trim());
}

async function request<T>(path: string): Promise<T> {
  const key = process.env.FACEIT_API_KEY?.trim();
  if (!key) {
    throw new FaceitError("FACEIT_API_KEY is not set. Add it to .env.local.");
  }

  let lastError: FaceitError | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await waitForSlot();
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
      });

      if (response.ok) return (await response.json()) as T;

      if (response.status === 401 || response.status === 403) {
        throw new FaceitError(
          `FACEIT rejected the API key (HTTP ${response.status}). Check FACEIT_API_KEY.`,
          response.status,
        );
      }
      if (response.status === 404) {
        throw new FaceitError(`Not found: ${path}`, 404);
      }

      lastError = new FaceitError(`FACEIT returned HTTP ${response.status} for ${path}`, response.status);
      if (response.status !== 429 && response.status < 500) throw lastError;
    } catch (error) {
      if (error instanceof FaceitError) {
        const retryable = error.status === 429 || (error.status ?? 0) >= 500;
        if (!retryable) throw error;
        lastError = error;
      } else {
        lastError = new FaceitError(`Network error calling FACEIT: ${(error as Error).message}`);
      }
    }
    // Back off: 1s, 2s, 4s, 8s.
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
  }
  throw lastError ?? new FaceitError(`Request failed: ${path}`);
}

async function fetchAllPages<T>(path: string, limit: number): Promise<T[]> {
  const all: T[] = [];
  const joiner = path.includes("?") ? "&" : "?";
  for (let offset = 0; offset < 5000; offset += limit) {
    const page = await request<Page<T>>(`${path}${joiner}offset=${offset}&limit=${limit}`);
    const items = page.items ?? [];
    all.push(...items);
    if (items.length < limit) break;
  }
  return all;
}

/* ---------- Endpoints ---------- */

/** Every match of a championship: past, ongoing and upcoming. */
export function getChampionshipMatches(championshipId: string): Promise<RawMatch[]> {
  return fetchAllPages<RawMatch>(`/championships/${championshipId}/matches?type=all`, 100);
}

/** Every team signed up to a championship, with its group and members. */
export function getChampionshipSubscriptions(championshipId: string): Promise<RawSubscription[]> {
  // This endpoint allows at most 10 items per page.
  return fetchAllPages<RawSubscription>(`/championships/${championshipId}/subscriptions`, 10);
}

/* ---------- Match statistics ---------- */

export type RawStatsPlayer = {
  player_id?: string;
  nickname?: string;
  player_stats?: Record<string, string | number>;
};

export type RawStatsTeam = {
  team_id?: string;
  team_stats?: Record<string, string | number>;
  players?: RawStatsPlayer[];
};

/** One entry per map played. */
export type RawStatsRound = {
  match_id?: string;
  match_round?: string | number;
  round_stats?: Record<string, string | number>;
  teams?: RawStatsTeam[];
};

export type RawMatchStats = { rounds?: RawStatsRound[] };

/**
 * Per-map team and player statistics for one finished match.
 * Returns null when FACEIT has no statistics for it (for example a forfeit).
 */
export async function getMatchStats(matchId: string): Promise<RawMatchStats | null> {
  try {
    return await request<RawMatchStats>(`/matches/${matchId}/stats`);
  } catch (error) {
    if (error instanceof FaceitError && error.status === 404) return null;
    throw error;
  }
}
