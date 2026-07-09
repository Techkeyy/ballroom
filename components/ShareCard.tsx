"use client";

/**
 * The receipt — an engraved card you drop in the group chat.
 * M5 renders this same layout as an OG image for native unfurls.
 */

import { verdict } from "@/lib/game";

export default function ShareCard({
  match,
  startProb,
  guess,
  actual,
  points,
  streak,
  playerName,
  onPlayAgain,
}: {
  match: { home: string; away: string; homeCode: string; minute: number };
  startProb: number;
  guess: number;
  actual: number;
  points: number;
  streak: number;
  playerName: string;
  onPlayAgain: () => void;
}) {
  const v = verdict(points);
  const err = Math.round(Math.abs(guess - actual) * 10) / 10;
  const move = Math.round((actual - startProb) * 10) / 10;

  const brag =
    `BALL ROOM — ${match.home} ${match.minute}'\n` +
    `Market moved ${startProb} to ${actual} (${move >= 0 ? "+" : ""}${move}).\n` +
    `Called ${guess} — off by ${err}. ${v.label}. +${points} pts, streak ${streak}.\n` +
    `Read the market, not the match.`;

  const gold = v.tone === "gold";

  return (
    <div className="animate-riseIn space-y-4">
      {/* engraved ticket: double hairline frame */}
      <div
        className={`rounded-[10px] border p-1.5 ${
          gold ? "border-gold/50" : "border-white/[0.12]"
        }`}
      >
        <div
          className={`rounded-[7px] border bg-ink-800 p-6 ${
            gold ? "border-gold/25" : "border-white/[0.07]"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow !text-gold">Ball Room</p>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.24em] ${
                gold ? "text-gold" : v.tone === "green" ? "text-ivory" : "text-ivory-faint"
              }`}
            >
              {v.label}
            </span>
          </div>

          <p className="font-display text-xl font-medium leading-tight text-ivory">
            {match.home}
            <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-ivory-faint">
              {match.minute}′
            </span>
          </p>

          <div className="my-6 grid grid-cols-3 border-y border-white/[0.08] py-4">
            <Field label="Market moved" value={`${startProb}→${actual}`} />
            <Field label="You called" value={String(guess)} accent />
            <Field label="Off by" value={String(err)} />
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-ivory-dim">{playerName}</p>
              <p className="eyebrow mt-1">Streak {streak}</p>
            </div>
            <p className="tabular font-num text-[40px] font-light leading-none text-gold">
              +{points}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(brag);
          }}
          className="btn btn-ghost flex-1 py-3.5"
        >
          Copy the receipt
        </button>
        <button onClick={onPlayAgain} className="btn btn-primary flex-1 py-3.5">
          Go again
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`tabular font-num text-xl font-light leading-none ${
          accent ? "text-gold" : "text-ivory"
        }`}
      >
        {value}
      </p>
      <p className="eyebrow mt-2 !text-[9px]">{label}</p>
    </div>
  );
}
