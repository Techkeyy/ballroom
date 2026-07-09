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

// ---- on-chain activation (pre-token; uses only the guest JWT) --------------

/** Ask TxLINE for a partially-signed purchase tx the user's wallet will sign. */
export async function requestPurchaseQuote(
  buyerPubkey: string,
  txlineAmount: number,
): Promise<{
  baseUsdtCost: string;
  feeUsdtAmount: string;
  totalUsdtCharged: string;
  transactionBase64: string;
}> {
  const res = await fetch(`${BASE}/guest/purchase/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await guestJwt()}`,
    },
    body: JSON.stringify({ buyerPubkey, txlineAmount }),
  });
  if (!res.ok) throw new Error(`purchase/quote -> ${res.status}`);
  return res.json();
}

/** Exchange a confirmed on-chain subscription for a long-lived API token. */
export async function activateToken(
  txSig: string,
  walletSignature: string,
  leagues: number[],
): Promise<{ token: string }> {
  const res = await fetch(`${BASE}/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await guestJwt()}`,
    },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  if (!res.ok) throw new Error(`token/activate -> ${res.status}`);
  return res.json();
}

// ---- documented response shapes (subset we use) ---------------------------

type FixtureSnapshot = {
  FixtureId: number;
  StartTime: string;
  Competition: string;
  CompetitionId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
};

type OddsSnapshot = {
  FixtureId: number;
  Ts: number;
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
  Seq?: number;
  Ts?: number;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: {
    Participant1?: { Total?: ScorePeriod };
    Participant2?: { Total?: ScorePeriod };
  };
  Participant1IsHome?: boolean;
};

// ---- mapping --------------------------------------------------------------

function code(name: string): string {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "???";
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
): { part1: number; part2: number } | null {
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
  return {
    part1: Math.round((nums[0] / sum) * 1000) / 10,
    part2: Math.round((nums[2] / sum) * 1000) / 10,
  };
}

async function fetchOddsFor(fixtureId: number): Promise<OddsSnapshot[]> {
  try {
    return await get<OddsSnapshot[]>(`/odds/snapshot/${fixtureId}`);
  } catch {
    return [];
  }
}

async function fetchScoreFor(fixtureId: number): Promise<ScoreSnapshot | null> {
  try {
    const events = await get<ScoreSnapshot[]>(`/scores/snapshot/${fixtureId}`);
    if (!Array.isArray(events) || !events.length) return null;
    // latest event message wins
    return events.reduce((a, b) => ((b.Seq ?? 0) > (a.Seq ?? 0) ? b : a));
  } catch {
    return null;
  }
}

/** Live World Cup fixtures with their current market win probability. */
export async function fetchWorldCupMatches(): Promise<Match[]> {
  const fixtures = await get<FixtureSnapshot[]>(
    `/fixtures/snapshot?competitionId=${COMPETITION_ID}`,
  );

  const built = await Promise.all(
    fixtures.map(async (f) => {
      const odds = await fetchOddsFor(f.FixtureId);
      const pcts = participantPcts(odds);
      if (pcts == null) return null;
      const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
      const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
      const p = f.Participant1IsHome ? pcts.part1 : pcts.part2;
      const point: OddsPoint = { t: Date.now(), p };
      const match: Match = {
        id: String(f.FixtureId),
        home,
        away,
        homeCode: code(home),
        awayCode: code(away),
        minute: 0,
        scoreHome: 0,
        scoreAway: 0,
        current: p,
        history: [point],
      };
      return match;
    }),
  );

  return built.filter((m): m is Match => m !== null);
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

/** Latest market win probability (+ best-effort scoreline) for one fixture. */
export async function fetchMatchPoint(
  fixtureId: string,
): Promise<{ p: number; minute: number; scoreHome: number; scoreAway: number } | null> {
  const id = Number(fixtureId);
  const [odds, score, p1Home] = await Promise.all([
    fetchOddsFor(id),
    fetchScoreFor(id),
    participant1IsHome(id),
  ]);
  const pcts = participantPcts(odds);
  if (pcts == null) return null;
  const pct = p1Home ? pcts.part1 : pcts.part2;

  const secs = score?.Clock?.Seconds ?? 0;
  const p1Goals = score?.Score?.Participant1?.Total?.Goals ?? 0;
  const p2Goals = score?.Score?.Participant2?.Total?.Goals ?? 0;
  const scoreP1IsHome = score?.Participant1IsHome ?? p1Home;
  return {
    p: pct,
    minute: secs > 0 ? Math.min(120, Math.ceil(secs / 60)) : 0,
    scoreHome: scoreP1IsHome ? p1Goals : p2Goals,
    scoreAway: scoreP1IsHome ? p2Goals : p1Goals,
  };
}
