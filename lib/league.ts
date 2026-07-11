/**
 * Client-side league API — thin fetch wrappers over app/api/league/*.
 */

import type { League, LeagueRound, Leg, FeedItem } from "./league-server";
export type { League, LeagueMember, LeagueRound, RoundResult, Leg, FeedItem } from "./league-server";

// Client-side copy of the allowed reactions (kept in sync with the server's
// FEED_EMOJI, which validates them). Defined here so importing it doesn't pull
// the server-only league-server module into the client bundle.
export const FEED_EMOJI = ["🔥", "🎯", "😂", "😱", "👏", "💀"] as const;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${url} ${res.status}`);
  return body;
}

export async function createLeague(
  name: string,
  address: string,
  playerName: string,
): Promise<League> {
  const { league } = await req<{ league: League }>("/api/league", {
    method: "POST",
    body: JSON.stringify({ name, address, playerName }),
  });
  return league;
}

export async function joinLeague(
  code: string,
  address: string,
  playerName: string,
): Promise<League> {
  const { league } = await req<{ league: League }>(`/api/league/${code}`, {
    method: "POST",
    body: JSON.stringify({ address, playerName }),
  });
  return league;
}

export async function fetchLeague(code: string): Promise<League | null> {
  try {
    const { league } = await req<{ league: League }>(`/api/league/${code}`);
    return league;
  } catch {
    return null;
  }
}

type MatchMeta = { home: string; away: string; homeCode: string };

/**
 * Open (or fetch) the current synchronized round for a match. `leg` is only
 * honored when a fresh round is actually being opened — a round already live
 * keeps whichever leg it started with.
 */
export async function openRound(
  code: string,
  matchId: string,
  meta: MatchMeta,
  leg?: Leg,
): Promise<LeagueRound | null> {
  try {
    const { round } = await req<{ round: LeagueRound | null }>(
      `/api/league/${code}/round`,
      { method: "POST", body: JSON.stringify({ matchId, ...meta, open: true, leg }) },
    );
    return round;
  } catch {
    return null;
  }
}

/** Poll the current round (lazily resolves when the clock runs out). */
export async function fetchRound(
  code: string,
  matchId: string,
  meta: MatchMeta,
  leg?: Leg,
): Promise<LeagueRound | null> {
  const q = new URLSearchParams({ matchId, ...meta, ...(leg ? { leg } : {}) }).toString();
  try {
    const { round } = await req<{ round: LeagueRound | null }>(
      `/api/league/${code}/round?${q}`,
    );
    return round;
  } catch {
    return null;
  }
}

/** Lock this player's guess into the live round. */
export async function lockGuess(
  code: string,
  matchId: string,
  roundId: string,
  address: string,
  name: string,
  guess: number,
): Promise<LeagueRound | null> {
  try {
    const { round } = await req<{ round: LeagueRound | null }>(
      `/api/league/${code}/round`,
      {
        method: "PUT",
        body: JSON.stringify({ matchId, roundId, address, name, guess }),
      },
    );
    return round;
  } catch {
    return null;
  }
}

// ---- table feed -------------------------------------------------------------

export async function fetchFeed(code: string): Promise<FeedItem[]> {
  try {
    const { items } = await req<{ items: FeedItem[] }>(`/api/league/${code}/feed`);
    return items;
  } catch {
    return [];
  }
}

export async function postChat(
  code: string,
  address: string,
  name: string,
  text: string,
): Promise<FeedItem[] | null> {
  try {
    const { items } = await req<{ items: FeedItem[] }>(`/api/league/${code}/feed`, {
      method: "POST",
      body: JSON.stringify({ kind: "chat", address, name, text }),
    });
    return items;
  } catch {
    return null;
  }
}

export async function postReact(
  code: string,
  address: string,
  name: string,
  emoji: string,
): Promise<FeedItem[] | null> {
  try {
    const { items } = await req<{ items: FeedItem[] }>(`/api/league/${code}/feed`, {
      method: "POST",
      body: JSON.stringify({ kind: "react", address, name, emoji }),
    });
    return items;
  } catch {
    return null;
  }
}

/** Leave a table server-side (best-effort — local state clears regardless). */
export async function leaveLeague(code: string, address: string): Promise<void> {
  try {
    await req(`/api/league/${code}/leave`, {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  } catch {
    /* local leave still applies */
  }
}

export function leagueLink(code: string): string {
  if (typeof window === "undefined") return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}
