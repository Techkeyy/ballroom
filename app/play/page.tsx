"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLiveMatches, dataSource, type Match } from "@/lib/txline";
import { load, type Player } from "@/lib/store";

export default function PlayPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    const s = load();
    if (!s.player) {
      router.replace("/");
      return;
    }
    setPlayer(s.player);
  }, [router]);

  useEffect(() => {
    let alive = true;
    async function tick() {
      const m = await getLiveMatches();
      if (alive) setMatches(m);
    }
    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <main className="py-10">
      {/* header */}
      <div className="mb-8 flex items-end justify-between border-b border-white/[0.07] pb-5">
        <div>
          <Link
            href="/"
            className="eyebrow transition-colors hover:text-ivory-dim"
          >
            Ball Room
          </Link>
          <h1 className="mt-2 font-display text-[32px] font-medium leading-none text-ivory">
            Tonight&apos;s card
          </h1>
        </div>
        <span className="flex items-center gap-2 pb-0.5">
          <span
            className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-gold"
            style={{ boxShadow: "0 0 10px rgba(226,182,91,0.6)" }}
          />
          <span className="eyebrow !text-gold">
            {dataSource === "simulator" ? "Rehearsal" : "TxLINE live"}
          </span>
        </span>
      </div>

      <div className="space-y-3">
        {matches.map((m, i) => (
          <MatchCard key={m.id} match={m} index={i} />
        ))}
        {matches.length === 0 && (
          <p className="py-20 text-center font-display text-lg italic text-ivory-faint">
            The floor is being polished…
          </p>
        )}
      </div>

      {player && (
        <p className="eyebrow mt-10 text-center">
          {player.name} · {player.points} pts · streak {player.streak}
        </p>
      )}
    </main>
  );
}

function MatchCard({ match, index }: { match: Match; index: number }) {
  const delta = trend(match.history);
  const rising = delta >= 0;
  return (
    <Link
      href={`/play/${match.id}`}
      className="panel group block animate-riseIn p-5 transition-colors duration-200 hover:border-gold/40"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="h-1 w-1 animate-pulseDot rounded-full bg-gold" />
          <span className="eyebrow">{match.minute}′ live</span>
        </span>
        <span className="tabular font-num text-sm text-ivory-dim">
          {match.scoreHome}–{match.scoreAway}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-display text-[23px] font-semibold leading-tight text-ivory">
            {match.home}
          </p>
          <p className="truncate font-display text-[23px] font-semibold leading-tight text-ivory-dim">
            {match.away}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="eyebrow mb-1">{match.homeCode} win</p>
          <p className="tabular font-num text-[40px] font-light leading-none text-gold">
            {Math.round(match.current)}
            <span className="text-xl text-ivory-faint">%</span>
          </p>
          <p
            className={`tabular mt-1 font-mono text-[11px] tracking-[0.08em] ${
              rising ? "text-ivory-dim" : "text-rose"
            }`}
          >
            {rising ? "+" : ""}
            {delta.toFixed(1)} / 5s
          </p>
        </div>
      </div>
    </Link>
  );
}

function trend(history: { p: number }[]): number {
  if (history.length < 6) return 0;
  const a = history[history.length - 6].p;
  const b = history[history.length - 1].p;
  return Math.round((b - a) * 10) / 10;
}
