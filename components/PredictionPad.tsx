"use client";

/**
 * The play control: set your call, lock it, sweat the countdown.
 */

import { PREDICT_WINDOW_MS } from "@/lib/game";

export default function PredictionPad({
  current,
  guess,
  setGuess,
  locked,
  msLeft,
  onLock,
  disabled,
  homeCode,
}: {
  current: number;
  guess: number;
  setGuess: (v: number) => void;
  locked: boolean;
  msLeft: number;
  onLock: () => void;
  disabled?: boolean;
  homeCode?: string;
}) {
  const secs = Math.ceil(msLeft / 1000);
  const windowSecs = Math.round(PREDICT_WINDOW_MS / 1000);
  const delta = Math.round((guess - current) * 10) / 10;

  if (locked) {
    return (
      <div className="panel-strong p-6 text-center">
        <p className="eyebrow">Locked at {current} · your call</p>
        <p className="tabular my-3 font-num text-[56px] font-light leading-none text-gold">
          {guess}
          <span className="text-2xl text-ivory-faint">%</span>
        </p>
        <div className="mt-4 h-px w-full overflow-hidden bg-white/[0.09]">
          <div
            className="h-full bg-gold transition-[width] duration-1000 ease-linear"
            style={{
              width: `${Math.max(0, Math.min(100, (msLeft / PREDICT_WINDOW_MS) * 100))}%`,
            }}
          />
        </div>
        <p className="tabular mt-3 font-mono text-[12px] tracking-[0.12em] text-ivory-dim">
          RESOLVES IN {secs}S — WATCH THE THREAD
        </p>
      </div>
    );
  }

  return (
    <div className="panel-strong p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">
          {homeCode ? `${homeCode} win % in ${windowSecs}s` : `The market in ${windowSecs}s`}
        </p>
        <p className="tabular font-mono text-[11px] tracking-[0.12em] text-ivory-faint">
          now {current}
        </p>
      </div>

      <p className="tabular text-center font-num text-[64px] font-light leading-none text-gold">
        {guess}
        <span className="text-2xl text-ivory-faint">%</span>
      </p>
      <p className="tabular mb-6 mt-2 text-center font-mono text-[11px] tracking-[0.12em] text-ivory-dim">
        {delta === 0
          ? "HOLDING FLAT"
          : delta > 0
            ? `+${delta} ABOVE THE MARKET`
            : `${delta} BELOW THE MARKET`}
      </p>

      <input
        type="range"
        min={2}
        max={98}
        step={0.5}
        value={guess}
        disabled={disabled}
        onChange={(e) => setGuess(Number(e.target.value))}
        className="dial"
        aria-label="Your call"
      />

      <button
        onClick={onLock}
        disabled={disabled}
        className="btn btn-primary mt-6 w-full py-4 disabled:opacity-40"
      >
        Lock it in
      </button>
    </div>
  );
}
