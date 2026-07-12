/**
 * Real TxLINE integration — SERVER ONLY (holds the API token, never shipped
 * to the browser). Consumed by the route handlers in app/api/txline/*.
 *
 * Built against the documented OpenAPI schema
 * (https://txline.txodds.com/docs/docs.yaml):
 *
 *   Auth:      POST /auth/guest/start            -> { token: jwt }
 *              data calls send  Authorization: Bearer <jwt>  +  X-Api-Token: <apiToken>
 *   Fixtures:  GET  /api/fixtures/snapshot?competitionId=..&startEpochDay=..
 *   Odds:      GET  /api/odds/snapshot/{fixtureId}         (latest per market line)
 *              GET  /api/odds/updates/{fixtureId}          (live updates)
 *   Scores:    GET  /api/scores/snapshot/{fixtureId}
 *
 * The apiToken comes from on-chain activation (POST /api/token/activate with a
 * signed Solana tx). For the World Cup free tier, drop the activated token into
 * TXLINE_API_TOKEN. See BUILD_PLAN.md §"Solana = the TxLINE subscription".
 */

import type { Match, OddsPoint } from "./txline";

const BASE = process.env.TXLINE_BASE_URL ?? "https://txline.txodds.com/api";
const API_TOKEN = process.env.TXLINE_API_TOKEN ?? "";
// World Cup competition id. Confirm against your activated `leagues`; the docs'
// activation example uses 500001.
const COMPETITION_ID = Number(process.env.TXLINE_COMPETITION_ID ?? "500001");

// ---- auth -----------------------------------------------------------------

let cachedJwt: { token: string; at: number } | null = null;

async function guestJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.at < 10 * 60_000) return cachedJwt.token;
  const res = await fetch(`${BASE.replace(/\/api$/, "")}/auth/guest/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`guest/start ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  cachedJwt = { token, at: Date.now() };
  return token;
}

async function authedHeaders(): Promise<Record<string, string>> {
  if (!API_TOKEN) {
    throw new Error(
      "TXLINE_API_TOKEN is not set. Activate the World Cup tier on-chain, then set it in .env.local (or keep NEXT_PUBLIC_TXLINE_MOCK=true).",
    );
  }
  return {
    Authorization: `Bearer ${await guestJwt()}`,
    "X-Api-Token": API_TOKEN,
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: await authedHeaders() });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// (On-chain activation lives client-side in lib/txline-activate.ts — the wallet
// signature is bound to the guest JWT, so the server only proxies; see
// app/api/txline/jwt and app/api/txline/activate.)

// ---- documented response shapes (subset we use) ---------------------------

type FixtureSnapshot = {
  FixtureId: number;
  StartTime: number; // epoch ms (confirmed live: e.g. 1783627200000)
  Competition: string;
  CompetitionId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
};

type OddsSnapshot = {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker?: string;
  SuperOddsType: string; // market type, e.g. match result / 1X2
  InRunning: boolean;
  MarketPeriod: string; // e.g. full-time
  PriceNames: string[]; // e.g. ["1","X","2"] or ["Home","Draw","Away"]
  Prices: number[];
  Pct: string[]; // implied probability per outcome, "XX.XXX" or "NA"
};

// Confirmed live schema (devnet, fixture 18209181): an array of event messages;
// latest = highest Seq. Clock.Seconds runs, Score is nested per-period totals.
type ScorePeriod = { Goals?: number; Corners?: number };
type ScoreSnapshot = {
  FixtureId: number;
  GameState?: string;
  StatusId?: number;
  Seq?: number;
  Ts?: number;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: {
    Participant1?: { Total?: ScorePeriod; HT?: ScorePeriod };
    Participant2?: { Total?: ScorePeriod; HT?: ScorePeriod };
  };
  Participant1IsHome?: boolean;
};

// ---- mapping --------------------------------------------------------------

// Proper 3-letter national codes (FIFA-style). Falls back to first 3 letters
// only for anything unmapped.
const TEAM_CODES: Record<string, string> = {
  Argentina: "ARG", Australia: "AUS", Austria: "AUT", Belgium: "BEL",
  Brazil: "BRA", Cameroon: "CMR", Canada: "CAN", Chile: "CHI",
  Colombia: "COL", Croatia: "CRO", Denmark: "DEN", Ecuador: "ECU",
  Egypt: "EGY", England: "ENG", France: "FRA", Germany: "GER",
  Ghana: "GHA", Greece: "GRE", Iran: "IRN", Italy: "ITA",
  Japan: "JPN", Mexico: "MEX", Morocco: "MAR", Netherlands: "NED",
  Nigeria: "NGA", Norway: "NOR", Peru: "PER", Poland: "POL",
  Portugal: "POR", Qatar: "QAT", "Saudi Arabia": "KSA", Scotland: "SCO",
  Senegal: "SEN", Serbia: "SRB", "South Korea": "KOR", Spain: "ESP",
  Sweden: "SWE", Switzerland: "SUI", Tunisia: "TUN", Turkey: "TUR",
  Ukraine: "UKR", Uruguay: "URU", USA: "USA", "United States": "USA",
  Wales: "WAL",
};

function code(name: string): string {
  const clean = name.trim();
  if (TEAM_CODES[clean]) return TEAM_CODES[clean];
  return clean.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "???";
}

/**
 * Extract each participant's win probability from a fixture's odds snapshots.
 *
 * Confirmed schema (live devnet, fixture 18209181 FRA–MAR):
 *   SuperOddsType "1X2_PARTICIPANT_RESULT", PriceNames ["part1","draw","part2"],
 *   Pct ["61.652","24.073","14.282"] — TXLineStablePriceDemargined, so the
 *   overround is already stripped. MarketPeriod null = full match ("half=1" =
 *   first-half line — excluded). Latest Ts wins; prefer InRunning when live.
 */
const RESULT_MARKET = "1X2_PARTICIPANT_RESULT";

function participantPcts(
  snapshots: OddsSnapshot[],
): { part1: number; draw: number; part2: number; messageId: string; ts: number } | null {
  const candidates = snapshots.filter(
    (s) =>
      s.SuperOddsType === RESULT_MARKET &&
      !s.MarketPeriod && // null/"" = full match
      s.PriceNames?.length === 3 &&
      s.Pct?.length === 3 &&
      s.Pct[0] !== "NA",
  );
  if (!candidates.length) return null;

  const live = candidates.filter((s) => s.InRunning);
  const pool = live.length ? live : candidates;
  const latest = pool.reduce((a, b) => (b.Ts > a.Ts ? b : a));

  const nums = latest.Pct.map((p) => parseFloat(p));
  const sum = nums.reduce((a, b) => a + b, 0);
  if (!sum || nums.some((n) => isNaN(n))) return null;
  // Demargined already, but normalise anyway so the three sum to exactly 100.
  const r = (n: number) => Math.round((n / sum) * 1000) / 10;
  return {
    part1: r(nums[0]), // participant 1 result
    draw: r(nums[1]),
    part2: r(nums[2]), // participant 2 result
    messageId: latest.MessageId,
    ts: latest.Ts,
  };
}

// ---- validation proofs ------------------------------------------------------

export type OddsProof = {
  odds: OddsSnapshot;
  summary: unknown;
  subTreeProof: Array<{ hash: string; isRightSibling: boolean }>;
  mainTreeProof: Array<{ hash: string; isRightSibling: boolean }>;
};

/** Merkle proof for one odds update — the batch root is anchored on Solana. */
export async function fetchOddsValidation(
  messageId: string,
  ts: number,
): Promise<OddsProof | null> {
  try {
    return await get<OddsProof>(
      `/odds/validation?messageId=${encodeURIComponent(messageId)}&ts=${ts}`,
    );
  } catch (err) {
    console.error("[txline] odds validation fetch failed:", err);
    return null;
  }
}

async function fetchOddsFor(fixtureId: number): Promise<OddsSnapshot[]> {
  try {
    return await get<OddsSnapshot[]>(`/odds/snapshot/${fixtureId}`);
  } catch {
    return [];
  }
}

/**
 * TxLINE's odds/snapshot occasionally returns a partial batch right as a
 * market opens (observed: the same fixture returning 17, then 1, then 0
 * records within seconds — genuinely flaky upstream, not a caching bug on our
 * side). Retry a few times and prefer whichever read actually has the 3-way
 * result line before giving up.
 */
async function fetchOddsForResilient(fixtureId: number): Promise<OddsSnapshot[]> {
  let best: OddsSnapshot[] = [];
  for (let i = 0; i < 3; i++) {
    const data = await fetchOddsFor(fixtureId);
    if (data.some((o) => o.SuperOddsType === RESULT_MARKET && !o.MarketPeriod)) return data;
    if (data.length > best.length) best = data;
    if (i < 2) await new Promise((r) => setTimeout(r, 350));
  }
  return best;
}

async function fetchScoreFor(fixtureId: number): Promise<ScoreSnapshot | null> {
  let events: ScoreSnapshot[] = [];
  for (let i = 0; i < 2; i++) {
    try {
      const e = await get<ScoreSnapshot[]>(`/scores/snapshot/${fixtureId}`);
      if (Array.isArray(e) && e.length) {
        events = e;
        break;
      }
    } catch {
      /* retry */
    }
    if (i < 1) await new Promise((r) => setTimeout(r, 300));
  }
  if (!events.length) return null;

  // The snapshot is a stream of event messages (some are "discarded" and carry
  // no score). Aggregate the truth: goals & clock only ever climb, so take the
  // max across all events; use the newest event for status/orientation.
  const latest = events.reduce((a, b) => ((b.Seq ?? 0) > (a.Seq ?? 0) ? b : a));
  const goals = (side: "Participant1" | "Participant2") =>
    Math.max(
      0,
      ...events.map(
        (e) => e.Score?.[side]?.Total?.Goals ?? e.Score?.[side]?.HT?.Goals ?? 0,
      ),
    );
  const maxSecs = Math.max(0, ...events.map((e) => e.Clock?.Seconds ?? 0));
  const anyRunning = events.some((e) => e.Clock?.Running);

  return {
    ...latest,
    Clock: { Running: anyRunning, Seconds: maxSecs },
    Score: {
      Participant1: { Total: { Goals: goals("Participant1") } },
      Participant2: { Total: { Goals: goals("Participant2") } },
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Today" in the VIEWER's local calendar day, not UTC — TxLINE's fixtures
 * endpoint has no end-date filter (`startEpochDay` only bounds the start, and
 * returns up to 30 days out), so we fetch the default window and filter here.
 * tzOffsetMin is `Date.getTimezoneOffset()` from the browser (minutes to ADD
 * to local time to reach UTC).
 */
function todayWindowUTC(tzOffsetMin: number): { start: number; end: number } {
  const nowUTC = Date.now();
  const nowLocal = nowUTC - tzOffsetMin * 60_000;
  const localDayStart = Math.floor(nowLocal / DAY_MS) * DAY_MS;
  const start = localDayStart + tzOffsetMin * 60_000;
  return { start, end: start + DAY_MS };
}

/** World Cup fixtures with their current market number, scoreline and live flag. */
export async function fetchWorldCupMatches(tzOffsetMin = 0): Promise<Match[]> {
  const fixtures = await get<FixtureSnapshot[]>(
    `/fixtures/snapshot?competitionId=${COMPETITION_ID}`,
  );
  // warm the orientation cache so per-fixture reads don't refetch the list
  for (const f of fixtures) fixtureOrientation.set(f.FixtureId, f.Participant1IsHome);

  const { start, end } = todayWindowUTC(tzOffsetMin);

  const built = await Promise.all(
    fixtures.map(async (f) => {
      // Keep it if it kicks off in the viewer's "today". (Live fixtures pass
      // through fetchMatchPoint's own live-flag below regardless of window.)
      const inTodayWindow = f.StartTime >= start && f.StartTime < end;
      const pt = await fetchMatchPoint(String(f.FixtureId));
      if (!inTodayWindow && !pt?.live) return null;

      const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
      const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;

      // TxLINE hasn't published a market for this fixture yet (common many
      // hours before kickoff) — still show it, just without a real number.
      if (!pt) {
        const match: Match = {
          id: String(f.FixtureId),
          home,
          away,
          homeCode: code(home),
          awayCode: code(away),
          kickoff: f.StartTime,
          minute: 0,
          scoreHome: 0,
          scoreAway: 0,
          current: 50,
          drawPct: 0,
          awayPct: 0,
          live: false,
          oddsAvailable: false,
          history: [],
        };
        return match;
      }

      const match: Match = {
        id: String(f.FixtureId),
        home,
        away,
        homeCode: code(home),
        awayCode: code(away),
        kickoff: f.StartTime,
        minute: pt.minute,
        scoreHome: pt.scoreHome,
        scoreAway: pt.scoreAway,
        current: pt.p,
        drawPct: pt.pDraw,
        awayPct: pt.pAway,
        live: pt.live,
        finished: pt.finished,
        oddsAvailable: true,
        history: [{ t: Date.now(), p: pt.p }],
      };
      return match;
    }),
  );

  // live first, then soonest kickoff (upcoming before finished)
  return built
    .filter((m): m is Match => m !== null)
    .sort((a, b) => {
      if (Boolean(a.live) !== Boolean(b.live)) return Number(b.live) - Number(a.live);
      if (Boolean(a.finished) !== Boolean(b.finished)) {
        return Number(a.finished) - Number(b.finished);
      }
      return (a.kickoff ?? 0) - (b.kickoff ?? 0);
    });
}

// Cache fixture home/away orientation so per-tick polls don't refetch the list.
const fixtureOrientation = new Map<number, boolean>(); // FixtureId -> Participant1IsHome

async function participant1IsHome(fixtureId: number): Promise<boolean> {
  const cached = fixtureOrientation.get(fixtureId);
  if (cached !== undefined) return cached;
  try {
    const fixtures = await get<FixtureSnapshot[]>(
      `/fixtures/snapshot?competitionId=${COMPETITION_ID}`,
    );
    for (const f of fixtures) fixtureOrientation.set(f.FixtureId, f.Participant1IsHome);
  } catch {
    /* fall through to default */
  }
  return fixtureOrientation.get(fixtureId) ?? true;
}

export type MatchPoint = {
  p: number; // home win %
  pDraw: number;
  pAway: number;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  messageId: string;
  ts: number;
  live: boolean;
  finished: boolean;
};

// Last good reading per fixture. A partial TxLINE failure (odds OR scores) must
// never regress the number to 0/flat — we hold the last known values instead.
// This is what kills the "connecting/disconnecting" flap.
const lastPoint = new Map<number, MatchPoint & { at: number }>();


/** Latest market win probability + scoreline + live flag for one fixture. */
export async function fetchMatchPoint(fixtureId: string): Promise<MatchPoint | null> {
  const id = Number(fixtureId);
  const [odds, score, p1Home] = await Promise.all([
    fetchOddsForResilient(id),
    fetchScoreFor(id),
    participant1IsHome(id),
  ]);
  const prev = lastPoint.get(id);
  const pcts = participantPcts(odds);

  // --- odds: use fresh, else hold last good ---
  let p: number, pDraw: number, pAway: number, messageId: string, ts: number;
  if (pcts) {
    p = p1Home ? pcts.part1 : pcts.part2;
    pAway = p1Home ? pcts.part2 : pcts.part1;
    pDraw = pcts.draw;
    messageId = pcts.messageId;
    ts = pcts.ts;
  } else if (prev) {
    p = prev.p;
    pDraw = prev.pDraw;
    pAway = prev.pAway;
    messageId = prev.messageId;
    ts = prev.ts;
  } else {
    return null; // never had a reading
  }

  // --- score/minute: use fresh, else hold; never run backwards ---
  let minute = prev?.minute ?? 0;
  let scoreHome = prev?.scoreHome ?? 0;
  let scoreAway = prev?.scoreAway ?? 0;
  let clockRunning = false;
  let finished = false;
  if (score) {
    const secs = score.Clock?.Seconds ?? 0;
    clockRunning = Boolean(score.Clock?.Running);
    finished = isFinishedState(score);
    const sHome = score.Participant1IsHome ?? p1Home;
    // prefer Total goals; fall back to summing HT if Total is absent
    const p1Goals =
      score.Score?.Participant1?.Total?.Goals ??
      score.Score?.Participant1?.HT?.Goals ??
      0;
    const p2Goals =
      score.Score?.Participant2?.Total?.Goals ??
      score.Score?.Participant2?.HT?.Goals ??
      0;
    const freshMin = secs > 0 ? Math.min(130, Math.ceil(secs / 60)) : 0;
    if (freshMin > 0) minute = Math.max(minute, freshMin);
    // goals only ever climb within a match
    scoreHome = Math.max(scoreHome, sHome ? p1Goals : p2Goals);
    scoreAway = Math.max(scoreAway, sHome ? p2Goals : p1Goals);
  }

  // --- live vs finished ---
  // A match is LIVE whenever the clock has started (minute > 0) or the odds are
  // in-running — UNLESS the feed says it's finished. Driving off the minute (not
  // just the InRunning flag) fixes matches that showed "FT" at 66'.
  const oddsLive = odds.some((o) => o.InRunning === true);
  const live = !finished && (minute > 0 || oddsLive || clockRunning);

  const point: MatchPoint = {
    p, pDraw, pAway, minute, scoreHome, scoreAway, messageId, ts, live, finished,
  };
  lastPoint.set(id, { ...point, at: Date.now() });
  return point;
}

// Best-effort "match is over" detection from the scores feed. Conservative —
// when unsure we treat it as NOT finished, so a live match never shows FT.
function isFinishedState(score: ScoreSnapshot): boolean {
  const gs = (score.GameState ?? "").toLowerCase();
  if (/finish|full.?time|\bft\b|ended|after.?extra|penalt|abandon|postpon/.test(gs)) {
    return true;
  }
  // Known TxLINE finished status ids (best-effort); extend as confirmed.
  if (score.StatusId != null && [100, 110].includes(score.StatusId)) return true;
  return false;
}
