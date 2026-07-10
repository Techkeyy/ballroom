"use client";

import { useEffect, useState } from "react";
import { fetchLeague, type League } from "@/lib/league";

export type Row = {
  id: string;
  name: string;
  points: number;
  streak?: number;
  you?: boolean;
};

/**
 * The table. With a real league code it polls the shared league and ranks the
 * humans seated there. Solo, it just shows you — no synthetic players.
 */
export default function Leaderboard({
  player,
  leagueCode,
  leagueName,
  highlightDelta,
  refreshKey,
}: {
  player: { address?: string; name: string; points: number; streak?: number };
  leagueCode?: string | null;
  leagueName?: string;
  highlightDelta?: number;
  /** bump to force an immediate re-poll (e.g. right after a round resolves) */
  refreshKey?: number;
}) {
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    if (!leagueCode) return;
    let alive = true;
    const tick = () =>
      fetchLeague(leagueCode).then((l) => {
        if (alive && l) setLeague(l);
      });
    tick();
    const iv = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [leagueCode, refreshKey]);

  let rows: Row[];
  let title: string;
  let subtitle: string;

  if (leagueCode && league) {
    rows = Object.entries(league.members).map(([addr, m]) => ({
      id: addr,
      name: m.name,
      points: m.points,
      streak: m.streak,
      you: addr === player.address,
    }));
    title = league.name;
    const n = rows.length;
    subtitle = `${n} SEATED`;
  } else if (leagueCode) {
    rows = [
      { id: "you", name: player.name, points: player.points, you: true },
    ];
    title = leagueName ?? "The table";
    subtitle = "SYNCING…";
  } else {
    rows = [{ id: "you", name: player.name, points: player.points, you: true }];
    title = "Solo";
    subtitle = "JUST YOU";
  }

  rows.sort((a, b) => b.points - a.points);

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">{title}</p>
        <p className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint">
          {subtitle}
        </p>
      </div>
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
              {r.streak && r.streak > 1 ? (
                <span className="font-mono text-[9px] tracking-[0.1em] text-ivory-faint">
                  {r.streak}★
                </span>
              ) : null}
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
