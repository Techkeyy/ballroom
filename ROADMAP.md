# Ball Room — 10x Roadmap

Cross-referenced against the TxODDS "Consumer and Fan Experiences" judging criteria.
Deadline: **submissions close July 19, 2026, 23:59 UTC.** Today's build is a working
end-to-end product on live devnet TxLINE data; this roadmap is ranked by
**points-per-day against the actual rubric**, not by ambition.

Judging criteria shorthand used below:
**UX** = Fan Accessibility & UX · **RT** = Real-Time Responsiveness ·
**OR** = Originality & Value Creation · **COM** = Commercial & Monetization ·
**EX** = Completeness & Execution

---

## P0 — Submission-critical (must land before July 19)

### 0.1 Mainnet real-time feed (service level 12)
Devnet free tier is 60-second delayed. Level 12 is **zero-delay and free** — the
number visibly breathes during the demo video, which judges weight heavily.
**Criteria:** RT (primary), EX
**Work:** run `scripts/activate-freetier.mjs --network mainnet --level 12` with a
funded wallet (~$0.01 SOL fees); swap `TXLINE_BASE_URL` + `TXLINE_API_TOKEN` in Vercel.
**Acceptance:**
- [ ] `/api/txline/matches` served from `txline.txodds.com` (mainnet host)
- [ ] Market % on the match screen changes within ~2s of the raw feed changing
- [ ] Demo video shows the number moving during live play, timestamped against the broadcast

### 0.2 Real leagues — invite links + shared tables
The core social loop is currently local-only with labelled house players. Real
friends racing each other is the product's whole thesis — and the single biggest
UX/OR unlock. Small scope: one Upstash Redis (or Vercel KV) store, no auth beyond
the wallet address already in hand.
**Criteria:** UX + OR (primary), COM
**Work:** `POST /api/league` (create, returns code) · `/join/[code]` route ·
league members + per-round calls keyed in KV · leaderboard reads KV instead of
localStorage · house players fill seats only until 2+ humans join.
**Acceptance:**
- [ ] Create league → shareable link (`ballroom-eight.vercel.app/join/XXXX`)
- [ ] Second device joins via link, appears on the first device's table within 5s
- [ ] Both players lock calls on the same round; resolve shows both scores ranked
- [ ] House players visibly labelled and auto-benched when ≥2 humans are seated

### 0.3 Match moments on the heartbeat (goals, cards, big swings)
The Scores stream already flows through our adapter. Plotting **goal/red-card
markers on the gold thread** connects "what happened on the pitch" to "what the
market did" — the exact fan-comprehension moment the track description asks for.
**Criteria:** RT + UX (primary), OR
**Work:** extend `fetchMatchPoint` to surface latest event type; drop vertical
markers + minute labels on the Heartbeat SVG; toast on goal ("GOAL — market
repricing").
**Acceptance:**
- [ ] A goal in the raw feed renders a marker on the chart within one poll cycle
- [ ] Marker shows minute + event type on tap/hover
- [ ] Round in progress is annotated if a goal lands inside the window ("goal mid-round")

### 0.4 OG-image receipts
The share card is the viral loop, but a copied text blob doesn't unfurl. A
`/r/[id]` page + `next/og` image makes every brag a rendered gold ticket in
WhatsApp/X — each share is an ad.
**Criteria:** COM + UX (primary)
**Work:** persist resolved rounds (same KV as 0.2) · `/r/[id]` page with
`opengraph-image` route rendering the engraved-ticket layout (Satori: pass
`fonts` array; no text-stroke).
**Acceptance:**
- [ ] "Share the receipt" copies a URL, not a text blob
- [ ] Pasting the URL in X/WhatsApp unfurls the gold ticket image with the numbers
- [ ] Receipt page has one CTA: "Take a seat" → landing

### 0.5 Submission package
**Criteria:** gate for all of them — no video, no screening pass.
**Work:** ≤5-min video (problem → live walkthrough during a real match → how
TxLINE powers it) · `DOCS.md` (core idea, business/technical highlights, exact
TxLINE endpoints used) · API feedback write-up (we have real material: raw-text
activate response, PascalCase vs OpenAPI camelCase scores mismatch, ATA
pre-create requirement, competitionId discovery).
**Acceptance:**
- [ ] Video link (Loom/YouTube) under 5 minutes, recorded during a live match
- [ ] Public repo README links: deployed app, video, DOCS.md
- [ ] Feedback section drafted into the Superteam submission form

---

## P1 — The 10x layer (build in order until time runs out)

### 1.1 Verified receipts — Solana-anchored proof (the originality spike)
TxLINE anchors its data on-chain and exposes **Merkle validation proofs**
(`/api/odds/validation`). Attach the proof to each resolved round: a receipt
that *cryptographically proves* the market really was at 8% when you called it.
No other fan app can fake-proof a hot take. This is the deepest possible
TxLINE integration and the cleanest OR points on the board.
**Criteria:** OR (primary), COM — and it makes "sign up through Solana" load-bearing
**Acceptance:**
- [ ] Resolved round stores the odds update id + Merkle proof from `/api/odds/validation`
- [ ] Receipt page shows "VERIFIED ON SOLANA" with a link that independently checks the proof
- [ ] Tampered numbers fail verification in the checker

### 1.2 SSE streaming (kill the poll)
Swap the 1.5s REST poll for TxLINE's `/api/odds/stream` + `/api/scores/stream`
(Server-Sent Events), proxied through one route handler. Sub-second thread.
**Criteria:** RT
**Acceptance:**
- [ ] One SSE connection per viewed match, auto-reconnect on drop
- [ ] p95 feed-to-pixel latency < 1s on mainnet level 12
- [ ] Poll code path remains as fallback behind an env flag

### 1.3 Round variety — the session extender
One 45s round type gets stale by minute 60. Add: **pre-match calls** (lock
before kickoff, resolve at 15′), **halftime specials** (call the 46′ reopen),
**goal aftershock** (goal lands → 90s round on where the market settles).
**Criteria:** UX (session length), OR
**Acceptance:**
- [ ] Round picker with 2+ live types during any match; aftershock auto-offers within 10s of a goal
- [ ] Each type has distinct copy + scoring window; receipts name the round type

### 1.4 The Floor — multi-match excitement router
One screen ranking all live matches by **market volatility right now** (rolling
σ of the win-prob series — already in client memory). "Which game should I be
watching?" — RedZone for the market. During group stages with simultaneous
kickoffs this is the killer view; still useful across knockout evenings.
**Criteria:** OR + UX
**Acceptance:**
- [ ] `/floor` ranks live matches by 5-min volatility, updating without reload
- [ ] Tapping a row lands in the match screen in one tap
- [ ] Top mover carries a visible "moving now" treatment

### 1.5 PWA + kickoff notifications
Phones are the stated context ("most fans… with a phone in their hand").
Add manifest + service worker + push ("Spain v Belgium is open — the table is
seated").
**Criteria:** UX, COM (retention)
**Acceptance:**
- [ ] Add-to-home-screen works (Lighthouse PWA installable)
- [ ] Opted-in device gets a push at kickoff of a followed match
- [ ] App opens from the notification directly into that match

---

## P2 — Post-hackathon / monetization narrative (document, don't build)

These go in DOCS.md as the commercial path (COM criterion is judged on
*clarity of path*, not shipped billing):

- **Sponsored rounds** — "this 45-second window presented by …"; native, non-intrusive, priced per impression during peak moments.
- **Premium tables** — bigger leagues, season-long standings, custom round types; entry passes settled on Solana.
- **Creator receipts** — embeddable verified-receipt widgets for pundits/streamers; the proof layer (1.1) is the moat.
- **B2B** — the excitement-router signal (1.4) licensed to broadcasters/whip-around shows.

---

## Explicitly out of scope (and why)

- **Real-money anything** — the track warns on gambling law; skill-only is a feature.
- **Native mobile apps** — PWA covers the demo; app-store cycles don't fit 9 days.
- **AI pundit bot / hi-lo stats game** — those are the brief's own example ideas; building them scores repackaging, not originality.
- **Custom Solana program** — TxLINE's subscribe program + message-signing already make the wallet load-bearing; new on-chain code is EX risk with no rubric payoff.

## Requirements cross-check (current status)

| Hackathon requirement | Status |
|---|---|
| Live product working during a match | ✅ verified live (devnet); 0.1 upgrades to real-time mainnet |
| TxLINE as live input | ✅ Fixtures/Odds/Scores snapshots; 1.2 adds streams, 1.1 adds Validation Proofs |
| Sign up through Solana | ✅ wallet sign-in + on-chain TxLINE subscription (one wallet action) |
| Deployed link | ✅ ballroom-eight.vercel.app |
| Public repo | ✅ |
| Demo video ≤5 min | ⬜ 0.5 |
| Technical documentation | ⬜ 0.5 |
| API feedback | ⬜ 0.5 (material already collected) |
| Functional, not mockup | ✅ full loop playable end-to-end |
