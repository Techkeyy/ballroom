"use client";

/**
 * The heartbeat — a single gold thread tracing the market's mind.
 * Player's locked call is a dotted ivory target line.
 */

import { OddsPoint } from "@/lib/txline";

const W = 340;
const H = 150;
const PAD = 10;

export default function Heartbeat({
  history,
  guess,
  windowMax = 60,
}: {
  history: OddsPoint[];
  guess: number | null;
  windowMax?: number;
}) {
  const pts = history.slice(-windowMax);
  if (pts.length < 2) {
    return (
      <div className="flex h-[150px] items-center justify-center font-display text-sm italic text-ivory-faint">
        reading the market…
      </div>
    );
  }

  const values = pts.map((p) => p.p);
  const min = Math.max(0, Math.min(...values, guess ?? 100) - 6);
  const max = Math.min(100, Math.max(...values, guess ?? 0) + 6);
  const span = Math.max(6, max - min);

  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.p).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

  const last = pts[pts.length - 1];
  const lastX = x(pts.length - 1);
  const lastY = y(last.p);
  const guessY = guess != null ? y(guess) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Live market chart"
    >
      <defs>
        <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2b65b" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#e2b65b" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* faint horizon lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PAD}
          y1={PAD + f * (H - PAD * 2)}
          x2={W - PAD}
          y2={PAD + f * (H - PAD * 2)}
          stroke="#efece6"
          strokeOpacity="0.04"
        />
      ))}

      <path d={area} fill="url(#goldFill)" />
      <path
        d={line}
        fill="none"
        stroke="#e2b65b"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {guessY != null && (
        <g>
          <line
            x1={PAD}
            y1={guessY}
            x2={W - PAD}
            y2={guessY}
            stroke="#efece6"
            strokeWidth="1"
            strokeDasharray="2 5"
            opacity="0.65"
          />
          <text
            x={W - PAD}
            y={guessY - 6}
            textAnchor="end"
            fontSize="9"
            letterSpacing="1.5"
            fill="#efece6"
            opacity="0.8"
            style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
          >
            your call · {guess}
          </text>
        </g>
      )}

      {/* live edge — CSS pulse (SMIL starves renderer-idle detection) */}
      <circle
        cx={lastX}
        cy={lastY}
        r="7"
        fill="#e2b65b"
        opacity="0.22"
        className="animate-pulseDot"
        style={{ transformOrigin: `${lastX}px ${lastY}px` }}
      />
      <circle cx={lastX} cy={lastY} r="3" fill="#e2b65b" />
    </svg>
  );
}
