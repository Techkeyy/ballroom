/**
 * TxLINE data adapter.
 *
 * Exposes a stable shape the whole app codes against:
 *   - getLiveMatches()          -> list of live matches with their current market %
 *   - subscribeToMatch(id, cb)  -> streams OddsPoints on a live cadence, returns unsubscribe
 *
 * Two implementations sit behind that shape:
 *   - SIMULATOR (default)  a realistic random-walk odds model with goal shocks.
 *                          No API key, always demoable, works with zero live matches.
 *   - REAL TxLINE          same shape, backed by the World Cup Fixtures/Odds/Scores
 *                          endpoints. See fetchRealMatches / subscribeRealMatch below.
 *
 * Toggle with NEXT_PUBLIC_TXLINE_MOCK ("true" = simulator).
 */

export type OddsPoint = {
  t: number; // epoch ms
  p: number; // home win probability, 0..100
  pDraw?: number;
  pAway?: number;
};

export type Leg = "home" | "draw" | "away";

export function legValue(pt: { p: number; pDraw?: number; pAway?: number }, leg: Leg): number {
  if (leg === "draw") return pt.pDraw ?? 0;
  if (leg === "away") return pt.pAway ?? 0;
  return pt.p;
}

export type Match = {
  id: string;
  home: string;
  away: string;
  homeCode: string; // 3-letter code, used for the flag chip
  awayCode: string;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  current: number; // current home win probability, 0..100
  drawPct?: number;
  awayPct?: number;
  /** Kickoff time, epoch ms — set for every fixture, used to show "kicks off HH:MM" pre-match. */
  kickoff?: number;
  /** False when TxLINE hasn't published a market for this fixture yet (common
   * many hours before kickoff). The fixture still shows — with a "not open
   * yet" state instead of a real number. Undefined/true = normal. */
  oddsAvailable?: boolean;
  history: OddsPoint[];
  /** True only when the fixture is actually in-play (clock started, not finished). */
  live?: boolean;
  /** True when the match has ended. */
  finished?: boolean;
  /** Identity of the TxLINE odds update behind `current` (live mode only) —
   * lets a resolved round anchor to a Merkle-proven oracle message. */
  marketMessageId?: string;
  marketTs?: number;
};

/** The live value of one leg of a Match's 3-way market. */
export function legValueOf(m: Match, leg: Leg): number {
  if (leg === "draw") return m.drawPct ?? 0;
  if (leg === "away") return m.awayPct ?? 0;
  return m.current;
}

const USE_MOCK =
  (process.env.NEXT_PUBLIC_TXLINE_MOCK ?? "true").toLowerCase() !== "false";

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

type SimState = {
  meta: Omit<Match, "current" | "history">;
  p: number;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  history: OddsPoint[];
  // internal drift toward a slowly wandering "true" probability
  anchor: number;
};

const SEED_MATCHES: Array<Omit<Match, "current" | "history">> = [
  { id: "arg-mex", home: "Argentina", away: "Mexico", homeCode: "ARG", awayCode: "MEX", minute: 34, scoreHome: 1, scoreAway: 0 },
  { id: "fra-mar", home: "France", away: "Morocco", homeCode: "FRA", awayCode: "MAR", minute: 52, scoreHome: 0, scoreAway: 0 },
  { id: "bra-ned", home: "Brazil", away: "Netherlands", homeCode: "BRA", awayCode: "NED", minute: 11, scoreHome: 0, scoreAway: 1 },
  { id: "eng-usa", home: "England", away: "USA", homeCode: "ENG", awayCode: "USA", minute: 67, scoreHome: 2, scoreAway: 2 },
];

const START_PROB: Record<string, number> = {
  "arg-mex": 68,
  "fra-mar": 55,
  "bra-ned": 41,
  "eng-usa": 49,
};

const sims = new Map<string, SimState>();

function gaussian(): number {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampProb(p: number): number {
  return Math.max(2, Math.min(98, p));
}

function getSim(id: string): SimState {
  let s = sims.get(id);
  if (!s) {
    const meta = SEED_MATCHES.find((m) => m.id === id) ?? SEED_MATCHES[0];
    const start = START_PROB[id] ?? 50;
    const now = Date.now();
    // Backfill ~40 points of history so the chart isn't empty on first paint.
    const history: OddsPoint[] = [];
    let p = start;
    for (let i = 40; i > 0; i--) {
      p = clampProb(p + gaussian() * 1.4);
      history.push({ t: now - i * 1000, p: Math.round(p * 10) / 10 });
    }
    s = {
      meta,
      p,
      minute: meta.minute,
      scoreHome: meta.scoreHome,
      scoreAway: meta.scoreAway,
      history,
      anchor: start,
    };
    sims.set(id, s);
  }
  return s;
}

// Draw probability shrinks as either side pulls further ahead — same shape
// bookmakers use, just crude: peaks ~26% at a 50/50 game, thins out at the edges.
function drawFromHome(pHome: number): number {
  const balance = 1 - Math.abs(pHome - 50) / 50; // 1 at 50/50, 0 at the extremes
  return 12 + balance * 16;
}

function stepSim(s: SimState): OddsPoint {
  // The anchor is where the market "believes" the match is heading; it wanders slowly.
  s.anchor = clampProb(s.anchor + gaussian() * 0.6);

  // Occasional shock: a big chance or a goal. ~4% of ticks.
  const roll = Math.random();
  if (roll < 0.02) {
    // GOAL — sharp swing + scoreline change
    const homeScores = Math.random() < s.p / 100;
    if (homeScores) {
      s.scoreHome += 1;
      s.anchor = clampProb(s.anchor + 22);
    } else {
      s.scoreAway += 1;
      s.anchor = clampProb(s.anchor - 26);
    }
    s.p = clampProb(s.p + (homeScores ? 20 : -24) + gaussian() * 2);
  } else if (roll < 0.06) {
    // Big chance / near miss — noticeable jump, no goal
    s.p = clampProb(s.p + gaussian() * 5);
  } else {
    // Normal churn: mean-revert toward anchor + small noise
    s.p = clampProb(s.p + (s.anchor - s.p) * 0.08 + gaussian() * 1.1);
  }

  if (Math.random() < 0.25 && s.minute < 90) s.minute += 1;

  const pDraw = drawFromHome(s.p);
  const pAway = Math.max(1, 100 - s.p - pDraw);
  const point: OddsPoint = {
    t: Date.now(),
    p: Math.round(s.p * 10) / 10,
    pDraw: Math.round(pDraw * 10) / 10,
    pAway: Math.round(pAway * 10) / 10,
  };
  s.history.push(point);
  if (s.history.length > 180) s.history.shift();
  return point;
}

function simMatch(s: SimState): Match {
  const last = s.history[s.history.length - 1];
  return {
    ...s.meta,
    minute: s.minute,
    scoreHome: s.scoreHome,
    scoreAway: s.scoreAway,
    current: Math.round(s.p * 10) / 10,
    drawPct: last?.pDraw,
    awayPct: last?.pAway,
    history: [...s.history],
  };
}

// ---------------------------------------------------------------------------
// Real TxLINE (wire these when NEXT_PUBLIC_TXLINE_MOCK=false)
// ---------------------------------------------------------------------------

// The browser talks to our own server routes (app/api/txline/*), which hold the
// TxLINE token and map fixtures + odds `Pct` into the Match shape above. The
// server routes back onto lib/txline-server.ts.

async function fetchRealMatches(): Promise<Match[]> {
  // Tell the server which local calendar day is "today" for this viewer.
  const tz = typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;
  const res = await fetch(`/api/txline/matches?tz=${tz}`, { cache: "no-store" });
  const body = (await res.json()) as { matches: Match[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `matches ${res.status}`);
  return body.matches;
}

async function fetchRealMatch(id: string): Promise<Match | null> {
  const all = await fetchRealMatches();
  return all.find((m) => m.id === id) ?? null;
}

/**
 * Live subscription in real mode.
 *
 * Two decoupled loops so the chart moves smoothly ("snake") even though the
 * network is slower and lumpier:
 *   - FETCH loop (~1s): pulls the resilient server point (odds + score + live).
 *     The server holds last-good values, so a transient miss never blanks us —
 *     no connect/disconnect flap.
 *   - RENDER loop (~120ms): eases a displayed value toward the latest real
 *     target and appends a chart point every tick, so the line glides.
 *
 * The big number (`current`) always shows the *real* target (accurate); only
 * the chart `history` uses the eased display value (smooth).
 * M-next: swap the fetch loop for the TxLINE SSE stream (/api/odds/stream).
 */
function subscribeRealMatch(
  id: string,
  onPoint: (p: OddsPoint, match: Match) => void,
): () => void {
  const history: OddsPoint[] = [];
  let stopped = false;

  type Target = {
    p: number;
    pDraw: number;
    pAway: number;
    minute: number;
    scoreHome: number;
    scoreAway: number;
    live: boolean;
    finished: boolean;
    messageId?: string;
    ts?: number;
    home: string;
    away: string;
    homeCode: string;
    awayCode: string;
    kickoff?: number;
    oddsAvailable: boolean;
  };
  let target: Target | null = null;
  let display = 50;
  let displayDraw = 25;
  let displayAway = 25;

  fetchRealMatch(id).then((m) => {
    if (m && !stopped) {
      display = m.current;
      displayDraw = m.drawPct ?? 25;
      displayAway = m.awayPct ?? 25;
      target = {
        p: m.current,
        pDraw: m.drawPct ?? 0,
        pAway: m.awayPct ?? 0,
        minute: m.minute,
        scoreHome: m.scoreHome,
        scoreAway: m.scoreAway,
        live: Boolean(m.live),
        finished: Boolean(m.finished),
        home: m.home,
        away: m.away,
        homeCode: m.homeCode,
        awayCode: m.awayCode,
        kickoff: m.kickoff,
        oddsAvailable: m.oddsAvailable !== false,
      };
    }
  });

  async function pull() {
    try {
      const res = await fetch(`/api/txline/match/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const pt = (await res.json()) as {
        p: number;
        pDraw?: number;
        pAway?: number;
        minute: number;
        scoreHome: number;
        scoreAway: number;
        live?: boolean;
        finished?: boolean;
        messageId?: string;
        ts?: number;
      };
      target = {
        ...(target ?? {
          home: "Home",
          away: "Away",
          homeCode: "HOM",
          awayCode: "AWY",
        }),
        p: pt.p,
        pDraw: pt.pDraw ?? 0,
        pAway: pt.pAway ?? 0,
        minute: pt.minute,
        scoreHome: pt.scoreHome,
        scoreAway: pt.scoreAway,
        live: Boolean(pt.live),
        finished: Boolean(pt.finished),
        messageId: pt.messageId,
        ts: pt.ts,
        oddsAvailable: true, // a 200 response means fetchMatchPoint found a real market
      };
    } catch {
      /* hold last target — the server already holds last-good */
    }
  }

  const fetchLoop = setInterval(pull, 1000);
  pull();

  const renderLoop = setInterval(() => {
    if (!target) return;
    // No market yet — don't animate or record fake history points.
    let point: OddsPoint;
    if (!target.oddsAvailable) {
      point = { t: Date.now(), p: target.p, pDraw: target.pDraw, pAway: target.pAway };
    } else {
      // ease each leg toward its real value; snap when essentially there
      const ease = (cur: number, tgt: number) =>
        Math.abs(tgt - cur) < 0.08 ? tgt : cur + (tgt - cur) * 0.28;
      display = ease(display, target.p);
      displayDraw = ease(displayDraw, target.pDraw);
      displayAway = ease(displayAway, target.pAway);
      point = {
        t: Date.now(),
        p: Math.round(display * 100) / 100,
        pDraw: Math.round(displayDraw * 100) / 100,
        pAway: Math.round(displayAway * 100) / 100,
      };
      history.push(point);
      if (history.length > 220) history.shift();
    }
    const match: Match = {
      id,
      home: target.home,
      away: target.away,
      homeCode: target.homeCode,
      awayCode: target.awayCode,
      minute: target.minute,
      scoreHome: target.scoreHome,
      scoreAway: target.scoreAway,
      current: target.p, // accurate real value for the big number
      drawPct: target.pDraw,
      awayPct: target.pAway,
      kickoff: target.kickoff,
      live: target.live,
      finished: target.finished,
      oddsAvailable: target.oddsAvailable,
      history: [...history],
      marketMessageId: target.messageId,
      marketTs: target.ts,
    };
    onPoint(point, match);
  }, 120);

  return () => {
    stopped = true;
    clearInterval(fetchLoop);
    clearInterval(renderLoop);
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getLiveMatches(): Promise<Match[]> {
  if (!USE_MOCK) return fetchRealMatches();
  return SEED_MATCHES.map((m) => simMatch(getSim(m.id)));
}

export async function getMatch(id: string): Promise<Match | null> {
  if (!USE_MOCK) {
    const all = await fetchRealMatches();
    return all.find((m) => m.id === id) ?? null;
  }
  if (!SEED_MATCHES.some((m) => m.id === id)) return null;
  return simMatch(getSim(id));
}

/**
 * Streams live odds points for a match. Returns an unsubscribe function.
 * Cadence is ~1s to feel live; the real adapter should match the feed rate.
 */
export function subscribeToMatch(
  id: string,
  onPoint: (p: OddsPoint, match: Match) => void,
): () => void {
  if (!USE_MOCK) {
    return subscribeRealMatch(id, onPoint);
  }
  const s = getSim(id);
  const interval = setInterval(() => {
    const point = stepSim(s);
    onPoint(point, simMatch(s));
  }, 1000);
  return () => clearInterval(interval);
}

export const dataSource = USE_MOCK ? "simulator" : "txline";
