/**
 * Checks the standings logic against a small hand-made fixture.
 * Run with:  npm run test-league
 */

import assert from "node:assert/strict";
import type { RawMatch } from "../lib/faceit";
import { buildDivision, groupStandings, isDisqualified, nationalRankings } from "../lib/league";
import { mockLeague } from "../lib/mock";

const team = (id: string) => ({ faction_id: id, name: id.toUpperCase() });

function played(id: string, a: string, b: string, maps: [number, number][]): RawMatch {
  const aMaps = maps.filter(([x, y]) => x > y).length;
  const bMaps = maps.length - aMaps;
  return {
    match_id: id,
    group: 1,
    round: 1,
    status: "FINISHED",
    scheduled_at: 1790000000,
    teams: { faction1: team(a), faction2: team(b) },
    results: { winner: aMaps > bMaps ? "faction1" : "faction2", score: { faction1: aMaps, faction2: bMaps } },
    detailed_results: maps.map(([x, y]) => ({
      winner: x > y ? "faction1" : "faction2",
      factions: { faction1: { score: x }, faction2: { score: y } },
    })),
  };
}

const matches: RawMatch[] = [
  played("m1", "a", "b", [[13, 5], [13, 11]]), // a beats b 2-0
  played("m2", "b", "c", [[13, 8], [9, 13], [13, 10]]), // b beats c 2-1
  played("m3", "c", "a", [[13, 11], [13, 9]]), // c beats a 2-0
  played("m4", "d", "a", [[0, 1], [0, 1]]), // d forfeits to a
  played("m6", "bye", "b", [[0, 1], [0, 1]]), // placeholder match, must be ignored
  { match_id: "m5", group: 1, status: "SCHEDULED", teams: { faction1: team("b"), faction2: team("d") } },
];

const division = buildDivision({ division: 1, name: "Division 1", championshipId: "x" }, matches, []);
const table = groupStandings(division, 1);
const byId = Object.fromEntries(table.map((row) => [row.teamId, row]));

assert.equal(division.teams.length, 4); // the "bye" placeholder is not a team
assert.equal(division.matches.length, 5);
assert.equal(byId.b.played, 2);
assert.deepEqual(division.groups, [1]);

// a: wins vs b and d (forfeit), loss vs c.
assert.equal(byId.a.matchWins, 2);
assert.equal(byId.a.matchLosses, 1);
assert.equal(byId.a.mapWins, 4);
assert.equal(byId.a.mapLosses, 2);
// Forfeited maps add no rounds: 26 from m1 + 20 from m3.
assert.equal(byId.a.roundWins, 46);
assert.equal(byId.a.roundLosses, 16 + 26);

// d: one forfeited match, no rounds, the scheduled match is not counted.
assert.equal(byId.d.played, 1);
assert.equal(byId.d.forfeits, 1);
assert.equal(byId.d.roundWins + byId.d.roundLosses, 0);
assert.equal(byId.a.forfeits, 0);

// a has the most match wins; d is last.
assert.equal(table[0].teamId, "a");
assert.equal(table[3].teamId, "d");
// b and c both have 1 win; c has the better map differential (3-2 vs 2-3... c: +1, b: -1).
assert.equal(table[1].teamId, "c");
assert.equal(table[2].teamId, "b");

// A team with 2 forfeits is disqualified: it drops to the bottom and the others move up.
const dqMatches: RawMatch[] = [
  played("q1", "w", "x", [[13, 2], [13, 3]]), // w beats x
  played("q2", "w", "y", [[13, 4], [13, 5]]), // w beats y
  played("q3", "w", "z", [[13, 6], [13, 7]]), // w beats z, so w has the best record
  played("q4", "x", "w", [[1, 0], [1, 0]]), // w forfeits to x
  played("q5", "y", "w", [[1, 0], [1, 0]]), // w forfeits to y
  played("q6", "x", "y", [[13, 9], [13, 9]]), // x beats y
  played("q7", "z", "x", [[0, 1], [0, 1]]), // z forfeits once: still eligible
];
const dqTable = groupStandings(buildDivision({ division: 2, name: "Division 2", championshipId: "y" }, dqMatches, []), 1);
assert.deepEqual(
  dqTable.map((row) => row.teamId),
  ["x", "y", "z", "w"],
);
assert.deepEqual(
  dqTable.map((row) => isDisqualified(row)),
  [false, false, false, true],
);
assert.equal(dqTable[3].matchWins, 3); // w keeps its record, it is only moved down
assert.deepEqual(
  dqTable.map((row) => row.rank),
  [1, 2, 3, 4],
);

// The sample league builds and ranks every team exactly once.
const league = mockLeague();
const national = nationalRankings(league);
const teamCount = league.divisions.reduce((sum, d) => sum + d.teams.length, 0);
assert.equal(national.length, teamCount);
assert.equal(new Set(national.map((row) => row.teamId)).size, teamCount);
assert.ok(national.every((row, i) => i === 0 || national[i - 1].division <= row.division));

console.log("All standings checks passed.");
