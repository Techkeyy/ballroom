# Ball Room 🕺⚽

**Read the market, not the match.** Race your friends to call where the live odds move next.

A World Cup fan game for the **TxODDS "Consumer and Fan Experiences"** track on Superteam Earn. Sign in with Solana, pick a live match, and guess where the betting market moves in the next 45 seconds. Closest to the pin wins. No money staked — pure skill.

> Betting sites constantly move the odds during a match. Ball Room doesn't let you bet — it turns *reading those moves* into a game against your mates.

## Why it's different

Nobody has made **the market's mind** the object of play. You're not predicting the game — you're predicting how the bookmakers react to it, second by second. That's impossible to build without a live-odds provider, which is exactly what **TxLINE** is. The odds feed isn't decoration here; it's the entire game.

## The loop

```
invite → sign in with Solana → join your league
  → pick a live match → guess where the odds move next → lock it
  → watch it resolve live → score by closeness → streak + leaderboard
  → share the brag → repeat
```

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Runs in **simulator mode** by default (`NEXT_PUBLIC_TXLINE_MOCK=true`) — a realistic random-walk odds model with goal shocks, so the whole game is playable with **no API key and no live match**. That's also what makes the demo bulletproof: it works identically whether or not a match is live during judging.

To go live, copy `.env.example` → `.env.local`, set `NEXT_PUBLIC_TXLINE_MOCK=false`, add your `TXLINE_API_KEY`, and wire the two TODOs in [`lib/txline.ts`](lib/txline.ts) (`fetchRealMatches` / `subscribeRealMatch`) to the World Cup Fixtures / Odds / Scores endpoints.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — dark editorial pitch theme
- **Hand-rolled SVG** heartbeat chart (no chart deps)
- **localStorage** player/league store (swap for a backend at M4)
- **Solana** wallet sign-in (stubbed at M3-ready seam in `WalletButton` / `store.ts`)

## Layout

```
app/
  page.tsx                landing / invite / sign-in
  play/page.tsx           live matches
  play/[matchId]/page.tsx the game
lib/
  txline.ts   data adapter (simulator + real TxLINE seam)
  game.ts     scoring, streaks, synthetic crowd
  store.ts    player/league persistence
components/
  Heartbeat · PredictionPad · Leaderboard · ShareCard · WalletButton
```

See [`BUILD_PLAN.md`](BUILD_PLAN.md) for milestones, endpoint mapping, and the judging-criteria breakdown.

## Guardrails

Free-to-play · skill-based · closest-to-the-pin · **no wagering, no money staked.** Deliberately small scope, executed end-to-end.
