/**
 * Client-side league API — thin fetch wrappers over app/api/league/*.
 */

import type { League } from "./league-server";
export type { League, LeagueMember } from "./league-server";

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

export async function reportRoundToLeague(
  code: string,
  address: string,
  gained: number,
  beatCrowd: boolean,
): Promise<void> {
  try {
    await req(`/api/league/${code}`, {
      method: "PUT",
      body: JSON.stringify({ address, gained, beatCrowd }),
    });
  } catch {
    /* best-effort — local score still updates */
  }
}

export function leagueLink(code: string): string {
  if (typeof window === "undefined") return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}
