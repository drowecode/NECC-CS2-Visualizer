/**
 * Verifies player statistics from FACEIT without starting the site.
 * Run with:  npm run check-stats
 * Reads FACEIT_API_KEY from .env.local.
 */

import {
  DIVISIONS,
  getDivisionRaw,
  getMatchStats,
  hasApiKey,
  type RawMatchStats,
} from "../lib/faceit";
import { buildDivision } from "../lib/league";
import { adr, aggregatePlayerStats, hsPercent, kd, matchesWithPlayedMaps } from "../lib/stats";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; fall through to the key check below.
}

async function main() {
  if (!hasApiKey()) {
    console.error("FACEIT_API_KEY is not set. Copy env.local.example to .env.local and paste your key in.");
    process.exit(1);
  }

  let printedSample = false;

  for (const info of DIVISIONS) {
    const started = Date.now();
    const raw = await getDivisionRaw(info);
    const division = buildDivision(info, raw.matches, raw.subscriptions, raw.extra);
    const matches = matchesWithPlayedMaps(division);
    const responses = await Promise.all(matches.map((match) => getMatchStats(match.id)));
    const statsByMatch = new Map<string, RawMatchStats | null>(matches.map((match, i) => [match.id, responses[i]]));
    const stats = aggregatePlayerStats(division, statsByMatch);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    console.log(`\n${info.name}  (fetched in ${seconds}s)`);
    console.log(
      `  played matches: ${stats.matchesExpected}   with stats: ${stats.matchesWithStats}   ` +
        `maps counted: ${stats.mapsCounted}   players: ${stats.players.length}`,
    );
    const unknownTeams = stats.players.filter((p) => p.teamName === "Unknown team").length;
    if (unknownTeams) console.log(`  players whose team could not be matched: ${unknownTeams}`);

    console.log("  top 5 by ADR (3+ maps):");
    const top = stats.players
      .filter((p) => p.maps >= 3)
      .sort((a, b) => adr(b) - adr(a))
      .slice(0, 5);
    for (const p of top) {
      console.log(
        `    ${p.nickname.padEnd(18)} ${p.teamName.padEnd(26)} maps ${String(p.maps).padStart(2)}  ` +
          `K/D ${kd(p).toFixed(2)}  ADR ${adr(p).toFixed(1)}  HS ${hsPercent(p).toFixed(0)}%  ` +
          `${p.kills}-${p.deaths}-${p.assists}`,
      );
    }

    if (!printedSample) {
      const sample = responses.find((r) => r?.rounds?.length);
      const map = sample?.rounds?.[0];
      const player = map?.teams?.[0]?.players?.[0];
      if (map && player) {
        printedSample = true;
        console.log("\n  Sample map exactly as FACEIT returns it (one player shown):");
        console.log(
          JSON.stringify(
            {
              round_stats: map.round_stats,
              team_id: map.teams?.[0]?.team_id,
              team_stats: map.teams?.[0]?.team_stats,
              player: { nickname: player.nickname, player_stats: player.player_stats },
            },
            null,
            2,
          )
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n"),
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(`\nFailed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
