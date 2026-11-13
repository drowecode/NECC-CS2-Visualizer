# NECC CS2 Rankings

Standings, national rankings and team pages for the four NECC Fall 2026 CS2
divisions, built with Next.js and the official FACEIT Data API.

## Setup

1. Install Node.js 20.12 or newer.
2. Run `npm install`.
3. Copy `env.local.example` to `.env.local` and paste your FACEIT server-side
   API key after `FACEIT_API_KEY=`. Use the word `mock` instead of a key to
   preview the site with generated sample data.
4. Run `npm run check-data` to confirm the key works and the data looks right.
5. Run `npm run dev` and open http://localhost:3000.

## Commands

- `npm run dev`: start the site locally.
- `npm run check-data`: print per-division team, match and forfeit counts from FACEIT.
- `npm run check-stats`: fetch player statistics for every played match and print the leaders.
- `npm run test-league`: check the standings logic against a small fixture.
- `npm run typecheck`, `npm run lint`, `npm run build`.

## How it works

- `lib/faceit.ts`: FACEIT Data API client. Server-side only, throttled, retries on HTTP 429.
- `lib/league.ts`: turns raw matches into teams, matches and standings.
- `lib/stats.ts`: adds up per-map player statistics into season totals.
- `lib/data.ts`: cached entry point the pages use; standings refresh at most every 10 minutes, player stats every hour.
- `lib/mock.ts`: sample data used when `FACEIT_API_KEY=mock`.
- `app/rankings`, `app/national`, `app/team/[teamId]`, `app/stats`: the pages.

Forfeits are inferred: the Data API has no forfeit flag, so a map where neither
team passed 1 round is treated as forfeited, and a finished match made up only
of such maps counts as a forfeit by the losing team.

The API key must stay on the server. Never commit `.env.local`.
