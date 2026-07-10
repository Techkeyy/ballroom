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

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

// ---- storage backends -------------------------------------------------------

// Dev fallback lives on globalThis — Next bundles each route separately, so a
// plain module-level Map would give every route its own (empty) copy.
const g = globalThis as unknown as { __ballroomLeagues?: Map<string, League> };
const localStore = (g.__ballroomLeagues ??= new Map<string, League>());

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

/**
 * Record a resolved round for a member (client-reported for the MVP — a
 * server-authoritative resolve is the hardening step, noted in ROADMAP).
 */
export async function reportRound(
  code: string,
  address: string,
  gained: number,
  beatCrowd: boolean,
): Promise<League | null> {
  const league = await getLeague(code);
  if (!league) return null;
  const m = league.members[address];
  if (!m) return null;

  // clamp to the scoring function's actual range
  const pts = Math.max(0, Math.min(100, Math.round(gained)));
  m.points += pts;
  m.rounds += 1;
  m.streak = beatCrowd ? m.streak + 1 : 0;
  m.bestStreak = Math.max(m.bestStreak, m.streak);
  m.lastSeen = Date.now();

  await putLeague(league);
  return league;
}
