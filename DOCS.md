# Ball Room — Technical Documentation

**Read the market, not the match.** Race your friends to call where the live
World Cup odds move next. Free to play, skill only, nothing staked.

- **Live app:** https://ballroom-eight.vercel.app
- **Track:** TxODDS "Consumer & Fan Experiences" (Superteam Earn, World Cup)

---

## 1. Core idea

Every live match carries a hidden number the crowd never sees: the **market's
win probability**, repricing every few seconds as the game breathes. Ball Room
turns *reading that number* into a game. You don't bet — you predict **where the
market moves next**, and the closest read at your table wins.

It's the one fan experience that is **impossible to build without a live odds
provider** — the odds feed isn't decoration, it's the entire game. That's why it
fits TxLINE specifically rather than any generic scores API.

- **Skill, not gambling.** Closest-to-the-pin scoring, no stake of value — which
  also keeps it clear of gambling law (a feature, per the track's own warning).
- **Social by design.** Invite-link tables, one shared round clock, live
  leaderboard, a game-aware table feed, and shareable receipts.
- **Solana is load-bearing, not bolted on.** The wallet that signs you in is the
  same wallet that subscribes to TxLINE on-chain — one action does both.

## 2. The loop

```
sign in with Solana → open/join a table → pick a live match
  → call where the odds move in the next window → lock it
  → server reads the live market + resolves → closest wins, streak compounds
  → every call becomes a receipt, proven on Solana → repeat
```

You can call **any leg** of the 3-way market (home / draw / away). League rounds
are **server-authoritative**: everyone at the table calls the same number on the
same clock, the server reads TxLINE at open and resolve, scores all guesses at
once, and ranks the humans.

## 3. TxLINE endpoints used

Auth model (all data calls send `Authorization: Bearer <guest jwt>` +
`X-Api-Token: <activated token>`):

| Purpose | Endpoint | Fields we consume |
|---|---|---|
| Guest session | `POST /auth/guest/start` | `token` (JWT) |
| On-chain activation | `POST /api/token/activate` | `{ txSig, walletSignature, leagues }` → API token |
| Fixtures | `GET /api/fixtures/snapshot?competitionId=72` | `FixtureId`, `Participant1/2`, `Participant1IsHome`, `StartTime` |
| **Odds** | `GET /api/odds/snapshot/{fixtureId}` | `SuperOddsType` (`1X2_PARTICIPANT_RESULT`), `MarketPeriod`, `PriceNames`, **`Pct`**, `InRunning`, `MessageId`, `Ts` |
| **Scores** | `GET /api/scores/snapshot/{fixtureId}` | `Clock.Seconds/Running`, `Score.ParticipantN.Total.Goals`, `GameState`, `Seq` |
| **Validation proof** | `GET /api/odds/validation?messageId&ts` | `odds`, `summary`, `subTreeProof`, `mainTreeProof` (Merkle) |

On-chain (txoracle program, mainnet `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`):
`subscribe(serviceLevel, weeks)` for the free World Cup tier (service level 12 =
real-time), then activation binds the signature to the guest JWT.

**Win probability** = the demargined 3-way `Pct` for each outcome, normalised so
home + draw + away = 100.

## 4. How TxLINE powers each feature

- **The live number + heartbeat chart** ← `odds/snapshot` `Pct`, polled and eased
  client-side for smooth motion.
- **Live status, scoreline, minute** ← `scores/snapshot` clock + goals.
- **Round resolution** ← the server re-reads `odds/snapshot` at the deadline; the
  actual value is authoritative.
- **Verified receipts** ← `odds/validation` Merkle proof attached to each
  resolved round; a `/api/receipt/[id]/verify` route re-attests it against the
  live oracle. No generic feed can offer *unfakeable* hot-take receipts.
- **Solana sign-up** ← the `subscribe` + `token/activate` flow is the sign-in.

## 5. Architecture (technical highlights)

- **Next.js 14 (App Router) on Vercel.** The TxLINE token stays server-side; the
  browser only talks to our own `/api/txline/*` and `/api/league/*` routes.
- **Server-authoritative synchronized rounds** keyed by `(league, match)` — one
  shared clock, lazy resolve on read (no cron), humans ranked by closeness.
- **Resilience layer.** TxLINE's odds/scores snapshots are lumpy near a market
  open (see feedback), so every read retries and the server holds a *last-good*
  cache per fixture — a transient miss never blanks the number or the score.
- **Persistence:** Vercel KV for leagues / rounds / feed / receipts (globalThis
  fallback in dev).
- **Verified receipts:** OG-image gold ticket (`next/og`, edge runtime) that
  unfurls in chats, backed by the Merkle proof.
- **No synthetic players.** Real humans only; the table feed's auto-events keep
  the room alive without fake accounts.

## 6. Business / monetization path

Judged on clarity, not shipped billing:

- **Sponsored rounds** — "this window presented by …", priced per impression at
  peak moments (a goal, the closing minutes).
- **Premium tables** — season-long standings, custom round types; entry passes
  settled on Solana.
- **Creator receipts** — embeddable *verified* hot-take widgets for pundits and
  streamers; the on-chain proof is the moat.
- **B2B signal** — a live "market excitement" index licensed to broadcasters /
  whip-around shows.

## 7. Run it locally

```bash
npm install
# activate the free World Cup tier on-chain (writes .env.local):
node scripts/activate-freetier.mjs --network mainnet --level 12   # needs ~0.01 SOL for fees
npm run dev
```

Set `NEXT_PUBLIC_ROUND_SECONDS=60` for a shorter round when recording a demo
(default is 300s / 5 min for real live play). Connect Vercel KV in production so
league/feed state persists across serverless invocations.
