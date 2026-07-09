"use client";

import { Bot } from "@/lib/game";

export type Row = { id: string; name: string; points: number; you?: boolean };

export default function Leaderboard({
  player,
  bots,
  highlightDelta,
}: {
  player: { name: string; points: number };
  bots: Bot[];
  highlightDelta?: number;
}) {
  const rows: Row[] = [
    { id: "you", name: player.name, points: player.points, you: true },
    ...bots.map((b) => ({ id: b.id, name: b.name, points: b.points })),
  ].sort((a, b) => b.points - a.points);

  return (
    <div className="panel p-5">
      <p className="eyebrow mb-4">The table · The Lads</p>
      <ol>
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`flex items-center justify-between border-t border-white/[0.06] py-2.5 pl-3 pr-1 ${
              r.you ? "border-l-2 border-l-gold" : ""
            }`}
          >
            <span className="flex items-baseline gap-4">
              <span className="tabular w-5 font-mono text-[11px] text-ivory-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-sm ${
                  r.you ? "font-medium text-gold" : "text-ivory-dim"
                }`}
              >
                {r.name}
                {r.you ? " — you" : ""}
              </span>
            </span>
            <span className="tabular flex items-baseline gap-2 font-num text-sm text-ivory">
              {r.you && highlightDelta ? (
                <span className="font-mono text-[10px] tracking-[0.1em] text-gold">
                  +{highlightDelta}
                </span>
              ) : null}
              {r.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
