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
export const SHARP_BAR = 55;

/**
 * Skill-based round scoring, measured against the naive "no-change" baseline.
 *
 * The old model scored raw closeness to the final number — which meant just
 * echoing the current number scored high whenever the market was calm (i.e.
 * almost always). This scores how well you read the MOVE:
 *
 *   err     = |guess  - actual|     how close your call landed
 *   baseErr = |startProb - actual|  how close doing nothing would've been (= the move size)
 *
 * · READ (max 65) — how much you beat the parrot baseline. Echo the opening
 *   number and you score ~0 here; nail a real swing and you bank most of it.
 * · PRECISION (max 40) — a steeper closeness reward, so accuracy still matters.
 *
 * So: parroting a calm round scores modestly, parroting through a big move is
 * punished, and reading a genuine swing is where the points live.
 *   e.g. move +12, nail it (err 1) -> ~92 ; parrot that move (err 12) -> ~4
 *        calm round, err 2         -> ~27 ; read a small move (err 0.5) -> ~77
 */
export function scoreCall(guess: number, actual: number, startProb: number): number {
  const err = Math.abs(guess - actual);
  const baseErr = Math.abs(startProb - actual);
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const read = 65 * clamp01((baseErr - err) / Math.max(baseErr, 4));
  const precision = 40 * Math.exp(-err / 5);
  return Math.round(read + precision);
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

/** A short, human verdict for the result card (tuned to the skill-score curve). */
export function verdict(points: number): { label: string; tone: "gold" | "green" | "grey" } {
  if (points >= 80) return { label: "Sniper", tone: "gold" };
  if (points >= 55) return { label: "Sharp read", tone: "green" };
  if (points >= 28) return { label: "In the mix", tone: "green" };
  return { label: "Off the pace", tone: "grey" };
}
