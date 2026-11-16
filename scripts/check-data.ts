/**
 * Verifies the FACEIT data layer without starting the site.
 * Run with:  npm run check-data
 * Reads FACEIT_API_KEY from .env.local.
 */

import { DIVISIONS, getChampionshipMatches, getDivisionRaw, hasApiKey } from "../lib/faceit";
import { buildDivision, computeRecords } from "../lib/league";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; fall through to the key check below.
}

const day = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : "no date");

async function main() {
  if (!hasApiKey()) {
    console.error("FACEIT_API_KEY is not set. Copy env.local.example to .env.local and paste your key in.");
    process.exit(1);
  }

  for (const info of DIVISIONS) {
    const raw = await getDivisionRaw(info);
    const division = buildDivision(info, raw.matches, raw.subscriptions, raw.extra);
    const finished = division.matches.filter((m) => m.status === "finished");
    const forfeited = finished.filter((m) => m.forfeitBy !== null);
    const withRounds = finished.filter((m) => m.maps.some((map) => !map.forfeit));

    console.log(`\n${info.name}`);
    if (info.extraChampionshipIds.length > 0) {
      const extraIds = new Set(raw.extra.matches.map((m) => m.match_id));
      console.log(`  extra championships: ${info.extraChampionshipIds.length}   matches from them:`);
      for (const match of division.matches.filter((m) => extraIds.has(m.id))) {
        console.log(
          `    ${match.teamNames[0]} ${match.mapScore[0]}-${match.mapScore[1]} ${match.teamNames[1]}` +
            `  (group ${match.group ?? "?"}, round ${match.round ?? "?"}, ${match.status})`,
        );
      }
    }
    console.log(`  teams: ${division.teams.length}   groups: ${division.groups.join(", ") || "none"}`);
    console.log(
      `  matches: ${division.matches.length}   finished: ${finished.length}   ` +
        `with round scores: ${withRounds.length}   forfeited: ${forfeited.length}`,
    );

    const records = computeRecords(division);
    const repeat = [...records.values()].filter((r) => r.forfeits >= 2).sort((a, b) => b.forfeits - a.forfeits);
    if (repeat.length === 0) {
      console.log("  teams with 2+ forfeits: none");
      continue;
    }
    console.log("  teams with 2+ forfeits:");
    for (const record of repeat) {
      console.log(`    ${record.teamName} (Group ${record.group ?? "?"}): ${record.forfeits}`);
      for (const match of forfeited) {
        if (match.forfeitBy === null || match.teamIds[match.forfeitBy] !== record.teamId) continue;
        const opponent = match.teamNames[match.forfeitBy === 0 ? 1 : 0];
        console.log(`      vs ${opponent}, round ${match.round ?? "?"}, ${day(match.finishedAt ?? match.scheduledAt)}`);
      }
    }
  }

  // Show one finished match exactly as FACEIT returns it, to confirm field names.
  const sample = (await getChampionshipMatches(DIVISIONS[0].championshipId)).find(
    (m) => (m.status ?? "").toUpperCase() === "FINISHED",
  );
  if (sample) {
    const { teams, ...rest } = sample;
    console.log("\nSample finished match (rosters trimmed):");
    console.log(
      JSON.stringify(
        {
          ...rest,
          teams: Object.fromEntries(
            Object.entries(teams ?? {}).map(([key, team]) => [key, { faction_id: team.faction_id, name: team.name }]),
          ),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(`\nFailed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
