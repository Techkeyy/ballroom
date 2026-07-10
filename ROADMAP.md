# Ball Room — 10x Roadmap (v2)

Cross-referenced against the TxODDS "Consumer and Fan Experiences" judging criteria.
**Submissions close July 19, 2026, 23:59 UTC.**

Criteria shorthand: **UX** = Fan Accessibility & UX · **RT** = Real-Time Responsiveness ·
**OR** = Originality & Value Creation · **COM** = Commercial & Monetization ·
**EX** = Completeness & Execution.

---

## Shipped since v1 (all live, verified on mainnet TxLINE)

- ✅ **Mainnet real-time feed** (service level 12, zero-delay)
- ✅ **Synchronized server-authoritative league rounds** — one shared clock per (league, match); the server reads the live market at open + resolve, scores every guess at once, ranks the humans. Verified 2-player end-to-end.
- ✅ **All synthetic/bot data removed** — real humans only
- ✅ **Real invite-link leagues** (`/join/[code]`, Vercel KV)
- ✅ **OG-image receipts** (`/r/[id]` gold ticket, unfurls in chats)
- ✅ **Solana-verified receipts** — TxLINE Merkle proof attached + `/verify` re-attestation
- ✅ **Connectivity hardening** — last-good cache kills the connect/disconnect flap; decoupled fetch(1s)/render(120ms) loops = smooth "snake" chart; real **LIVE / PRE / FT** detection
- ✅ **Full 3-way market** shown (home/draw/away) so a round reads as a match, not one team
- ✅ **Proper national team codes** (FIFA-style map)
- ✅ **Configurable round window** (`NEXT_PUBLIC_ROUND_SECONDS`, default 90s)
- ✅ **Cinematic hero** (feathered poster) + ambient theme music with toggle

---

## P0 — Submission-critical (before July 19)

### 0.1 Submission package (the screening gate)
**Criteria:** gate for everything — no video/docs, no pass.
**Acceptance:**
- [ ] ≤5-min demo video (problem → live walkthrough during a match → how TxLINE powers it), recorded during a live game
- [ ] `DOCS.md`: core idea, business/technical highlights, exact TxLINE endpoints used
- [ ] TxLINE API feedback written into the Superteam form (material ready: raw-text activate response, PascalCase-vs-OpenAPI scores mismatch, ATA pre-create requirement, `competitionId` discovery, transient odds nulls)
- [ ] README links deployed app + video + DOCS

### 0.2 Production persistence + config sanity
**Criteria:** EX (leagues/receipts vanish without it)
**Acceptance:**
- [ ] Vercel KV connected; a league created on one device is visible on another after redeploy
- [ ] `NEXT_PUBLIC_ROUND_SECONDS` set for the demo (e.g. 60–90s); mainnet env confirmed
- [ ] Asset weights optimized (hero → WebP/JPG < 400 KB; audio trimmed/compressed) for fast mobile load

---

## P1 — The 10x layer (build in order until time runs out)

### 1.1 Round-type variety — *the direct answer to "why only 45 seconds?"*
A single fixed window is the biggest UX limiter. Different moments deserve different clocks and questions.
**Criteria:** UX (session length) + OR
**Types:**
- **Pre-match (long):** lock before kickoff, resolves at ~15′ — reads the opening momentum
- **Live short (60–90s):** the current punchy round
- **Halftime special:** call where the market reopens at 46′
- **Goal aftershock:** a goal drops → a 90s round on where the market settles (auto-offered)
**Acceptance:**
- [ ] Round picker shows ≥2 live types during a match; aftershock auto-offers within 10s of a goal
- [ ] Each type has its own window + copy; the receipt names the round type
- [ ] League rounds stay synchronized per type

### 1.2 Multi-market prediction — *the direct answer to "why one-sided?"*
Today you call the home-win line. Let players call the market that interests them: **away win, draw, next-goal timing, total goals, corners** — any number TxLINE exposes.
**Criteria:** OR + UX + deeper TxLINE use
**Acceptance:**
- [ ] Solo: pick which outcome/stat to call from the live market menu; scoring/receipt reflect it
- [ ] League: the round names its market (e.g. "SUI win %", "total goals") so everyone calls the same one
- [ ] The 3-way strip is tappable to switch the called leg (solo)

### 1.3 SSE streaming (kill the poll)
Swap the 1s REST poll for TxLINE's `/api/odds/stream` + `/api/scores/stream`, proxied through one route. Sub-second, event-driven.
**Criteria:** RT
**Acceptance:**
- [ ] One SSE connection per viewed match, auto-reconnect on drop
- [ ] p95 feed-to-pixel < 1s on mainnet L12
- [ ] Poll path kept behind an env flag as fallback

### 1.4 Match moments on the heartbeat
Plot goal / red-card / big-swing markers on the gold thread (the Scores stream already flows through the adapter), with a toast on goals ("GOAL — market repricing").
**Criteria:** RT + UX + OR
**Acceptance:**
- [ ] A goal in the feed renders a marker within one cycle; tap shows minute + type
- [ ] A round in progress is annotated if a goal lands inside its window

### 1.5 The Floor — multi-match excitement router
One screen ranking live matches by **market volatility right now** (rolling σ of the win-prob series, already in client memory). "Which game should I be watching?" — RedZone for the market.
**Criteria:** OR + UX
**Acceptance:**
- [ ] `/floor` ranks live matches by 5-min volatility, updating without reload
- [ ] One tap into any match; top mover carries a "moving now" treatment

### 1.6 PWA + kickoff notifications
Phones are the stated context. Manifest + service worker + push ("Argentina v Switzerland is open — the table is seated").
**Criteria:** UX + COM (retention)
**Acceptance:**
- [ ] Installable (Lighthouse PWA pass)
- [ ] Opted-in device gets a kickoff push and opens straight into the match

---

## P2 — Monetization narrative (document in DOCS, don't build)

COM is judged on *clarity of path*, not shipped billing:
- **Sponsored rounds** — "this 90-second window presented by …", priced per impression at peak moments
- **Premium tables** — season-long standings, custom round types; entry passes settled on Solana
- **Creator receipts** — embeddable verified-receipt widgets for pundits/streamers (the proof layer is the moat)
- **B2B** — the excitement-router signal (1.5) licensed to broadcasters / whip-around shows

---

## Explicitly out of scope (and why)
- **Real money / wagering** — the track warns on gambling law; skill-only is a feature
- **The brief's own example ideas** (AI pundit bot, hi-lo stats game) — building them scores *repackaging*, not originality
- **A custom Solana program** — TxLINE's subscribe program + message-signing already make the wallet load-bearing; new on-chain code is EX risk with no rubric payoff

## Requirements cross-check

| Hackathon requirement | Status |
|---|---|
| Live product working during a match | ✅ mainnet real-time, resilient |
| TxLINE as live input | ✅ Fixtures/Odds/Scores + Validation Proofs; SSE at 1.3 |
| Sign up through Solana | ✅ wallet sign-in + on-chain TxLINE subscription (one action) |
| Deployed link | ✅ ballroom-eight.vercel.app |
| Public repo | ✅ |
| Demo video ≤5 min | ⬜ 0.1 |
| Technical documentation | ⬜ 0.1 |
| API feedback | ⬜ 0.1 (material collected) |
| Functional, not mockup | ✅ full loop, real multiplayer, verified receipts |
