"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLeague, kickMember, type League } from "@/lib/league";

export type Row = {
  id: string;
  name: string;
  points: number;
  streak?: number;
  you?: boolean;
  host?: boolean;
};

/**
 * The table. With a real league code it polls the shared league and ranks the
 * humans seated there. The host can remove members; if you're kicked or the
 * table is dissolved, `onRemoved` fires so the page can drop you back to solo.
 */
export default function Leaderboard({
  player,
  leagueCode,
  leagueName,
  highlightDelta,
  refreshKey,
  onRemoved,
}: {
  player: { address?: string; name: string; points: number; streak?: number };
  leagueCode?: string | null;
  leagueName?: string;
  highlightDelta?: number;
  /** bump to force an immediate re-poll (e.g. right after a round resolves) */
  refreshKey?: number;
  /** fired once when this player is no longer at the table (kicked / dissolved) */
  onRemoved?: () => void;
}) {
  const [league, setLeague] = useState<League | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const removedFired = useRef(false);

  useEffect(() => {
    if (!leagueCode) return;
    let alive = true;
    const tick = () =>
      fetchLeague(leagueCode).then((l) => {
        if (!alive || !l) return;
        setLeague(l);
        // kicked out or table closed?
        const gone = l.dissolved || (player.address && !l.members[player.address]);
        if (gone && !removedFired.current) {
          removedFired.current = true;
          onRemoved?.();
        }
      });
    tick();
    const iv = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [leagueCode, refreshKey, player.address, onRemoved]);

  const isHost = Boolean(league && player.address && league.host === player.address);

  async function kick(addr: string) {
    if (!leagueCode || !player.address || kicking) return;
    setKicking(addr);
    try {
      const l = await kickMember(leagueCode, player.address, addr);
      if (l) setLeague(l);
    } finally {
      setKicking(null);
    }
  }

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
      host: addr === league.host,
    }));
    title = league.name;
    subtitle = `${rows.length} SEATED`;
  } else if (leagueCode) {
    rows = [{ id: "you", name: player.name, points: player.points, you: true }];
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
        <p className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint">{subtitle}</p>
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
              <span className={`text-sm ${r.you ? "font-medium text-gold" : "text-ivory-dim"}`}>
                {r.name}
                {r.you ? " — you" : ""}
              </span>
              {r.host ? (
                <span className="rounded-sm border border-gold/30 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-gold/80">
                  Host
                </span>
              ) : null}
              {r.streak && r.streak > 1 ? (
                <span className="font-mono text-[9px] tracking-[0.1em] text-ivory-faint">
                  {r.streak}★
                </span>
              ) : null}
            </span>
            <span className="tabular flex items-center gap-3 font-num text-sm text-ivory">
              {r.you && highlightDelta ? (
                <span className="font-mono text-[10px] tracking-[0.1em] text-gold">
                  +{highlightDelta}
                </span>
              ) : null}
              <span>{r.points}</span>
              {isHost && !r.you && !r.host && (
                <button
                  onClick={() => kick(r.id)}
                  disabled={kicking === r.id}
                  aria-label={`Remove ${r.name}`}
                  className="font-mono text-[13px] leading-none text-ivory-faint transition-colors hover:text-rose disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
