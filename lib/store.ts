/**
 * Tiny localStorage-backed player store for the MVP.
 * M4 swaps this for a real backend so leagues sync across devices.
 */

import { Bot, DEFAULT_BOTS } from "./game";

export type Player = {
  address: string; // Solana address (stubbed in MVP)
  name: string;
  points: number;
  streak: number;
  bestStreak: number;
  rounds: number;
};

export type Persisted = {
  player: Player | null;
  bots: Bot[];
  league: string;
  /** Invite code of the real league this player sits at (null = house table). */
  leagueCode: string | null;
};

const KEY = "ballroom.v2"; // v2: honest house-player names/league labels

const DEFAULT: Persisted = {
  player: null,
  bots: DEFAULT_BOTS.map((b) => ({ ...b })),
  league: "House Table",
  leagueCode: null,
};

export function load(): Persisted {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Persisted;
    // Merge in default bots if missing
    if (!parsed.bots?.length) parsed.bots = DEFAULT.bots.map((b) => ({ ...b }));
    return parsed;
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
    address: address ?? fakeAddress(),
    name: name.trim() || "You",
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

/** Placeholder for a real Solana address until wallet-adapter lands (M3). */
export function fakeAddress(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
