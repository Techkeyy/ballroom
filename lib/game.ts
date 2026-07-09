/**
 * Ball Room game logic: closest-to-the-pin scoring, streaks, and the
 * synthetic "crowd" of bot friends that keeps the leaderboard alive from
 * the very first session (solving the cold-start problem a real
 * you-vs-the-crowd game would have).
 */

export const PREDICT_WINDOW_MS = 45_000; // demo window; real product ~5 min

export type Round = {
  matchId: string;
  startProb: number; // market % at lock time
  guess: number; // player's guess for where it lands
  actual: number | null; // market % when the window closed
  points: number | null;
  beatCrowd: boolean | null;
  at: number; // epoch ms
};

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

export type Bot = {
  id: string;
  name: string;
  skill: number; // 0..1, lower = noisier guesser
  points: number;
};

export const DEFAULT_BOTS: Bot[] = [
  { id: "b1", name: "Tunde", skill: 0.8, points: 0 },
  { id: "b2", name: "Marco", skill: 0.55, points: 0 },
  { id: "b3", name: "Priya", skill: 0.68, points: 0 },
  { id: "b4", name: "Dee", skill: 0.42, points: 0 },
  { id: "b5", name: "Sam", skill: 0.73, points: 0 },
];

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Each bot guesses off the market at lock time: it expects the number to
 * roughly hold, plus noise scaled by (1 - skill). Sharper bots hug closer.
 */
export function botGuess(startProb: number, bot: Bot): number {
  const spread = 3 + (1 - bot.skill) * 12;
  const g = startProb + gaussian() * spread;
  return Math.max(2, Math.min(98, Math.round(g * 10) / 10));
}

export type CrowdResult = {
  botScores: Array<{ bot: Bot; guess: number; points: number }>;
  crowdMedianPoints: number;
};

export function scoreCrowd(startProb: number, actual: number, bots: Bot[]): CrowdResult {
  const botScores = bots.map((bot) => {
    const guess = botGuess(startProb, bot);
    return { bot, guess, points: scoreGuess(guess, actual) };
  });
  const pts = botScores.map((b) => b.points).sort((a, b) => a - b);
  const mid = Math.floor(pts.length / 2);
  const crowdMedianPoints =
    pts.length % 2 ? pts[mid] : Math.round((pts[mid - 1] + pts[mid]) / 2);
  return { botScores, crowdMedianPoints };
}

export function nextStreak(current: number, beatCrowd: boolean): number {
  return beatCrowd ? current + 1 : 0;
}

/** A short, human verdict for the result card. */
export function verdict(points: number): { label: string; tone: "gold" | "green" | "grey" } {
  if (points >= 90) return { label: "Sniper", tone: "gold" };
  if (points >= 65) return { label: "Sharp read", tone: "green" };
  if (points >= 35) return { label: "In the mix", tone: "green" };
  return { label: "Off the pace", tone: "grey" };
}
