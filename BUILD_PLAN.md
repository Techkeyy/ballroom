# Ball Room — Build Plan

> Read the market, not the match. Race your friends to call where the odds move next.

**Hackathon:** TxODDS "Consumer and Fan Experiences" — World Cup track (Superteam Earn)
**Deadline:** July 19, 2026, 23:59 UTC
**Platform requirement:** Solana sign-up + TxLINE live data as a live input
**Team size:** ≤ 3

---

## 1. The idea in one line

Betting sites constantly move the odds during a live match. Ball Room doesn't let you bet — instead you **race your friends to guess where the odds move next**. You're not predicting the game; you're predicting how the *market* reacts to it. Closest guess wins. Free-to-play, skill-based, no money staked.

## 2. Why this can win (mapped to the judging criteria)

| Criterion | How Ball Room scores |
|---|---|
| **Fan Accessibility & UX** | One-tap wallet sign-in, one slider to play, friends leaderboard. A pub fan gets it in 10 seconds. |
| **Real-Time Responsiveness** | The whole game *is* the live odds stream. The number moves because of what's happening on the pitch, second by second. |
| **Originality & Value Creation** | Nobody has made the *market's mind* the object of play. Impossible to build without a live-odds provider — i.e. TxLINE is the moat, not decoration. |
| **Commercial & Monetization** | Sponsored "call of the match", premium stat overlays, creator receipt embeds, league entry passes. Skill-framing keeps it clear of gambling law. |
| **Completeness & Execution** | Deliberately small scope: one loop, done well, demoable against any single match — even a 0–0. |

## 3. The core loop (what the user actually does)

```
invite link → sign in with Solana wallet → join friends' league
   → pick a live match → see the odds "heartbeat" chart
   → guess where the market will be in N seconds → lock it
   → watch it resolve live → score by closeness → streak + leaderboard
   → share the brag card → repeat every match
```

Scoring is **closest-to-the-pin**, not binary: dead-on = big points, close = decent points, nobody who plays gets zero. You also play against a **synthetic crowd** (bot friends whose guesses hug the market with noise) so the leaderboard feels alive from the first session — this solves the cold-start problem a real "vs. the crowd" game has.

## 4. Architecture

```
Next.js 14 (App Router, TS, Tailwind)
├─ app/
│  ├─ page.tsx                landing / invite / wallet sign-in
│  ├─ play/page.tsx           live matches list
│  └─ play/[matchId]/page.tsx live match screen (the game)
├─ lib/
│  ├─ txline.ts   data adapter — REAL TxLINE endpoints + SIMULATOR fallback
│  ├─ game.ts     scoring (closeness decay), streaks, crowd bots
│  └─ store.ts    localStorage: player, points, streak, league, history
└─ components/
   ├─ Heartbeat.tsx      hand-rolled SVG odds chart + guess marker
   ├─ PredictionPad.tsx  slider + countdown + lock
   ├─ Leaderboard.tsx    friends + bots, live re-rank
   ├─ ShareCard.tsx      the bragging receipt
   └─ WalletButton.tsx   Solana sign-in (stub → swap for wallet-adapter)
```

**Data layer is the key design choice.** `lib/txline.ts` exposes a stable shape:

```ts
getLiveMatches(): Promise<Match[]>
subscribeToMatch(id, onPoint): unsubscribe   // emits an OddsPoint on a live cadence
```

Two implementations behind that shape:
- **Simulator (default, `NEXT_PUBLIC_TXLINE_MOCK=true`)** — a realistic random-walk odds model with goal shocks. Makes the app fully demoable with no API key and no live match.
- **Real TxLINE** — same shape, backed by the World Cup Fixtures / Odds / Scores endpoints. Swapping is a one-file change.

## 5. TxLINE endpoints (real mode) — from the OpenAPI spec

Wired in `lib/txline-server.ts` (server-only) + `app/api/txline/*` routes. Base: `https://txline.txodds.com/api`. Auth: `Authorization: Bearer <guest jwt>` + `X-Api-Token: <apiToken>`.

| Need | Endpoint | Key fields we use |
|---|---|---|
| Live fixtures | `GET /api/fixtures/snapshot?competitionId=` | `FixtureId`, `Participant1/2`, `Participant1IsHome`, `StartTime` |
| The moving number | `GET /api/odds/snapshot/{fixtureId}` | `PriceNames`, **`Pct`** (implied prob per outcome), `InRunning`, `MarketPeriod` |
| Live updates | `GET /api/odds/updates/{fixtureId}` · SSE `GET /api/odds/stream` | streamed `Pct` |
| Scoreline / minute | `GET /api/scores/snapshot/{fixtureId}` · SSE `/api/scores/stream` | `gameState`, `score` |
| Verifiable badge | `GET /api/odds/validation` (Merkle proof) | proof for the share card |

**Win probability = normalised home `Pct`:** take the 3-way match-result line, parse `Pct` (e.g. `"48.300"`), divide by the sum of the three to strip overround → clean 0–100%. (Confirm the exact `SuperOddsType` string for match-result against the Odds reference — code uses a defensive length-3 + `InRunning` heuristic.)

Streaming is **SSE**, not websocket. MVP polls the snapshot route on a 1.5s cadence; a later pass proxies `/api/odds/stream` through a server route.

### Solana = the TxLINE subscription (not a bolt-on)
Activating TxLINE is itself an on-chain action: `POST /api/guest/purchase/quote` returns a base64 Solana tx → the user signs it with their wallet → `POST /api/token/activate { txSig, walletSignature, leagues }`. **The same wallet that signs the TxLINE subscription is the app's Solana sign-up** — one action satisfies both hackathon requirements. Program ids: mainnet `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`, devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`.

Free real-time World Cup tier is available to the deadline; 60s-delayed tier as fallback.

## 6. Milestones

- **M1 — Scaffold + simulator (this MVP):** runnable app, full loop against the simulator, leaderboard with bot crowd, share card. ✅ delivered here.
- **M2 — Real TxLINE:** adapter + server routes wired to the documented Fixtures/Odds/Scores schema (`lib/txline-server.ts`). ✅ coded; needs an activated `TXLINE_API_TOKEN` + confirmation of the match-result `SuperOddsType` to run live.
- **M3 — Real Solana sign-in = TxLINE activation:** ✅ wallet connect (Wallet-Standard: Phantom/Solflare/Backpack) + sign-message ownership proof now the primary sign-in (`SolanaProvider` + `WalletButton`), with a guest fallback so the demo runs without an extension. On-chain paid-tier unlock is coded end-to-end (`lib/txline-activate.ts` + `/api/txline/quote` + `/api/txline/activate`) — needs a funded wallet to exercise. One wallet does sign-up *and* unlocks the live feed.
- **M4 — Persistence + real leagues:** lightweight backend (Supabase/Upstash) so friends share a real league + leaderboard across devices.
- **M5 — Share as OG image:** `/api/receipt/[id]` renders the brag card as an image so it unfurls natively on X/WhatsApp.
- **M6 — Polish + demo video:** capture a live call during a knockout match; 5-min Loom.

## 7. Scope guardrails (what we are NOT building)

- No real money, no wagering, no settlement of value — skill points only.
- No native mobile app — responsive web is enough for the demo.
- No accounts/passwords — wallet is the identity.
- Multi-match "RedZone" router is a stretch goal, not MVP.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| No live matches during judging | Simulator mode demos identically; record video during a live knockout. |
| "Predict a %" too abstract for casual fans | Frame every question in plain words ("about to score?"), show the number big, keep the slider tactile. |
| Cold-start (no crowd) | Synthetic bot crowd seeded from the market so solo play still feels social. |
| Gambling-law framing | Free-to-play, skill-based, closest-to-pin, no stake of value — messaged explicitly in UI. |

## 9. Run it

```bash
cd ballroom
npm install
npm run dev
# http://localhost:3000  (simulator mode on by default)
```
