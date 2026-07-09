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
};

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
  history: OddsPoint[];
};

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

  const point: OddsPoint = { t: Date.now(), p: Math.round(s.p * 10) / 10 };
  s.history.push(point);
  if (s.history.length > 180) s.history.shift();
  return point;
}

function simMatch(s: SimState): Match {
  return {
    ...s.meta,
    minute: s.minute,
    scoreHome: s.scoreHome,
    scoreAway: s.scoreAway,
    current: Math.round(s.p * 10) / 10,
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
  const res = await fetch("/api/txline/matches", { cache: "no-store" });
  const body = (await res.json()) as { matches: Match[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `matches ${res.status}`);
  return body.matches;
}

async function fetchRealMatch(id: string): Promise<Match | null> {
  const all = await fetchRealMatches();
  return all.find((m) => m.id === id) ?? null;
}

/**
 * Live subscription in real mode: poll our server route (which reads the TxLINE
 * odds/scores snapshots) on a ~1.5s cadence and accumulate history client-side.
 * M-next: swap this poll for the TxLINE SSE stream (/api/odds/stream) proxied
 * through a server route.
 */
function subscribeRealMatch(
  id: string,
  onPoint: (p: OddsPoint, match: Match) => void,
): () => void {
  const history: OddsPoint[] = [];
  let meta: Match | null = null;
  let stopped = false;

  fetchRealMatch(id).then((m) => {
    if (m && !stopped) {
      meta = m;
      history.push(...m.history);
    }
  });

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/txline/match/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const pt = (await res.json()) as {
        p: number;
        minute: number;
        scoreHome: number;
        scoreAway: number;
      };
      const point: OddsPoint = { t: Date.now(), p: pt.p };
      history.push(point);
      if (history.length > 180) history.shift();
      const match: Match = {
        ...(meta ?? {
          id,
          home: "Home",
          away: "Away",
          homeCode: "HOM",
          awayCode: "AWY",
        }),
        minute: pt.minute,
        scoreHome: pt.scoreHome,
        scoreAway: pt.scoreAway,
        current: pt.p,
        history: [...history],
      } as Match;
      meta = match;
      onPoint(point, match);
    } catch {
      /* transient network error — keep polling */
    }
  }, 1500);

  return () => {
    stopped = true;
    clearInterval(interval);
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
