# Ball Room — 10x Roadmap (v3)

**6 days to submission (closes July 19, 2026, 23:59 UTC).** This version is
deliberately honest about that clock: the product is already a working,
multiplayer, live-data, Solana-verified fan game. The highest-leverage work left
is *not* a stack of new features — it's the ONE feature that upgrades the core
mechanic, plus converting everything built into a submission that scores.

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
- Cinematic hero (IP-safe art, athletic wordmark) + generative in-app score
- `DOCS.md` + `TXLINE_FEEDBACK.md` written; deployed at ballroom-eight.vercel.app

Routes today: `txline/{matches,match,jwt,activate}`, `league/{create,get,round,feed,kick,leave,dissolve}`,
`receipt/{create,verify}`, `health`. 5 pages, 10 components.

---

## P0 — Submission gate (do these first; nothing else matters without them)

### 0.1 Connect Vercel KV (production persistence)
**Criteria:** EX (multiplayer is fake in prod without it).
**Acceptance:**
- [ ] `ballroom-eight.vercel.app/api/health` returns `"storage":"kv"`
- [ ] A table created on one device is visible on a second device after a redeploy

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

### 1.1 ⭐ Goal-aftershock round — THE feature
The core mechanic is quietest exactly when the match is loudest. A goal drops →
the server auto-opens a **short (~60s) round on where the market settles**. Odds
are *guaranteed* to be moving, football IQ actually pays, tension is real. This
is the single biggest upgrade and it demos spectacularly on a live goal.
**Criteria:** RT + OR (primary), UX. Effort: ~0.5–1 day. **Build this.**
**Acceptance:**
- [ ] Server detects a scoreline change (goal) per fixture
- [ ] Within one poll of a goal, an aftershock round opens (cuts the current round early if no one has locked; otherwise queues right after resolve)
- [ ] Aftershock is visibly distinct (banner + shorter clock) and posts a feed event ("GOAL 63' — call where it lands")
- [ ] A dev/demo "simulate goal" trigger (gated to non-prod) so it's testable + filmable even between goals

### 1.2 Match-moment markers on the heartbeat
Plot goals / red cards on the gold thread; the Scores feed already flows through
us. Makes "what happened on the pitch → what the market did" legible — the exact
comprehension moment the track asks for. Very demo-friendly.
**Criteria:** RT + UX + OR. Effort: ~0.5 day.
**Acceptance:**
- [ ] A goal renders a marker on the chart within one cycle; tap/hover shows minute + type
- [ ] A round in progress is annotated if a goal lands inside its window

### 1.3 SSE streaming (kill the poll)
Swap the 1s REST poll for TxLINE `/api/odds/stream` + `/api/scores/stream`,
proxied through one route. Sub-second, event-driven, and removes the last of the
"connectivity" fragility.
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
| Production persistence | ⬜ 0.1 (connect KV) |

## Criteria coverage (what still moves the needle)

| Criterion | Where we're strong | Best remaining lift |
|---|---|---|
| Fan Accessibility & UX | one-tap sign-in, tables, feed, clean UI | goal-aftershock (1.1), moment markers (1.2) |
| Real-Time Responsiveness | live number, snake chart, resilient reads | aftershock (1.1) + SSE (1.3) |
| Originality & Value | market-as-the-game, Solana-verified receipts | aftershock (1.1) — banter *about the market moving* |
| Commercial / Monetization | documented path in DOCS | (document only) |
| Completeness & Execution | full loop, host controls, verified | KV (0.1) + demo (0.2) |

---

## Honest recommendation (given 6 days)
1. **Today:** connect KV (0.1), then build the **goal-aftershock (1.1)** while live
   matches are on to test it — it's the one feature that raises the ceiling on
   Originality *and* Real-Time, and it's the money shot of the demo.
2. **Then:** add **moment markers (1.2)** — cheap, visible, reinforces 1.1.
3. **Then:** record the **demo (0.2)** with a 60s round window, and file the form (0.3).
4. Everything else (SSE, Floor, PWA) is upside only if time remains. Do not add
   breadth before the video exists.
