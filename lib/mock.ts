/**
 * Generated sample data, used only when FACEIT_API_KEY=mock.
 * Lets you preview the pages before you have a real API key.
 * The team names and results are invented and are not real NECC data.
 */

import type { RawMatch, RawMatchStats, RawSubscription } from "./faceit";
import { buildDivision, type DivisionData, type League } from "./league";
import { matchesWithPlayedMaps } from "./stats";

const SHAPE = [
  { division: 1, name: "Division 1", groups: 2, perGroup: 8 },
  { division: 2, name: "Division 2", groups: 4, perGroup: 7 },
  { division: 3, name: "Division 3", groups: 6, perGroup: 7 },
  { division: 4, name: "Division 4", groups: 4, perGroup: 7 },
];

/** Small deterministic random generator, so the sample data never changes. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function mockLeague(): League {
  const random = seeded(2026);
  const start = Date.UTC(2026, 8, 30, 23) / 1000;

  const divisions = SHAPE.map((shape) => {
    const subscriptions: RawSubscription[] = [];
    const matches: RawMatch[] = [];

    for (let group = 1; group <= shape.groups; group++) {
      const teams = Array.from({ length: shape.perGroup }, (_, i) => ({
        id: `mock-d${shape.division}-g${group}-t${i + 1}`,
        name: `Sample Team ${shape.division}${String.fromCharCode(64 + group)}${i + 1}`,
        strength: random(),
      }));

      for (const team of teams) {
        subscriptions.push({
          group,
          team: {
            team_id: team.id,
            name: team.name,
            members: Array.from({ length: 5 }, (_, p) => ({
              user_id: `${team.id}-p${p + 1}`,
              nickname: `player${p + 1}`,
            })),
          },
        });
      }

      let round = 0;
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          round = (round % 7) + 1;
          const id = `mock-${shape.division}-${group}-${i}-${j}`;
          const scheduled = start + (round - 1) * 7 * 86400;
          const base: RawMatch = {
            match_id: id,
            group,
            round,
            best_of: 3,
            scheduled_at: scheduled,
            teams: {
              faction1: { faction_id: teams[i].id, name: teams[i].name },
              faction2: { faction_id: teams[j].id, name: teams[j].name },
            },
          };

          if (round > 6) {
            matches.push({ ...base, status: "SCHEDULED" });
            continue;
          }

          const firstIsBetter = teams[i].strength + (random() - 0.5) * 0.6 > teams[j].strength;
          const winner = firstIsBetter ? "faction1" : "faction2";
          const loser = firstIsBetter ? "faction2" : "faction1";

          if (random() < 0.08) {
            // Forfeit: recorded as 1-0 on two maps.
            const map = { winner, factions: { [winner]: { score: 1 }, [loser]: { score: 0 } } };
            matches.push({
              ...base,
              status: "FINISHED",
              finished_at: scheduled + 600,
              results: { winner, score: { [winner]: 2, [loser]: 0 } },
              detailed_results: [map, map],
            });
            continue;
          }

          const threeMaps = random() < 0.4;
          const mapWinners = threeMaps ? [winner, loser, winner] : [winner, winner];
          matches.push({
            ...base,
            status: "FINISHED",
            finished_at: scheduled + 7200,
            results: { winner, score: { [winner]: 2, [loser]: threeMaps ? 1 : 0 } },
            detailed_results: mapWinners.map((mapWinner) => {
              const mapLoser = mapWinner === "faction1" ? "faction2" : "faction1";
              return {
                winner: mapWinner,
                factions: { [mapWinner]: { score: 13 }, [mapLoser]: { score: Math.floor(random() * 12) } },
              };
            }),
          });
        }
      }
    }

    return buildDivision(
      { division: shape.division, name: shape.name, championshipId: `mock-${shape.division}` },
      matches,
      subscriptions,
    );
  });

  return { fetchedAt: Date.UTC(2026, 10, 12), divisions };
}

/** Invented per-map statistics for every played sample match in a division. */
export function mockMatchStats(division: DivisionData): Map<string, RawMatchStats | null> {
  const random = seeded(7000 + division.division);
  const members = new Map(division.teams.map((team) => [team.id, team.members]));
  const result = new Map<string, RawMatchStats | null>();

  for (const match of matchesWithPlayedMaps(division)) {
    result.set(match.id, {
      rounds: match.maps
        .filter((map) => !map.forfeit)
        .map((map) => {
          const rounds = map.scores[0] + map.scores[1];
          return {
            round_stats: { Rounds: String(rounds) },
            teams: match.teamIds.map((teamId) => ({
              team_id: teamId,
              players: (members.get(teamId) ?? []).map((member) => {
                const kills = Math.round(rounds * (0.45 + random() * 0.5));
                return {
                  player_id: member.id,
                  nickname: member.nickname,
                  player_stats: {
                    Kills: String(kills),
                    Deaths: String(Math.round(rounds * (0.5 + random() * 0.3))),
                    Assists: String(Math.round(rounds * random() * 0.3)),
                    Headshots: String(Math.round(kills * (0.3 + random() * 0.4))),
                    ADR: (55 + random() * 50).toFixed(1),
                    MVPs: String(Math.round(random() * 4)),
                    "Triple Kills": String(Math.round(random() * 2)),
                    "Quadro Kills": String(random() < 0.15 ? 1 : 0),
                    "Penta Kills": String(random() < 0.03 ? 1 : 0),
                  },
                };
              }),
            })),
          };
        }),
    });
  }
  return result;
}
