/**
 * localStorage-backed player identity + local (solo) score.
 * League play is server-authoritative (lib/league-server.ts); this only holds
 * who you are and your solo tally.
 */

export type Player = {
  address: string; // Solana wallet address (or a throwaway for guest play)
  name: string;
  points: number;
  streak: number;
  bestStreak: number;
  rounds: number;
};

export type Persisted = {
  player: Player | null;
  /** Display name of the table you sit at. */
  league: string;
  /** Invite code of the real league (null = solo play). */
  leagueCode: string | null;
};

const KEY = "ballroom.v3"; // v3: bots removed, server-authoritative leagues

const DEFAULT: Persisted = {
  player: null,
  league: "Solo",
  leagueCode: null,
};

export function load(): Persisted {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return JSON.parse(raw) as Persisted;
  } catch {
    return DEFAULT;
  }
}

export function save(state: Persisted): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

/**
 * Sign in. Pass a real Solana address (from a connected wallet) when available;
 * falls back to a throwaway address for the no-wallet guest/demo path.
 */
export function signIn(name: string, address?: string): Persisted {
  const state = load();
  state.player = {
    // "You" collided with the "— you" self-marker in the leaderboard, so the
    // host looked like the viewer. Names are required in the UI now; this is a
    // last-ditch fallback only.
    address: address ?? fakeAddress(),
    name: name.trim() || "Guest",
    points: 0,
    streak: 0,
    bestStreak: 0,
    rounds: 0,
  };
  save(state);
  return state;
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/** Seat this player at a real league table. */
export function setLeague(code: string, name: string): Persisted {
  const state = load();
  state.leagueCode = code.toUpperCase();
  state.league = name;
  save(state);
  return state;
}

/** Throwaway address for the no-wallet guest path. */
export function fakeAddress(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
