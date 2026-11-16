/**
 * Prints the playoff brackets as the site will show them.
 * Run with:  npm run check-playoffs
 * Reads FACEIT_API_KEY from .env.local.
 */

import { getChampionshipMatches, getChampionshipSubscriptions, hasApiKey } from "../lib/faceit";
import { bracketLabel, buildBracket, PLAYOFFS, type BracketRound } from "../lib/playoffs";
import type { Match } from "../lib/league";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; fall through to the key check below.
}

const line = (m: Match | null) =>
  m
    ? `${m.teamNames[0]} ${m.status === "finished" ? `${m.mapScore[0]}-${m.mapScore[1]}` : "v"} ${m.teamNames[1]}  (${m.status})`
    : "waiting on earlier results";

function printRounds(rounds: BracketRound[]) {
  for (const round of rounds) {
    console.log(`  ${round.name}`);
    for (const slot of round.slots) console.log(`    ${line(slot.match)}`);
  }
}

async function main() {
  if (!hasApiKey()) {
    console.error("FACEIT_API_KEY is not set. Copy env.local.example to .env.local and paste your key in.");
    process.exit(1);
  }

  for (const info of PLAYOFFS) {
    console.log(`\n${bracketLabel(info)}  (${info.format} elimination)`);
    try {
      const matches = await getChampionshipMatches(info.championshipId);
      const subscriptions = await getChampionshipSubscriptions(info.championshipId);
      const bracket = buildBracket(info, matches, subscriptions);

      console.log(`  FACEIT returned ${matches.length} matches and ${subscriptions.length} sign-ups`);
      console.log(`  raw group/round: ${matches.map((m) => `${m.group ?? "?"}/${m.round ?? "?"}`).join(", ") || "none"}`);
      const unplaced = matches.filter((m) => !m.teams?.faction1?.faction_id || !m.teams?.faction2?.faction_id).length;
      if (unplaced) console.log(`  matches without both teams yet: ${unplaced}`);
      console.log(`  state: ${bracket.state}   teams: ${bracket.teams.length}`);

      if (bracket.rounds.length === 0) {
        console.log("  bracket not drawn yet");
        continue;
      }
      if (bracket.format === "double") console.log("  UPPER BRACKET");
      printRounds(bracket.rounds);
      if (bracket.format === "double") {
        console.log("  LOWER BRACKET");
        printRounds(bracket.lowerRounds);
        console.log(`  Grand final: ${line(bracket.grandFinal)}`);
        if (bracket.grandFinalReset) console.log(`  Grand final reset: ${line(bracket.grandFinalReset)}`);
      }
      if (bracket.hasThirdPlace) console.log(`  3rd place match: ${line(bracket.thirdPlace)}`);
    } catch (error) {
      console.log(`  could not be read: ${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch((error) => {
  console.error(`\nFailed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
