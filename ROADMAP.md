# Ball Room — 10x Roadmap (v4)

**Submission closes July 19, 2026, 23:59 UTC.** This version is deliberately
honest about that clock: the product is a working, multiplayer, live-data,
Solana-verified fan game — the goal-aftershock feature and production KV are
now shipped, and the remaining gate is the demo video.

Criteria shorthand: **UX** = Fan Accessibility & UX · **RT** = Real-Time
Responsiveness · **OR** = Originality & Value Creation · **COM** =
Commercial/Monetization · **EX** = Completeness & Execution.

---

## Where we are (shipped + verified on live mainnet data)

- Live TxLINE mainnet real-time feed; **Solana sign-in = on-chain TxLINE subscribe** (one action)
- Core loop: pick match → call any leg (home/draw/away) → resolve → score → streak → receipt
- **Server-authoritative synchronized league rounds** (shared clock, ranked humans)
- Invite-link tables + join-by-code + honest **host** tagging
- **Host controls** (kick / dissolve) + member leave — all verified
- **Table feed** (auto game-events + chat + emoji reactions, members-only)
- **OG-image receipts** + **Solana-verified (Merkle-proof) receipts** with a re-attest endpoint
- Live status / score / connectivity hardening (retry + last-good cache)
- **Goal-aftershock rounds** (1.1 below — SHIPPED): goal detected → 60s "where
  does the market settle?" round, banner + feed event, KV-safe detection
- **Skill-based scoring** vs the no-change baseline (parroting ≈ 0; reading the move pays)
- **Score-first reads**: FT detected even after TxLINE pulls the odds; VAR-corrected
  scorelines (goals can go *down*); honest FT / market-closed states across the UI
- Fixtures card grouped by day + national-flag chips (hand-drawn inline SVG)
- **Vercel KV connected in production** (`/api/health` → `"storage":"kv"`)
- Cinematic hero (IP-safe art, athletic wordmark) + matchday soundtrack
- `DOCS.md` + `TXLINE_FEEDBACK.md` written; deployed at ballroom-eight.vercel.app

Routes today: `txline/{matches,match,jwt,activate}`, `league/{create,get,round,feed,kick,leave,dissolve}`,
`receipt/{create,verify}`, `health`, `dev/goal` (non-prod). 5 pages, 11 components.

---

## P0 — Submission gate (do these first; nothing else matters without them)

### 0.1 Connect Vercel KV (production persistence) — ✅ DONE
**Criteria:** EX (multiplayer is fake in prod without it).
**Acceptance:**
- [x] `ballroom-eight.vercel.app/api/health` returns `"storage":"kv"` (verified)
- [x] A table created on one device is visible on a second device after a redeploy

### 0.2 Demo video (≤5 min) — the hard screening gate
**Criteria:** gate for ALL of them.
**Acceptance:**
- [ ] Recorded during a live match (there are live World Cup knockouts now)
- [ ] Shows: the problem → sign in with Solana → open/join a table → call the odds move → live resolve → receipt (+ the "Verify on Solana" tap)
- [ ] `NEXT_PUBLIC_ROUND_SECONDS=60` set for recording so a full round resolves on camera
- [ ] Loom/YouTube link, under 5:00

### 0.3 Submission form
**Criteria:** gate.
**Acceptance:**
- [ ] Deployed link + public repo + video linked in README
- [ ] `DOCS.md` (done) + `TXLINE_FEEDBACK.md` (done) referenced/pasted into the form

---

## P1 — The 10x layer (ranked by value ÷ effort, realistic for 6 days)

### 1.1 ⭐ Goal-aftershock round — THE feature — ✅ SHIPPED
The core mechanic is quietest exactly when the match is loudest. A goal drops →
the server auto-opens a **short (~60s) round on where the market settles**. Odds
are *guaranteed* to be moving, football IQ actually pays, tension is real.
**Criteria:** RT + OR (primary), UX.
**Acceptance:**
- [x] Server detects a scoreline change (goal) per fixture — KV-safe (compares the
      live score to the round's own persisted reference; survives serverless)
- [x] Within one poll of a goal, an aftershock round opens (cuts the current round early if no one has locked; otherwise pulls the clock in and queues it)
- [x] Aftershock is visibly distinct (gold banner + 60s clock) and posts a feed event ("GOAL 63' — market repricing. Call where it lands.")
- [x] A dev/demo "simulate goal" trigger (`/api/dev/goal`, gated to non-prod) so it's testable + filmable even between goals

### 1.2 Match-moment markers on the heartbeat
Plot goals / red cards on the gold thread; the Scores feed already flows through
us. Makes "what happened on the pitch → what the market did" legible — the exact
comprehension moment the track asks for. Very demo-friendly.
**Criteria:** RT + UX + OR. Effort: ~0.5 day.
**Acceptance:**
- [ ] A goal renders a marker on the chart within one cycle; tap/hover shows minute + type
- [ ] A round in progress is annotated if a goal lands inside its window

### 1.3 SSE streaming (kill the poll)
Swap the 1s REST poll for TxLINE `/api/odds/stream` + `/api/scores/stream`
(endpoints confirmed by TxLINE support; we're on mainnet SL12 real-time so a
stream is pure latency win, not a tier change), proxied through one route.
Faster goal detection = snappier aftershock triggers, and fewer requests.
**Criteria:** RT. Effort: ~1 day. Invisible to judges but strengthens the demo.
**Acceptance:**
- [ ] One SSE connection per viewed match, auto-reconnect on drop
- [ ] p95 feed-to-pixel < 1s; poll path kept behind an env flag as fallback

### 1.4 The Floor — multi-match excitement router
One screen ranking live matches by **market volatility right now** (rolling σ of
the win-prob series, already in client memory). "Which game should I watch?" —
RedZone for the market.
**Criteria:** OR + UX. Effort: ~1 day. *Lower priority now:* knockouts are one
match at a time, so it shines less until group stages.
**Acceptance:**
- [ ] `/floor` ranks live matches by 5-min volatility, updating without reload
- [ ] One tap into any match; the top mover carries a "moving now" treatment

### 1.5 PWA + kickoff push
Manifest + service worker + push ("Argentina v Switzerland is open — the table
is seated"). Phones are the stated context.
**Criteria:** UX + COM (retention). Effort: ~1 day.
**Acceptance:**
- [ ] Installable (Lighthouse PWA pass); opted-in device gets a kickoff push that opens straight into the match

---

## P2 — Post-hackathon (document as the path, don't build now)

- **Full on-chain receipt verification** — execute the txoracle `validateStat`
  validator on-chain, not just re-attest. Deepest possible proof; OR.
- **Round-type variety** — pre-match (resolve at 15'), halftime reopen — session
  length; UX + OR.
- **Monetization** (COM is judged on *clarity of path*, not shipped billing):
  sponsored rounds, premium/season tables (Solana entry passes), embeddable
  verified-receipt widgets for creators, a B2B "market excitement" signal.

## Explicitly NOT doing (and why)
- **AI pundit bot / hi-lo stats game** — those are the brief's own example ideas;
  building them scores *repackaging*, not originality.
- **Real money / wagering** — the track warns on gambling law; skill-only is a feature.
- **A custom Solana program** — TxLINE's subscribe + message-signing already make
  the wallet load-bearing; new on-chain code is EX risk with no rubric payoff.

---

## Requirements cross-check

| Hackathon requirement | Status |
|---|---|
| Live product working during a match | ✅ mainnet real-time, verified on live games |
| TxLINE as a live input | ✅ Fixtures/Odds/Scores + Validation Proofs; SSE at 1.3 |
| Sign up through Solana | ✅ wallet sign-in + on-chain TxLINE subscription (one action) |
| Deployed link | ✅ ballroom-eight.vercel.app |
| Public repo | ✅ |
| Functional, not a mockup | ✅ full multiplayer loop, verified receipts |
| **Demo video ≤5 min** | ⬜ 0.2 — the gate |
| Technical documentation | ✅ DOCS.md |
| API feedback | ✅ TXLINE_FEEDBACK.md |
| Production persistence | ✅ Vercel KV connected (`/api/health` → `"storage":"kv"`) |

## Criteria coverage (what still moves the needle)

| Criterion | Where we're strong | Best remaining lift |
|---|---|---|
| Fan Accessibility & UX | one-tap sign-in, tables, feed, clean UI | goal-aftershock (1.1), moment markers (1.2) |
| Real-Time Responsiveness | live number, snake chart, resilient reads | aftershock (1.1) + SSE (1.3) |
| Originality & Value | market-as-the-game, Solana-verified receipts | aftershock (1.1) — banter *about the market moving* |
| Commercial / Monetization | documented path in DOCS | (document only) |
| Completeness & Execution | full loop, host controls, verified | KV (0.1) + demo (0.2) |

---

## Honest recommendation (updated)
1. **KV (0.1) and goal-aftershock (1.1) are done.** The only remaining gate is
   the **demo video (0.2)** — record it during a live match with
   `NEXT_PUBLIC_ROUND_SECONDS=60`, then file the form (0.3).
2. If (and only if) time remains after the video: **moment markers (1.2)** —
   cheap, visible, reinforces the aftershock story.
3. Everything else (SSE, Floor, PWA) is post-submission upside. Do not add
   breadth before the video exists.
