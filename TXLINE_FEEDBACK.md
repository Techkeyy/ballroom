# TxLINE API — Builder Feedback

Written from actually shipping a live product against the mainnet World Cup tier.
Overall: the data is rich, the schema is genuinely uniform across markets, and the
on-chain-verifiable angle is a real differentiator. The friction we hit was almost
all in the *edges* — activation, schema drift between the docs and the wire, and
snapshot flakiness right around a market opening.

## What we liked most

- **One normalised schema across markets.** `1X2_PARTICIPANT_RESULT`,
  `ASIANHANDICAP_*`, `OVERUNDER_*` all share the `PriceNames`/`Prices`/`Pct`
  shape. Adding draw/away and (next) totals calling was almost free once the
  first market was wired.
- **Demargined `Pct` out of the box.** Getting a clean, overround-stripped
  probability without doing the vig math ourselves was a big head start — the
  whole product is "predict this number," so having it be *the fair number* was
  perfect.
- **On-chain validation proofs.** `odds/validation` returning a real Merkle
  branch let us build **verifiably-real receipts** — the single most original
  feature in our submission, and impossible on a normal feed.
- **The free World Cup tier being a real on-chain subscribe** (no payment) meant
  "sign up through Solana" and "use TxLINE" collapsed into one action. Elegant.

## Friction / bugs we hit (with specifics)

### 1. `odds/snapshot` is lumpy right as a market opens
The same fixture, hit with fresh guest sessions seconds apart, returned **17
records, then 1, then 0**. Not our caching — confirmed via raw `curl`. We had to
build a retry-and-prefer-the-full-1X2-line fetch plus a server-side last-good
cache so the number wouldn't blank out. A "market is settling, retry" hint, or an
`isComplete`/generation field on the snapshot, would save every builder from
reimplementing this.

### 2. Docs (OpenAPI camelCase) vs. wire (PascalCase) drift on scores
The scores objects on the wire are **PascalCase** (`Clock.Seconds`,
`Score.Participant1.Total.Goals`, `GameState`, `Seq`) while the API reference
reads camelCase. We only got it right by dumping live responses. Aligning the
reference to the actual payload (or documenting the casing explicitly) would cut
the integration time noticeably.

### 3. Scores snapshot is a stream of event messages, some empty — and corrections go *down*
`scores/snapshot` returns an array where some entries are `action_discarded` and
carry corners but no goals. Naively taking "latest by `Seq`" gave us a **stuck /
wrong scoreline**; naively taking the **max across events** gave us a *different*
wrong scoreline, because **goal totals get corrected downward**: in France v
Spain (fixture 18237038) the away total read **3 at Seq 638**, then was
**corrected to 2 from Seq 844** (VAR-disallowed goal) — a running max serves the
phantom goal forever. The aggregation that actually works is "per side, the
latest event that *carries* a goals reading wins." A documented "current
cumulative state" object separate from the event log — or an explicit
`correction` flag on amending events — would remove a real footgun.

### 4. `InRunning` is an unreliable "is this match live?" signal
We initially derived live-ness from `odds.some(InRunning === true)`. During a
real live match (verified: minute 50, 1–0) the in-running flag flickered false as
snapshots dropped the in-running line, so our UI briefly showed **"FT" at 66'**.
We switched to driving live/finished off the **scores clock/minute** instead.
A single authoritative match-status enum (`scheduled | live | ht | finished`) on
the scores feed would be the cleanest fix — `GameState` read `"scheduled"` for
the *entire lifecycle* of a real match in our data (including after full time),
so it wasn't usable for this. What we reverse-engineered instead: `StatusId`
walks 1 → 2/3/4 (in play, `3` looked like half-time) → 5 → **100 (finished)**,
and at full time the **odds snapshot empties entirely (0 records)** — so
"odds present + InRunning" can't distinguish FT from a transient odds miss
either. Documenting the `StatusId` enum would have saved us the most time of
anything on this list.

### 5. On-chain activation papercuts
- The `subscribe` instruction needs the user's **TxL associated token account to
  already exist** (Token-2022) or it fails with `AccountNotInitialized (0xbc4)`.
  We had to prepend an idempotent ATA-create. Worth a one-line note in the
  quickstart, since the free tier requires no TxL and a first-time wallet won't
  have the ATA.
- `token/activate` returned a **raw-text token** (`txoracle_api_…`), not JSON, so
  `res.json()` threw. We handle both now; documenting the response type would
  help.
- The activation signature is bound to a specific guest JWT
  (`${txSig}:${leagues}:${jwt}`) — obvious in hindsight, but easy to trip on if
  you mint a fresh JWT between signing and activating.

### 6. Minor
- `competitionId` for the World Cup is **72** (Friendlies **430**); the docs'
  activation example uses `500001`, which sent us looking. A "here are the World
  Cup competition ids" line would help.
- Fixtures snapshot has no end-date filter (`startEpochDay` only bounds the
  start and returns ~30 days out), so we filter "today" client-side by the
  viewer's timezone. An end bound would be nice.

## Net
We shipped a fully working, real-time, multiplayer product on this API in days,
including a feature (Solana-verified receipts) that literally can't exist without
it. Fixing the snapshot-completeness signal, the scores casing/state docs, and
the activation papercuts would take the integration from "figured it out by
dumping responses" to "followed the docs and it worked."

Process note: everything above was observed on **mainnet service level 12
(real-time)**, so none of it is tier-delay artefact — and we log fixture id +
service level with every anomaly so coverage gaps can be reported per the
recommended escalation path. Next integration step on our side is the
`/api/odds/stream` + `/api/scores/stream` SSE endpoints to replace snapshot
polling (faster goal detection for aftershock rounds, fewer requests).
