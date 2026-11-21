/**
 * Checks the standings logic against a small hand-made fixture.
 * Run with:  npm run test-league
 */

import assert from "node:assert/strict";
import type { RawMatch } from "../lib/faceit";
import { buildDivision, groupStandings, isDisqualified, nationalRankings } from "../lib/league";
import { mockLeague } from "../lib/mock";
import { bracketLabel, bracketMatches, buildBracket, playoffMatches } from "../lib/playoffs";
import { aggregatePlayerStats, matchesWithPlayedMaps } from "../lib/stats";

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

// A late team plays its matches in separate "extra" championships. Those matches
// join the group of the opponent and take the round of the opponent's bye.
const group2 = (m: RawMatch): RawMatch => ({ ...m, group: 2 });
const lateMain: RawMatch[] = [
  group2(played("e1", "p", "q", [[13, 5], [13, 6]])),
  { ...group2(played("e2", "bye", "p", [[0, 1], [0, 1]])), round: 4 },
  { ...group2(played("e3", "bye", "q", [[0, 1], [0, 1]])), round: 6 },
];
const lateExtra: RawMatch[] = [
  { ...played("e4", "late", "p", [[13, 10], [13, 11]]), group: 1, round: 1 },
  { ...played("e5", "q", "late", [[13, 3], [13, 4]]), group: 1, round: 1 },
];
const lateDivision = buildDivision({ division: 2, name: "Division 2", championshipId: "z" }, lateMain, [], {
  matches: lateExtra,
  subscriptions: [{ group: 1, team: { team_id: "late", name: "LATE", members: [{ user_id: "u1", nickname: "one" }] } }],
});
assert.deepEqual(lateDivision.groups, [2]);
assert.equal(lateDivision.teams.length, 3);
const lateTeam = lateDivision.teams.find((t) => t.id === "late");
assert.equal(lateTeam?.group, 2);
assert.equal(lateTeam?.members.length, 1);
assert.equal(lateDivision.matches.length, 3);
assert.equal(lateDivision.matches.find((m) => m.id === "e4")?.round, 4);
assert.equal(lateDivision.matches.find((m) => m.id === "e5")?.round, 6);
assert.ok(lateDivision.matches.every((m) => m.group === 2));
const lateTable = groupStandings(lateDivision, 2);
assert.equal(lateTable.length, 3);
assert.equal(lateTable.find((row) => row.teamId === "late")?.played, 2);
assert.equal(lateTable.find((row) => row.teamId === "late")?.matchWins, 1);

// Playoff bracket: 8 teams, quarter-finals in a given order, one semi-final played.
const quarter = (id: string, a: string, b: string): RawMatch => ({ ...played(id, a, b, [[13, 5], [13, 6]]), round: 1 });
const bracket = buildBracket(
  {
    championshipId: "po",
    division: 3,
    region: "Test",
    format: "single",
    thirdPlaceMatch: true,
    firstRoundOrder: ["k1", "k2", "k3", "k4"],
  },
  [
    quarter("k3", "t5", "t6"),
    quarter("k1", "t1", "t2"),
    quarter("k4", "t7", "t8"),
    quarter("k2", "t3", "t4"),
    { ...played("k6", "t7", "t5", [[13, 9], [13, 9]]), round: 2 }, // second semi-final, listed first
    { match_id: "k5", round: 2, status: "SCHEDULED", teams: { faction1: team("t1"), faction2: team("t3") } },
    { match_id: "k9", round: 2, status: "SCHEDULED", teams: { faction1: team("t1") } }, // no opponent yet: ignored
  ],
  [],
);
assert.deepEqual(
  bracket.rounds.map((round) => round.name),
  ["Quarter-finals", "Semi-finals", "Grand final"],
);
assert.deepEqual(
  bracket.rounds[0].slots.map((slot) => slot.match?.id),
  ["k1", "k2", "k3", "k4"],
);
assert.deepEqual(
  bracket.rounds[1].slots.map((slot) => slot.match?.id),
  ["k5", "k6"],
);
assert.equal(bracket.rounds[2].slots[0].match, null);
assert.equal(bracket.thirdPlace, null);
assert.equal(bracket.state, "live");
assert.equal(bracket.teams.length, 8);

// With a 3rd place match, FACEIT round 3 is that match and round 4 is the final.
const finished = buildBracket(
  { championshipId: "po2", division: 3, region: "Test", format: "single", thirdPlaceMatch: true },
  [
    quarter("f1", "t1", "t2"),
    quarter("f2", "t3", "t4"),
    quarter("f3", "t5", "t6"),
    quarter("f4", "t7", "t8"),
    { ...played("f5", "t1", "t3", [[13, 9], [13, 9]]), round: 2 },
    { ...played("f6", "t5", "t7", [[13, 9], [13, 9]]), round: 2 },
    { ...played("f7", "t3", "t7", [[13, 9], [13, 9]]), round: 3 },
    { ...played("f8", "t1", "t5", [[13, 9], [13, 9]]), round: 4 },
  ],
  [],
);
assert.equal(finished.thirdPlace?.id, "f7");
assert.equal(finished.rounds[2].slots[0].match?.id, "f8");
assert.equal(finished.state, "finished");

// A bracket with sign-ups but no matches has teams and no rounds.
const undrawn = buildBracket({ championshipId: "po3", division: 2, region: "Test", format: "single", thirdPlaceMatch: true }, [], [
  { team: { team_id: "a", name: "A" } },
]);
assert.equal(undrawn.rounds.length, 0);
assert.equal(undrawn.state, "not-started");
assert.equal(undrawn.teams.length, 1);

// Double elimination: FACEIT group 1 is the upper bracket, 2 the lower bracket, 3 the grand final.
const inGroup = (m: RawMatch, group: number, round: number): RawMatch => ({ ...m, group, round });
const doubleBracket = buildBracket(
  { championshipId: "de", division: 1, region: "", format: "double", firstRoundOrder: ["d1", "d2", "d3", "d4"] },
  [
    inGroup(played("d1", "t1", "t2", [[13, 5], [13, 6]]), 1, 1),
    inGroup(played("d2", "t3", "t4", [[13, 5], [13, 6]]), 1, 1),
    inGroup(played("d3", "t5", "t6", [[13, 5], [13, 6]]), 1, 1),
    inGroup(played("d4", "t7", "t8", [[13, 5], [13, 6]]), 1, 1),
    inGroup(played("d5", "t1", "t3", [[13, 5], [13, 6]]), 1, 2),
    inGroup(played("d6", "t5", "t7", [[13, 5], [13, 6]]), 1, 2),
    inGroup(played("d7", "t1", "t5", [[13, 5], [13, 6]]), 1, 3), // upper final
    inGroup(played("e2", "t6", "t8", [[13, 5], [13, 6]]), 2, 1), // lower round 1, second pair listed first
    inGroup(played("e1", "t2", "t4", [[13, 5], [13, 6]]), 2, 1),
    inGroup(played("e3", "t2", "t7", [[13, 5], [13, 6]]), 2, 2), // t2 (lower) v t7 (upper semi-final loser)
    inGroup(played("e4", "t3", "t6", [[13, 5], [13, 6]]), 2, 2),
    inGroup(played("e5", "t2", "t3", [[13, 5], [13, 6]]), 2, 3),
    inGroup(played("e6", "t5", "t2", [[13, 5], [13, 6]]), 2, 4), // lower final
    inGroup(played("g1", "t1", "t5", [[13, 5], [13, 6]]), 3, 1),
  ],
  [],
);
assert.deepEqual(
  doubleBracket.rounds.map((round) => round.name),
  ["Quarter-finals", "Semi-finals", "Upper final"],
);
assert.equal(doubleBracket.rounds[2].slots[0].match?.id, "d7");
assert.deepEqual(
  doubleBracket.lowerRounds.map((round) => round.slots.map((slot) => slot.match?.id)),
  [["e1", "e2"], ["e3", "e4"], ["e5"], ["e6"]],
);
assert.deepEqual(
  doubleBracket.lowerRounds.map((round) => round.name),
  ["Lower round 1", "Lower round 2", "Lower round 3", "Lower final"],
);
assert.equal(doubleBracket.grandFinal?.id, "g1");
assert.equal(doubleBracket.grandFinalReset, null);
assert.equal(doubleBracket.hasThirdPlace, false);
assert.equal(doubleBracket.state, "finished");
assert.equal(bracketLabel(doubleBracket), "Division 1");
assert.equal(bracketLabel({ division: 2, region: "East" }), "Division 2 East");

// Cancelled matches stay in the bracket with their teams, as on FACEIT, unless they were replayed.
// The first round can be ordered by team name as well as by match id.
const cancelledInfo = {
  championshipId: "pc",
  division: 3,
  region: "Test",
  format: "single" as const,
  thirdPlaceMatch: true,
  firstRoundOrder: ["T3", "c1", "T7", "T6"],
};
const cancelledRaw: RawMatch[] = [
  quarter("c1", "t1", "t2"),
  quarter("c2", "t3", "t4"),
  quarter("c3", "t5", "t6"),
  { match_id: "c4", round: 1, status: "SCHEDULED", teams: { faction1: team("t7"), faction2: team("t8") } },
  { match_id: "c0", round: 1, status: "CANCELLED", teams: { faction1: team("t1"), faction2: team("t2") } }, // replayed as c1
  { match_id: "c5", round: 2, status: "CANCELLED", teams: { faction1: team("t3"), faction2: team("t1") } },
  { match_id: "c5b", round: 2, status: "CANCELLED", teams: { faction1: team("t1"), faction2: team("t3") } }, // same pairing again
  { match_id: "c6", round: 2, status: "CANCELLED", teams: { faction1: team("t8"), faction2: team("t5") } },
];
assert.deepEqual(
  bracketMatches(cancelledInfo, cancelledRaw).map((m) => m.id).sort(),
  ["c1", "c2", "c3", "c4", "c5", "c6"],
);
const withCancelled = buildBracket(cancelledInfo, cancelledRaw, []);
assert.deepEqual(
  withCancelled.rounds[0].slots.map((slot) => slot.match?.id),
  ["c2", "c1", "c4", "c3"],
);
assert.deepEqual(
  withCancelled.rounds[1].slots.map((slot) => [slot.match?.id, slot.match?.status]),
  [["c5", "cancelled"], ["c6", "cancelled"]],
);
assert.equal(withCancelled.state, "live");
assert.equal(playoffMatches(cancelledInfo, cancelledRaw).length, 4); // stats never see a cancelled match

// Player stats count playoff matches together with the regular season.
const bracketInfo = { championshipId: "po", division: 1, region: "", format: "single" as const };
const poMatches = playoffMatches(bracketInfo, [
  played("p1", "a", "c", [[13, 7], [13, 9]]), // played: counted
  played("p2", "b", "d", [[0, 1], [0, 1]]), // forfeit: not counted
  { match_id: "p3", status: "SCHEDULED", teams: { faction1: team("a"), faction2: team("b") } }, // not played yet
  played("p4", "a", "z", [[13, 2]]), // z only exists in the playoffs
  { ...played("p5", "a", "b", [[13, 2]]), status: "CANCELLED" },
]);
assert.equal(poMatches.length, 4); // the cancelled match is dropped
assert.deepEqual(
  matchesWithPlayedMaps(division, poMatches).map((m) => m.id),
  ["m1", "m2", "m3", "p1", "p4"],
);
const mapStats = (rounds: number, teams: [string, number][]) => ({
  round_stats: { Rounds: String(rounds) },
  teams: teams.map(([id, kills]) => ({
    team_id: id,
    players: [{ player_id: `${id}-1`, nickname: `${id}one`, player_stats: { Kills: String(kills), Deaths: "10", ADR: "80" } }],
  })),
});
const statsByMatch = new Map([
  ["m1", { rounds: [mapStats(18, [["a", 20], ["b", 9]]), mapStats(24, [["a", 22], ["b", 18]])] }],
  ["p1", { rounds: [mapStats(20, [["a", 25], ["c", 12]]), mapStats(22, [["a", 15], ["c", 14]])] }],
  ["p4", { rounds: [mapStats(15, [["a", 5], ["z", 3]])] }],
  ["p2", null],
]);
const seasonOnly = aggregatePlayerStats(division, statsByMatch);
const withPlayoffs = aggregatePlayerStats(division, statsByMatch, poMatches);
const line = (stats: typeof withPlayoffs, id: string) => stats.players.find((p) => p.playerId === id);
assert.equal(line(seasonOnly, "a-1")?.kills, 42);
assert.equal(line(seasonOnly, "a-1")?.maps, 2);
assert.equal(seasonOnly.playoffMatchesExpected, 0);
assert.equal(line(withPlayoffs, "a-1")?.kills, 42 + 40 + 5); // one line per player, season and playoffs added up
assert.equal(line(withPlayoffs, "a-1")?.maps, 5);
assert.equal(line(withPlayoffs, "a-1")?.rounds, 18 + 24 + 20 + 22 + 15);
assert.equal(line(withPlayoffs, "c-1")?.kills, 26);
assert.equal(line(withPlayoffs, "z-1")?.teamName, "Z"); // name taken from the playoff match
assert.equal(withPlayoffs.matchesExpected, 5);
assert.equal(withPlayoffs.matchesWithStats, 3);
assert.equal(withPlayoffs.playoffMatchesExpected, 2);
assert.equal(withPlayoffs.mapsCounted, 5);

// The sample league builds and ranks every team exactly once.
const league = mockLeague();
const national = nationalRankings(league);
const teamCount = league.divisions.reduce((sum, d) => sum + d.teams.length, 0);
assert.equal(national.length, teamCount);
assert.equal(new Set(national.map((row) => row.teamId)).size, teamCount);
assert.ok(national.every((row, i) => i === 0 || national[i - 1].division <= row.division));

console.log("All standings checks passed.");
