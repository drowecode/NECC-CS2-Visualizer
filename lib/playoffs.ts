/**
 * Playoff brackets. Each bracket is its own FACEIT championship, either
 * single elimination (with a 3rd place match) or double elimination.
 * Pure functions, no network and no Next.js imports.
 */

import type { RawMatch, RawSubscription } from "./faceit";
import { normaliseMatch, type Match } from "./league";

export type PlayoffInfo = {
  championshipId: string;
  division: number;
  /** Region name, or "" when the division has a single bracket. */
  region: string;
  /**
   * "single": single elimination. "double": upper bracket, lower bracket and
   * grand final, which FACEIT stores as groups 1, 2 and 3 of the championship.
   */
  format: "single" | "double";
  /** Single elimination only: FACEIT plays a 3rd place match in the round before the final. */
  thirdPlaceMatch?: boolean;
  /**
   * First-round match ids in bracket order, top to bottom. The Data API does
   * not say where a match sits in the bracket, so without this the first
   * round is shown in the order FACEIT returns it.
   */
  firstRoundOrder?: string[];
};

/** The NECC Fall 2026 CS2 playoff brackets. */
export const PLAYOFFS: PlayoffInfo[] = [
  {
    championshipId: "93d8fad8-3fda-4fab-a381-ba9d94fe549c",
    division: 1,
    region: "",
    format: "double",
    firstRoundOrder: [
      "1-29a5cd37-a534-4c1e-9200-d1afe04ceec4", // ITE Scarlet v CU Ravens
      "1-6ddf2f0a-8b76-4a99-96c8-937689a51e64", // Fisher CSTwo College v RIT Orange
      "1-76d74415-768f-44a7-8aef-1e03284c2956", // Fisher College v BGC Scarlet
      "1-aa9041e0-7510-4902-b33e-16e34f44217e", // SFU Apollo v Northwood
    ],
  },
  {
    championshipId: "43d591be-3483-40ec-a1b0-827f462863d1",
    division: 2,
    region: "East",
    format: "double",
    firstRoundOrder: [
      "1-9e8d187d-6ea8-4332-bd41-a25060e8c0c6", // UNC v NEU-Black
      "1-2d884a59-da5e-4d41-adbd-aa160b66bf20", // Fuel Esports v Seneca Polytech
      "1-9f76f364-dbab-44a1-b4e9-2fef6f46f9bc", // UCF Knights v UAlbany Gold
      "1-70328828-80bb-4e2a-a6bb-6592c738142d", // Boston University v WPI GOATS
    ],
  },
  {
    championshipId: "476f1560-3cf8-4d06-a921-f810374504d4",
    division: 2,
    region: "West Central",
    format: "double",
    firstRoundOrder: [
      "1-b20228d8-53f4-48b6-8f60-1bab02423fe9", // UH Red v Idaho Vandal Esports
      "1-2b5c1ea3-838c-436a-9146-a4b68b546ff7", // K-State Varsity v Bronco Esports Black
      "1-8e727326-933a-4716-a947-0d7ef9f8dbf9", // Esports LSU v Texas_Tech_CS2_Program
      "1-3a602c34-bdef-4196-8879-b1a917865284", // UCSC v OU CS2
    ],
  },
  {
    championshipId: "f88aa698-c9ed-4428-af11-58feeea88cc8",
    division: 3,
    region: "East",
    format: "single",
    thirdPlaceMatch: true,
  },
  {
    championshipId: "c9d8aa3a-edb5-43cb-b7e7-65a5b14f413f",
    division: 3,
    region: "Central",
    format: "single",
    thirdPlaceMatch: true,
    firstRoundOrder: [
      "1-3845e469-1849-41ab-a795-f36cf5c15e72", // ISU Redbirds Varsity v ITE White
      "1-c20fc099-69f1-4c5a-a636-1c96d8a4d614", // AWPE Black v MSU MAROON
      "1-392b117f-91f2-4da2-acfe-401ed5457a5a", // UTD Comets v GVSU CS2 BLUE
      "1-c95b100d-a5ae-4ec5-974a-e2eda8de1233", // Kennesaw State Black 2025 v Niner Gold
    ],
  },
  {
    championshipId: "b2a31237-d19d-423f-806e-1d1c9e160af1",
    division: 3,
    region: "West",
    format: "single",
    thirdPlaceMatch: true,
    firstRoundOrder: [
      "1-77b9291a-506a-427b-927e-6bf7a504ff0e", // Colorado School of Mines v Colorado State
      "1-eb1b50f1-161f-4cbd-afde-257cf1b633bd", // UNM Cherry v CSUDH Viridian
      "1-eb76b513-7fd0-439c-87d0-59667dd21b09", // UABESA CS2 Gold v CSUSB
      "1-e53a3b3c-a526-4820-86a1-c0cfcc818bdc", // UAHChargerWhite v WashU CS
    ],
  },
  {
    championshipId: "70e3066f-75c9-41cf-a10a-7008c462121c",
    division: 4,
    region: "Central",
    format: "single",
    thirdPlaceMatch: true,
    firstRoundOrder: [
      "1-26b2683f-e614-4b63-99c3-e33a6a22e675", // University of Arkansas v Dakota State CS2
      "1-9829c7ab-e0fd-41e3-8c2e-8b710fad2a87", // NMSU White v UND Black
      "1-eff81de7-3de7-4a8a-ae24-ee7066dfa49d", // NMSU Crimson v UNM Silver
      "1-72a241ae-c7f0-48d7-a6b4-6cbc521ec8f5", // Kettering University v UNCA Bulldogs
    ],
  },
  {
    championshipId: "82d4fedc-b99f-46bd-8087-1799c0a46b15",
    division: 4,
    region: "East",
    format: "single",
    thirdPlaceMatch: true,
    firstRoundOrder: [
      "1-b71d8b3a-d120-40c7-90c7-ebca3c651d7e", // Champlain CS2 v AWPE Gold
      "1-d9665c06-f467-4137-b5f5-9c7c8c9a46dc", // UdeS esports v Clemson Tigers
      "1-c446b69b-05be-449c-82db-144e08aef04f", // NEIT Tigers v Wolfpack Esports
      "1-c906a5f2-d416-446a-9c89-b863d7e719d0", // WM Esports v ninerwhite
    ],
  },
];

export type BracketTeam = { id: string; name: string; avatar: string | null };

/** One position in the bracket. `match` is null until FACEIT creates the match. */
export type BracketSlot = { key: string; match: Match | null };

export type BracketRound = { name: string; slots: BracketSlot[] };

export type BracketState = "not-started" | "upcoming" | "live" | "finished";

export type Bracket = {
  championshipId: string;
  division: number;
  region: string;
  format: "single" | "double";
  url: string;
  state: BracketState;
  /** Start time of the earliest match, in ms. */
  firstMatchAt: number | null;
  teams: BracketTeam[];
  /** The bracket itself (the upper bracket in double elimination). Empty until it is drawn on FACEIT. */
  rounds: BracketRound[];
  /** Single elimination only. */
  hasThirdPlace: boolean;
  thirdPlace: Match | null;
  /** Double elimination only. */
  lowerRounds: BracketRound[];
  grandFinal: Match | null;
  /** The second grand final, played only if the lower-bracket team wins the first. */
  grandFinalReset: Match | null;
  /** Set when FACEIT could not be read for this bracket. */
  error?: string;
};

const FACTIONS = ["faction1", "faction2"] as const;
const UPPER_GROUP = 1;
const LOWER_GROUP = 2;
const FINAL_GROUP = 3;

/** "Division 2 East", or just "Division 1" when the division has one bracket. */
export function bracketLabel(bracket: { division: number; region: string }): string {
  return `Division ${bracket.division}${bracket.region ? ` ${bracket.region}` : ""}`;
}

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

function upperRoundName(slotCount: number, index: number, format: "single" | "double"): string {
  if (slotCount === 1) return format === "double" ? "Upper final" : "Grand final";
  if (slotCount === 2) return "Semi-finals";
  if (slotCount === 4) return "Quarter-finals";
  return `Round ${index + 1}`;
}

export function emptyBracket(info: PlayoffInfo, error?: string): Bracket {
  return {
    championshipId: info.championshipId,
    division: info.division,
    region: info.region,
    format: info.format,
    url: `https://www.faceit.com/en/championship/${info.championshipId}`,
    state: "not-started",
    firstMatchAt: null,
    teams: [],
    rounds: [],
    hasThirdPlace: info.format === "single" && Boolean(info.thirdPlaceMatch),
    thirdPlace: null,
    lowerRounds: [],
    grandFinal: null,
    grandFinalReset: null,
    error,
  };
}

function groupByRound(matches: Match[]): Map<number, Match[]> {
  const byRound = new Map<number, Match[]>();
  for (const match of matches) {
    const round = match.round ?? 1;
    byRound.set(round, [...(byRound.get(round) ?? []), match]);
  }
  return byRound;
}

/**
 * Puts each round's matches into bracket positions. `slotCounts` gives the
 * number of positions per round. A match goes in the position whose earlier
 * matches contain one of its teams; anything left over fills the gaps in
 * the order FACEIT returned it.
 *
 * `seed` gives, for the first round only, the teams that can reach each slot
 * (used by the lower bracket, which is fed by upper-bracket losers).
 */
function placeRounds(
  slotCounts: number[],
  matchesFor: (index: number) => Match[],
  names: (slotCount: number, index: number) => string,
  keyPrefix: string,
  seed?: Set<string>[],
): BracketRound[] {
  const rounds: BracketRound[] = [];
  let previous: Set<string>[] = seed ?? [];

  slotCounts.forEach((slotCount, index) => {
    const available = [...matchesFor(index)];
    const placed: (Match | null)[] = Array.from({ length: slotCount }, () => null);
    const reach: Set<string>[] = [];
    const halves = previous.length === slotCount * 2;

    for (let slot = 0; slot < slotCount; slot++) {
      const reachable = new Set<string>(
        halves ? [...(previous[slot * 2] ?? []), ...(previous[slot * 2 + 1] ?? [])] : [...(previous[slot] ?? [])],
      );
      const usePrevious = index > 0 || seed !== undefined;
      if (usePrevious) {
        const found = available.findIndex((m) => m.teamIds.some((id) => reachable.has(id)));
        if (found !== -1) placed[slot] = available.splice(found, 1)[0];
      } else {
        placed[slot] = available.shift() ?? null; // first round: already in bracket order
      }
      reach.push(reachable);
    }

    // Matches that could not be tied to a position take the empty ones in order.
    for (let slot = 0; slot < slotCount && available.length > 0; slot++) {
      if (!placed[slot]) placed[slot] = available.shift() ?? null;
    }

    placed.forEach((match, slot) => {
      if (match) for (const id of match.teamIds) reach[slot].add(id);
    });

    rounds.push({
      name: names(slotCount, index),
      slots: placed.map((match, slot) => ({ key: `${keyPrefix}${index}-${slot}`, match })),
    });
    previous = reach;
  });

  return rounds;
}

export function buildBracket(info: PlayoffInfo, rawMatches: RawMatch[], rawSubscriptions: RawSubscription[]): Bracket {
  const bracket = emptyBracket(info);

  // Teams: everyone signed up, plus anyone who appears in a match.
  const teams = new Map<string, BracketTeam>();
  for (const sub of rawSubscriptions) {
    const id = sub.team?.team_id;
    if (id) teams.set(id, { id, name: sub.team?.name ?? "Unknown team", avatar: sub.team?.avatar || null });
  }
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
        });
      } else if (!existing.avatar && faction.avatar) {
        existing.avatar = faction.avatar;
      }
    }
  }
  bracket.teams = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Only matches with both teams known can be placed.
  const matches = rawMatches
    .map((raw) => normaliseMatch(raw, info.division))
    .filter((m): m is Match => m !== null && m.status !== "cancelled");
  if (matches.length === 0) return bracket;

  const double = info.format === "double";
  const inGroup = (group: number) => matches.filter((m) => (m.group ?? UPPER_GROUP) === group);
  const upper = groupByRound(double ? inGroup(UPPER_GROUP) : matches);

  // First round, in bracket order when we know it.
  const order = info.firstRoundOrder ?? [];
  const position = (m: Match) => {
    const index = order.indexOf(m.id);
    return index === -1 ? order.length : index;
  };
  const firstRound = [...(upper.get(1) ?? [])].sort(
    (a, b) => position(a) - position(b) || (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0),
  );

  const size = Math.max(2, nextPowerOfTwo(firstRound.length * 2), nextPowerOfTwo(teams.size));
  const roundCount = Math.log2(size); // 8 teams: quarter-finals, semi-finals, final
  const hasThirdPlace = bracket.hasThirdPlace && size >= 4;

  // FACEIT numbers the rounds 1, 2, ... and, when there is a 3rd place match,
  // gives it the number the final would have had and pushes the final one later.
  const faceitRound = (index: number) => (index === roundCount - 1 && hasThirdPlace ? roundCount + 1 : index + 1);

  bracket.rounds = placeRounds(
    Array.from({ length: roundCount }, (_, index) => size / 2 ** (index + 1)),
    (index) => (index === 0 ? firstRound : (upper.get(faceitRound(index)) ?? [])),
    (slotCount, index) => upperRoundName(slotCount, index, info.format),
    "u",
  );
  bracket.hasThirdPlace = hasThirdPlace;
  bracket.thirdPlace = hasThirdPlace ? (upper.get(roundCount)?.[0] ?? null) : null;

  if (double && size >= 4) {
    // Lower bracket: rounds come in pairs with the same number of matches.
    // 8 teams: 2, 2, 1, 1. The first round is played by upper first-round losers.
    const lower = groupByRound(inGroup(LOWER_GROUP));
    const lowerCounts: number[] = [];
    for (let count = size / 4; count >= 1; count /= 2) lowerCounts.push(count, count);

    const firstSlots = bracket.rounds[0]?.slots ?? [];
    const seed = Array.from({ length: lowerCounts[0] }, (_, slot) => {
      const ids = new Set<string>();
      for (const feeder of [firstSlots[slot * 2], firstSlots[slot * 2 + 1]]) {
        for (const id of feeder?.match?.teamIds ?? []) ids.add(id);
      }
      return ids;
    });

    bracket.lowerRounds = placeRounds(
      lowerCounts,
      (index) => lower.get(index + 1) ?? [],
      (_, index) => (index === lowerCounts.length - 1 ? "Lower final" : `Lower round ${index + 1}`),
      "l",
      seed,
    );

    const finals = groupByRound(inGroup(FINAL_GROUP));
    bracket.grandFinal = finals.get(1)?.[0] ?? null;
    bracket.grandFinalReset = finals.get(2)?.[0] ?? null;
  }

  const times = matches.map((m) => m.scheduledAt).filter((t): t is number => t !== null);
  bracket.firstMatchAt = times.length ? Math.min(...times) : null;

  const last = double ? (bracket.grandFinalReset ?? bracket.grandFinal) : bracket.rounds.at(-1)?.slots[0]?.match;
  if (last?.status === "finished") bracket.state = "finished";
  else if (matches.some((m) => m.status === "finished" || m.status === "ongoing")) bracket.state = "live";
  else bracket.state = "upcoming";

  return bracket;
}
