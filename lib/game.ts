/**
 * Ball Room game logic: closest-to-the-pin scoring, streaks, verdicts.
 * No synthetic players — solo rounds score against a "sharp" bar, league rounds
 * score you against the real humans at your table (see lib/league-server.ts).
 */

// The round clock. In live football the market barely moves over ~90s, so a
// 5-minute window gives a real event (chance, corner, momentum swing) time to
// shift the odds — that's where football IQ pays off. Env-configurable so a
// demo can drop it to ~60s (NEXT_PUBLIC_ROUND_SECONDS=60) for recording.
// The real answer is per-round-type windows (goal aftershock) — see ROADMAP.
export const PREDICT_WINDOW_MS =
  Number(process.env.NEXT_PUBLIC_ROUND_SECONDS ?? 300) * 1000;

/** A round score at/above this is "sharp" — keeps a solo streak alive. */
export const SHARP_BAR = 50;

/**
 * Closeness scoring with exponential decay.
 * err = |guess - actual| in percentage points.
 *   err 0  -> 100 pts
 *   err 5  -> ~61
 *   err 10 -> ~37
 *   err 20 -> ~14
 * Everyone who plays scores something; precision is richly rewarded.
 */
export function scoreGuess(guess: number, actual: number): number {
  const err = Math.abs(guess - actual);
  return Math.round(100 * Math.exp(-err / 10));
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function nextStreak(current: number, kept: boolean): number {
  return kept ? current + 1 : 0;
}

/** A short, human verdict for the result card. */
export function verdict(points: number): { label: string; tone: "gold" | "green" | "grey" } {
  if (points >= 90) return { label: "Sniper", tone: "gold" };
  if (points >= 65) return { label: "Sharp read", tone: "green" };
  if (points >= 35) return { label: "In the mix", tone: "green" };
  return { label: "Off the pace", tone: "grey" };
}
