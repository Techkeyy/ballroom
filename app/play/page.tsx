"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLiveMatches, dataSource, type Match } from "@/lib/txline";
import { load, leaveTable, setLeague as seatAtLeague, type Persisted } from "@/lib/store";
import { leagueLink, leaveLeague, createLeague, dissolveTable, fetchLeague } from "@/lib/league";
import Leaderboard from "@/components/Leaderboard";
import TableFeed from "@/components/TableFeed";

export default function PlayPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [state, setState] = useState<Persisted | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const s = load();
    if (!s.player) {
      router.replace("/");
      return;
    }
    setState(s);
  }, [router]);

  // am I the host of the current table?
  useEffect(() => {
    const code = state?.leagueCode;
    const addr = state?.player?.address;
    if (!code || !addr) {
      setIsHost(false);
      return;
    }
    let alive = true;
    const check = () =>
      fetchLeague(code).then((l) => {
        if (alive) setIsHost(Boolean(l && l.host === addr));
      });
    check();
    const iv = setInterval(check, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [state?.leagueCode, state?.player?.address]);

  async function handleLeave() {
    if (busy || !state?.leagueCode || !state.player) return;
    setBusy(true);
    try {
      await leaveLeague(state.leagueCode, state.player.address);
      setState(leaveTable());
    } finally {
      setBusy(false);
    }
  }

  async function handleNewTable() {
    if (busy || !state?.player) return;
    setBusy(true);
    try {
      // leave the current table first (if any), then open a fresh one
      if (state.leagueCode) {
        await leaveLeague(state.leagueCode, state.player.address);
        leaveTable();
      }
      const p = state.player;
      const l = await createLeague(`${p.name}'s Table`, p.address, p.name);
      setState(seatAtLeague(l.code, l.name));
    } finally {
      setBusy(false);
    }
  }

  async function handleDissolve() {
    if (busy || !state?.leagueCode || !state.player) return;
    if (!window.confirm("Close this table for everyone? This can't be undone.")) return;
    setBusy(true);
    try {
      await dissolveTable(state.leagueCode, state.player.address);
      setState(leaveTable());
    } finally {
      setBusy(false);
    }
  }

  // fired by the leaderboard when I've been kicked or the table was closed
  function handleRemoved() {
    setState(leaveTable());
  }

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
            The card
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-y-2">
            <p className="eyebrow !text-gold">Your table</p>
            <div className="flex items-center gap-4">
              <button
                onClick={copyInvite}
                className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint transition-colors hover:text-gold"
              >
                {copied ? "LINK COPIED" : `INVITE · ${state.leagueCode}`}
              </button>
              <button
                onClick={handleNewTable}
                disabled={busy}
                className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint transition-colors hover:text-gold disabled:opacity-40"
              >
                NEW TABLE
              </button>
              {isHost ? (
                <button
                  onClick={handleDissolve}
                  disabled={busy}
                  className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint transition-colors hover:text-rose disabled:opacity-40"
                >
                  CLOSE TABLE
                </button>
              ) : (
                <button
                  onClick={handleLeave}
                  disabled={busy}
                  className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint transition-colors hover:text-rose disabled:opacity-40"
                >
                  LEAVE
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 md:items-start">
            <Leaderboard
              player={{
                address: state.player?.address,
                name: state.player?.name ?? "",
                points: state.player?.points ?? 0,
              }}
              leagueCode={state.leagueCode}
              leagueName={state.league}
              onRemoved={handleRemoved}
            />
            {state.player && (
              <TableFeed
                code={state.leagueCode}
                player={{ address: state.player.address, name: state.player.name }}
              />
            )}
          </div>
        </div>
      )}

      {/* solo — offer to open a table */}
      {state && !state.leagueCode && (
        <div className="panel mb-8 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[14px] text-ivory-dim">
            You&apos;re playing solo. Open a table to race your friends.
          </p>
          <button
            onClick={handleNewTable}
            disabled={busy}
            className="btn btn-ghost px-5 py-2.5 disabled:opacity-40"
          >
            {busy ? "Opening" : "Open a table"}
          </button>
        </div>
      )}

      {matches.length === 0 ? (
        <p className="py-20 text-center font-display text-lg italic text-ivory-faint">
          No World Cup fixtures right now — check back on the next matchday.
        </p>
      ) : (
        <div className="space-y-8">
          {groupMatches(matches).map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-2">
                {group.live && (
                  <span
                    className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-gold"
                    style={{ boxShadow: "0 0 10px rgba(226,182,91,0.6)" }}
                  />
                )}
                <p className={`eyebrow ${group.live ? "!text-gold" : ""}`}>
                  {group.label}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.matches.map((m, i) => (
                  <MatchCard key={m.id} match={m} index={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

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
  const isPre = !match.live && !match.finished;
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
              : match.finished
                ? "full time"
                : kickoffLabel
                  ? `kicks off ${kickoffLabel}`
                  : "pre-match"}
          </span>
        </span>
        {(match.live || match.finished) && marketOpen && (
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

type MatchGroup = { label: string; live?: boolean; matches: Match[] };

/** Group the (already live-first, kickoff-sorted) list into Live / Today /
 *  Tomorrow / dated day sections. */
function groupMatches(matches: Match[]): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const live = matches.filter((m) => m.live);
  if (live.length) groups.push({ label: "Live now", live: true, matches: live });

  const byDay = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.live) continue;
    const key = dayLabel(m.kickoff);
    const arr = byDay.get(key);
    if (arr) arr.push(m);
    else byDay.set(key, [m]);
  }
  for (const [label, ms] of Array.from(byDay.entries())) {
    groups.push({ label, matches: ms });
  }
  return groups;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(ms?: number): string {
  if (!ms) return "Scheduled";
  const d = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return "Upcoming";
  }
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
