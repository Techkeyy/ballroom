/**
 * League persistence — SERVER ONLY.
 *
 * Backed by Vercel KV when provisioned (KV_REST_API_URL/KV_REST_API_TOKEN are
 * auto-injected once the KV store is connected to the project). Falls back to
 * an in-process Map for local dev — fine on one dev server, resets on restart.
 *
 * Model (one JSON blob per league — small tables, low contention):
 *   league:{code} -> {
 *     name, createdAt,
 *     members: { [address]: { name, points, streak, bestStreak, rounds, lastSeen } }
 *   }
 */

import { PREDICT_WINDOW_MS, scoreGuess, median } from "./game";
import { fetchMatchPoint } from "./txline-server";

export type LeagueMember = {
  name: string;
  points: number;
  streak: number;
  bestStreak: number;
  rounds: number;
  lastSeen: number;
};

export type League = {
  code: string;
  name: string;
  createdAt: number;
  members: Record<string, LeagueMember>;
};

/**
 * A synchronized round: one shared clock per (league, match). Every seated
 * player calls the SAME question with the SAME deadline; the server reads the
 * live TxLINE market at open (startProb) and at resolve (actual), scores all
 * guesses at once, and ranks the humans. Server-authoritative — clients can't
 * fake the market or the timing.
 */
export type RoundGuess = { name: string; guess: number; at: number };
export type RoundResult = { name: string; guess: number; points: number; rank: number };

/** Which leg of the 3-way match-result market the round is calling. */
export type Leg = "home" | "draw" | "away";

function legValue(m: { p: number; pDraw: number; pAway: number }, leg: Leg): number {
  if (leg === "draw") return m.pDraw;
  if (leg === "away") return m.pAway;
  return m.p;
}

export type LeagueRound = {
  id: string;
  matchId: string;
  home: string;
  away: string;
  homeCode: string;
  leg: Leg;
  startProb: number;
  openedAt: number;
  deadline: number;
  resolved: boolean;
  actual: number | null;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  guesses: Record<string, RoundGuess>;
  results: Record<string, RoundResult> | null;
  // oracle identity of the market read at resolve (for verified receipts)
  marketMessageId?: string;
  marketTs?: number;
};

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

// ---- storage backends -------------------------------------------------------

// Dev fallback lives on globalThis — Next bundles each route separately, so a
// plain module-level Map would give every route its own (empty) copy.
const g = globalThis as unknown as {
  __ballroomLeagues?: Map<string, League>;
  __ballroomRounds?: Map<string, LeagueRound>;
};
const localStore = (g.__ballroomLeagues ??= new Map<string, League>());
const roundStore = (g.__ballroomRounds ??= new Map<string, LeagueRound>());

async function kvGet(code: string): Promise<League | null> {
  const { kv } = await import("@vercel/kv");
  return (await kv.get<League>(`league:${code}`)) ?? null;
}

async function kvSet(league: League): Promise<void> {
  const { kv } = await import("@vercel/kv");
  // Leagues live for the tournament + a buffer (60 days).
  await kv.set(`league:${league.code}`, league, { ex: 60 * 24 * 60 * 60 });
}

export async function getLeague(code: string): Promise<League | null> {
  const c = code.toUpperCase();
  if (HAS_KV) return kvGet(c);
  return localStore.get(c) ?? null;
}

async function putLeague(league: League): Promise<void> {
  if (HAS_KV) return kvSet(league);
  localStore.set(league.code, league);
}

async function getRoundRaw(key: string): Promise<LeagueRound | null> {
  if (HAS_KV) {
    const { kv } = await import("@vercel/kv");
    return (await kv.get<LeagueRound>(`round:${key}`)) ?? null;
  }
  return roundStore.get(key) ?? null;
}

async function putRound(key: string, round: LeagueRound): Promise<void> {
  if (HAS_KV) {
    const { kv } = await import("@vercel/kv");
    await kv.set(`round:${key}`, round, { ex: 24 * 60 * 60 });
  } else {
    roundStore.set(key, round);
  }
}

export const storageMode = HAS_KV ? "kv" : "memory";

// ---- operations -------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function newCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

export async function createLeague(
  name: string,
  creator: { address: string; name: string },
): Promise<League> {
  let code = newCode();
  // avoid collisions (tiny space, but cheap to check)
  for (let i = 0; i < 5 && (await getLeague(code)); i++) code = newCode();

  const league: League = {
    code,
    name: name.trim().slice(0, 32) || "The Table",
    createdAt: Date.now(),
    members: {
      [creator.address]: {
        name: creator.name.slice(0, 24),
        points: 0,
        streak: 0,
        bestStreak: 0,
        rounds: 0,
        lastSeen: Date.now(),
      },
    },
  };
  await putLeague(league);
  return league;
}

export async function joinLeague(
  code: string,
  member: { address: string; name: string },
): Promise<League | null> {
  const league = await getLeague(code);
  if (!league) return null;
  if (!league.members[member.address]) {
    if (Object.keys(league.members).length >= 24) {
      throw new Error("This table is full (24 seats).");
    }
    league.members[member.address] = {
      name: member.name.slice(0, 24),
      points: 0,
      streak: 0,
      bestStreak: 0,
      rounds: 0,
      lastSeen: Date.now(),
    };
    await putLeague(league);
  }
  return league;
}

// ---- synchronized rounds ----------------------------------------------------

const REVEAL_MS = 9_000; // how long a resolved round lingers before a new one opens

function roundKey(code: string, matchId: string): string {
  return `${code.toUpperCase()}:${matchId}`;
}

type MarketPoint = Awaited<ReturnType<typeof fetchMatchPoint>>;

// Last good market read per fixture, so a transient null (odds momentarily
// unavailable / a slow call) doesn't block opening or resolving a round.
const gm = globalThis as unknown as {
  __ballroomMarket?: Map<string, { p: NonNullable<MarketPoint>; at: number }>;
};
const marketCache = (gm.__ballroomMarket ??= new Map());

/** Read the live market for a fixture (server-authoritative source of truth),
 * with one retry and a short-lived fallback to the last good read. */
async function readMarket(matchId: string): Promise<MarketPoint> {
  for (let i = 0; i < 3; i++) {
    const p = await fetchMatchPoint(matchId).catch(() => null);
    if (p) {
      marketCache.set(matchId, { p, at: Date.now() });
      return p;
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 400));
  }
  const cached = marketCache.get(matchId);
  if (cached && Date.now() - cached.at < 120_000) return cached.p;
  return null;
}

/**
 * Resolve a round exactly once: read the live market, score every guess,
 * rank the humans, fold results into member totals + streaks.
 */
async function resolveRound(code: string, round: LeagueRound): Promise<LeagueRound> {
  if (round.resolved) return round;

  const market = await readMarket(round.matchId);
  const actual = market ? legValue(market, round.leg) : round.startProb; // degrade to flat if unread
  round.actual = actual;
  if (market) {
    round.minute = market.minute;
    round.scoreHome = market.scoreHome;
    round.scoreAway = market.scoreAway;
    round.marketMessageId = market.messageId;
    round.marketTs = market.ts;
  }

  const entries = Object.entries(round.guesses);
  const scored = entries.map(([addr, gg]) => ({
    addr,
    name: gg.name,
    guess: gg.guess,
    points: scoreGuess(gg.guess, actual),
  }));
  const med = median(scored.map((s) => s.points));

  // rank: highest points first
  const ranked = [...scored].sort((a, b) => b.points - a.points);
  const results: Record<string, RoundResult> = {};
  ranked.forEach((s, i) => {
    results[s.addr] = { name: s.name, guess: s.guess, points: s.points, rank: i + 1 };
  });
  round.results = results;
  round.resolved = true;

  // fold into league totals
  const league = await getLeague(code);
  if (league) {
    for (const s of scored) {
      const m = league.members[s.addr];
      if (!m) continue;
      const kept = s.points >= med; // held or beat the table this round
      m.points += s.points;
      m.rounds += 1;
      m.streak = kept ? m.streak + 1 : 0;
      m.bestStreak = Math.max(m.bestStreak, m.streak);
      m.lastSeen = Date.now();
    }
    await putLeague(league);
  }

  return round;
}

/**
 * The current round for (league, match). Lazily resolves a round whose clock
 * has run out (resolution happens on read — no cron needed), and opens a fresh
 * round once the last one has been revealed for a beat.
 */
export async function getOrOpenRound(
  code: string,
  matchId: string,
  meta: { home: string; away: string; homeCode: string },
  opts: { open?: boolean; leg?: Leg } = {},
): Promise<LeagueRound | null> {
  const key = roundKey(code, matchId);
  const now = Date.now();
  let round = await getRoundRaw(key);

  if (round && !round.resolved && now >= round.deadline) {
    round = await resolveRound(code, round);
    await putRound(key, round);
    return round;
  }
  // A round already live is locked to whichever leg it opened with — the
  // requested leg only takes effect on the NEXT round.
  if (round && !round.resolved) return round;
  if (round && round.resolved && now - round.deadline < REVEAL_MS && !opts.open) {
    return round; // still revealing results
  }

  // open a fresh round — needs a live market read for startProb
  const market = await readMarket(matchId);
  if (!market) return round ?? null; // can't open without the market
  const leg: Leg = opts.leg ?? "home";
  const fresh: LeagueRound = {
    id: `${matchId}-${now}`,
    matchId,
    home: meta.home,
    away: meta.away,
    homeCode: meta.homeCode,
    leg,
    startProb: legValue(market, leg),
    openedAt: now,
    deadline: now + PREDICT_WINDOW_MS,
    resolved: false,
    actual: null,
    minute: market.minute,
    scoreHome: market.scoreHome,
    scoreAway: market.scoreAway,
    guesses: {},
    results: null,
  };
  await putRound(key, fresh);
  return fresh;
}

/** Lock a member's guess into the current live round (before the deadline). */
export async function lockRoundGuess(
  code: string,
  matchId: string,
  roundId: string,
  address: string,
  name: string,
  guess: number,
): Promise<LeagueRound | null> {
  const key = roundKey(code, matchId);
  const round = await getRoundRaw(key);
  if (!round || round.id !== roundId) return round ?? null;
  if (round.resolved || Date.now() >= round.deadline) return round; // too late
  round.guesses[address] = {
    name: name.slice(0, 24),
    guess: Math.max(2, Math.min(98, Math.round(guess * 10) / 10)),
    at: Date.now(),
  };
  await putRound(key, round);
  return round;
}
