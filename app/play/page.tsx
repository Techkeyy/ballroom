"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLiveMatches, dataSource, type Match } from "@/lib/txline";
import { load, type Persisted } from "@/lib/store";
import { leagueLink } from "@/lib/league";
import Leaderboard from "@/components/Leaderboard";

export default function PlayPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [state, setState] = useState<Persisted | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = load();
    if (!s.player) {
      router.replace("/");
      return;
    }
    setState(s);
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

  function copyInvite() {
    if (!state?.leagueCode) return;
    navigator.clipboard?.writeText(leagueLink(state.leagueCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
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
            Today&apos;s card
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

      {/* the room — visible the instant you're at a real table */}
      {state?.leagueCode && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow !text-gold">Your table</p>
            <button
              onClick={copyInvite}
              className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint transition-colors hover:text-gold"
            >
              {copied ? "LINK COPIED" : `INVITE · ${state.leagueCode}`}
            </button>
          </div>
          <Leaderboard
            player={{
              address: state.player?.address,
              name: state.player?.name ?? "",
              points: state.player?.points ?? 0,
            }}
            leagueCode={state.leagueCode}
            leagueName={state.league}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((m, i) => (
          <MatchCard key={m.id} match={m} index={i} />
        ))}
        {matches.length === 0 && (
          <p className="col-span-full py-20 text-center font-display text-lg italic text-ivory-faint">
            No World Cup matches today — check back on the next matchday.
          </p>
        )}
      </div>

      {state?.player && (
        <p className="eyebrow mt-10 text-center">
          {state.player.name} · {state.player.points} pts · streak{" "}
          {state.player.streak}
        </p>
      )}
    </main>
  );
}

function MatchCard({ match, index }: { match: Match; index: number }) {
  const delta = trend(match.history);
  const rising = delta >= 0;
  const isPre = !match.live && match.minute === 0;
  const kickoffLabel = isPre ? formatKickoff(match.kickoff) : null;
  const marketOpen = match.oddsAvailable !== false;

  return (
    <Link
      href={`/play/${match.id}`}
      className="panel group block animate-riseIn p-5 transition-colors duration-200 hover:border-gold/40"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          {match.live && (
            <span className="h-1 w-1 animate-pulseDot rounded-full bg-gold" />
          )}
          <span className={`eyebrow ${match.live ? "!text-gold" : ""}`}>
            {match.live
              ? `${match.minute}′ live`
              : match.minute > 0
                ? "full time"
                : kickoffLabel
                  ? `kicks off ${kickoffLabel}`
                  : "pre-match"}
          </span>
        </span>
        {(match.live || match.minute > 0) && marketOpen && (
          <span className="tabular font-num text-sm text-ivory-dim">
            {match.scoreHome}–{match.scoreAway}
          </span>
        )}
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
          {marketOpen ? (
            <>
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
            </>
          ) : (
            <p className="max-w-[110px] text-[11px] leading-snug text-ivory-faint">
              Odds open closer to kickoff
            </p>
          )}
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

function formatKickoff(ms?: number): string | null {
  if (!ms) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}
