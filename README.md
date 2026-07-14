# Ball Room

**Read the market, not the match.** Race your friends to call where the live World Cup odds move next — free to play, skill only, nothing staked.

**Live app:** https://ballroom-eight.vercel.app · **Demo video:** _coming with submission_

Built for the **TxODDS "Consumer and Fan Experiences"** World Cup track on [Superteam Earn](https://earn.superteam.fun). Powered by [TxLINE](https://txline.txodds.com) real-time consensus odds, signed in with Solana.

> Betting sites move their odds every few seconds during a live match. Ball Room doesn't let you bet — it turns *reading those moves* into a synchronized game against your friends. You're not predicting the game; you're predicting how the market reacts to it.

## Features

- **Live market gameplay** — real-time TxLINE mainnet odds (Fixtures, Odds, Scores); pick any leg of the 3-way market (home / draw / away) and call where it lands when the round clock runs out.
- **Skill-based scoring** — you're scored on how well you read the *move*, not raw closeness: calls are measured against the naive "no-change" baseline, so echoing the current number scores near zero while nailing a real swing pays big. Streaks require clearing a real bar *and* beating the table.
- **Goal-aftershock rounds** — when a goal drops, the slow round is swept aside for a short 60-second "where does the market settle?" round (banner + a "GOAL — market repricing" feed event). The market is *guaranteed* to be moving — the loudest moment of the match becomes the highest-stakes round.
- **Synchronized tables (leagues)** — server-authoritative rounds: one shared clock per table, everyone calls the same number, the server reads the live market at open and resolve and ranks the humans. No client can fake it.
- **Full fixtures card** — live matches pinned up top with national-flag chips (hand-drawn inline SVG, zero image assets), upcoming fixtures grouped by day (Today / Tomorrow / dated) with kickoff times, and finished matches showing their full-time score — always something honest on the card, even between matchdays.
- **Invite links & join by code** — open a table, share `/join/CODE` or the 5-char code itself. Hosts are tagged, can kick members or close the table; members can leave anytime.
- **Table talk** — a game-aware feed per table: auto-events ("Ada opened the table", "Ben is in for this round", round winners + streaks) plus short messages and emoji reactions. Members only.
- **Receipts, provable on Solana** — every resolved call becomes a shareable receipt page with an OG-image "gold ticket" unfurl. Live-mode receipts carry the TxLINE **Merkle validation proof** (batch root committed on-chain by the TxODDS oracle) and a `/verify` endpoint that re-attests the numbers against the oracle.
- **Solana sign-in that's load-bearing** — the wallet isn't decoration: activating TxLINE's free World Cup tier *is* an on-chain `subscribe` transaction. One wallet action = sign-up + data unlock. Guest mode exists for wallet-less judges.
- **Resilient live data** — retrying reads, last-good caching, and a decoupled render loop so the odds chart glides even when the upstream feed is lumpy. **Score-first reads**: the scores feed owns match state, the odds feed owns the number, and each survives the other's absence — TxLINE pulls the odds entirely at full time, and goal totals follow the latest correction (a VAR-disallowed goal un-counts) instead of a naive running max.

## How a round works

```
sign in (Solana wallet or guest) → open/join a table
  → pick today's match → choose a leg (NOR / DRAW / ENG)
  → call where that % sits when the clock runs out → lock it
  → watch the live thread → server resolves & ranks the table
  → streaks, points, receipt → share the brag → go again
```

Round window defaults to **5 minutes** (`NEXT_PUBLIC_ROUND_SECONDS`, drop to `60` for demos).

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Out of the box this runs in **simulator mode** (`NEXT_PUBLIC_TXLINE_MOCK=true`) — a realistic random-walk market with goal shocks, so the full game is playable with no API token and no live match.

### Going live (real TxLINE data)

TxLINE's free World Cup tier is activated **on-chain**. The repo ships a self-service script:

```bash
# devnet (free SOL via faucet; 60s-delayed data)
node scripts/activate-freetier.mjs --network devnet --level 1

# mainnet (needs ~0.003 SOL for fees; real-time data)
node scripts/activate-freetier.mjs --network mainnet --level 12
```

The script creates/loads a keypair, sends the `subscribe` transaction to the txoracle program, signs the activation message, and writes `TXLINE_API_TOKEN` + `TXLINE_BASE_URL` into `.env.local` with `NEXT_PUBLIC_TXLINE_MOCK=false`. Restart the dev server and the app is on live data.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_TXLINE_MOCK` | `true` | `true` = simulator, `false` = real TxLINE |
| `TXLINE_BASE_URL` | mainnet API | TxLINE host (devnet: `txline-dev.txodds.com/api`) |
| `TXLINE_API_TOKEN` | — | from on-chain activation (script above) |
| `TXLINE_COMPETITION_ID` | `72` | World Cup competition id |
| `NEXT_PUBLIC_ROUND_SECONDS` | `300` | round clock length |
| `NEXT_PUBLIC_SOLANA_RPC` | devnet | RPC for wallet flows |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | — | Vercel KV (auto-injected when connected); in-memory fallback in dev |

**Production note:** tables, rounds, feed and receipts persist via **Vercel KV** — connect a KV store in the Vercel dashboard or multiplayer state won't survive across serverless invocations.

## Project structure

```
app/
  page.tsx                    landing (hero, sign-in, join-by-code)
  play/page.tsx               today's card + your table (leaderboard, feed, host controls)
  play/[matchId]/page.tsx     the game: live number, 3-way legs, heartbeat chart, rounds
  join/[code]/page.tsx        invite landing (names the host, seats you)
  r/[id]/page.tsx             public receipt page (+ opengraph-image gold ticket)
  api/txline/*                matches / match / jwt / activate — server-side TxLINE proxy
  api/league/*                create / get / round / feed / kick / leave / dissolve
  api/receipt/*               create + verify (oracle re-attestation)
  api/health                  storage & data-source diagnostics
lib/
  txline-server.ts            TxLINE integration (auth, odds/scores mapping, resilience)
  txline.ts                   client adapter: simulator + live subscription (snake chart)
  txline-chain.ts / txline-activate.ts   on-chain subscribe + activation flows
  league-server.ts / league.ts           tables, synchronized rounds, feed
  receipts-server.ts          receipts + Merkle proof storage
  game.ts / store.ts          scoring, streaks, local identity
components/
  Heartbeat · PredictionPad · Leaderboard · TableFeed · ShareCard · Flag
  WalletButton · SolanaProvider · MusicToggle · AmbientBackdrop
scripts/
  activate-freetier.mjs       self-service on-chain TxLINE activation
  probe-live.mjs              raw-feed diagnostic (compare TxLINE vs our API)
```

## Stack

**Next.js 14** (App Router, TypeScript) · **Tailwind CSS** · **@solana/web3.js + wallet-adapter** · **Vercel KV** · hand-rolled SVG charting · Web-Audio generative score (no audio assets)

## Documentation

- [`DOCS.md`](DOCS.md) — core idea, TxLINE endpoints used, technical & business highlights
- [`TXLINE_FEEDBACK.md`](TXLINE_FEEDBACK.md) — real integration feedback for the TxODDS team
- [`ROADMAP.md`](ROADMAP.md) — what's shipped, what's next, judged against the track criteria
- [`BUILD_PLAN.md`](BUILD_PLAN.md) — original architecture plan (historical)

## Hackathon compliance

| Requirement | Status |
|---|---|
| Live product working during a match | ✅ mainnet real-time, verified on live World Cup games |
| TxLINE as a live input | ✅ Fixtures + Odds + Scores + Validation Proofs |
| Sign up through Solana | ✅ wallet sign-in; TxLINE activation is an on-chain subscribe |
| Deployed link | ✅ ballroom-eight.vercel.app |
| Functional, not a mockup | ✅ full multiplayer loop, verified end-to-end |

## Guardrails

Free-to-play · skill-based · closest-to-the-pin scoring · **no wagering, no money staked, ever.** All art and audio are original or IP-safe.
