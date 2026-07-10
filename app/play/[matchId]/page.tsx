"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Heartbeat from "@/components/Heartbeat";
import PredictionPad from "@/components/PredictionPad";
import Leaderboard from "@/components/Leaderboard";
import ShareCard from "@/components/ShareCard";
import { useSyncRound } from "@/components/useSyncRound";
import { getMatch, subscribeToMatch, dataSource, type Match } from "@/lib/txline";
import { PREDICT_WINDOW_MS, scoreGuess, SHARP_BAR, nextStreak, verdict } from "@/lib/game";
import { load, save, type Persisted } from "@/lib/store";

type Phase = "idle" | "locked" | "resolved";
type Result = { startProb: number; guess: number; actual: number; points: number; streak: number };

export default function MatchPage() {
  const router = useRouter();
  const { matchId } = useParams<{ matchId: string }>();

  const [match, setMatch] = useState<Match | null>(null);
  const [state, setState] = useState<Persisted | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // solo engine state
  const [guess, setGuess] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msLeft, setMsLeft] = useState(PREDICT_WINDOW_MS);
  const [result, setResult] = useState<Result | null>(null);
  const [gained, setGained] = useState(0);

  const matchRef = useRef<Match | null>(null);
  const lockRef = useRef<{ startProb: number; guess: number } | null>(null);
  const receiptDone = useRef<string | null>(null);

  // always-fresh state for callbacks that fire outside render (timers)
  const stateRef = useRef<Persisted | null>(null);
  stateRef.current = state;

  const leagueMode = Boolean(state?.leagueCode);
  const player = { address: state?.player?.address ?? "", name: state?.player?.name ?? "" };
  const meta = {
    home: match?.home ?? "",
    away: match?.away ?? "",
    homeCode: match?.homeCode ?? "",
  };

  // league engine (no-ops when leagueCode is null)
  const sync = useSyncRound(state?.leagueCode ?? null, matchId, meta, player);

  // ---- bootstrap: auth + initial match -----------------------------------
  useEffect(() => {
    const s = load();
    if (!s.player) {
      router.replace("/");
      return;
    }
    setState(s);
    getMatch(matchId).then((m) => {
      if (!m) {
        router.replace("/play");
        return;
      }
      setMatch(m);
      matchRef.current = m;
      setGuess(Math.round(m.current));
    });
  }, [matchId, router]);

  // ---- live odds subscription (drives the big number + chart) -------------
  useEffect(() => {
    if (!matchId) return;
    const unsub = subscribeToMatch(matchId, (_pt, m) => {
      setMatch(m);
      matchRef.current = m;
    });
    return unsub;
  }, [matchId]);

  // ---- receipt writer (shared by both modes) ------------------------------
  const writeReceipt = useCallback(
    async (r: {
      home: string;
      away: string;
      homeCode: string;
      minute: number;
      startProb: number;
      guess: number;
      actual: number;
      points: number;
      streak: number;
      marketMessageId?: string;
      marketTs?: number;
      key: string;
    }) => {
      if (receiptDone.current === r.key) return;
      receiptDone.current = r.key;
      try {
        const res = await fetch("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerName: player.name,
            home: r.home,
            away: r.away,
            homeCode: r.homeCode,
            minute: r.minute,
            startProb: r.startProb,
            guess: r.guess,
            actual: r.actual,
            points: r.points,
            streak: r.streak,
            verdict: verdict(r.points).label,
            marketMessageId: r.marketMessageId,
            marketTs: r.marketTs,
          }),
        });
        const body = (await res.json()) as { id?: string };
        if (body.id) setReceiptId(body.id);
      } catch {
        /* copy-text fallback still works */
      }
    },
    [player.name],
  );

  // ===== SOLO engine =======================================================
  const resolveSolo = useCallback(() => {
    const locked = lockRef.current;
    const m = matchRef.current;
    const prev = stateRef.current;
    if (!locked || !m || !prev?.player) return;

    const actual = Math.round(m.current * 10) / 10;
    const points = scoreGuess(locked.guess, actual);
    const kept = points >= SHARP_BAR;
    const streak = nextStreak(prev.player.streak, kept);
    const p = {
      ...prev.player,
      points: prev.player.points + points,
      streak,
      bestStreak: Math.max(prev.player.bestStreak, streak),
      rounds: prev.player.rounds + 1,
    };
    const next = { ...prev, player: p };

    save(next);
    setState(next);
    setGained(points);
    setResult({ startProb: locked.startProb, guess: locked.guess, actual, points, streak });
    setPhase("resolved");
    lockRef.current = null;

    writeReceipt({
      home: m.home,
      away: m.away,
      homeCode: m.homeCode,
      minute: m.minute,
      startProb: locked.startProb,
      guess: locked.guess,
      actual,
      points,
      streak,
      marketMessageId: m.marketMessageId,
      marketTs: m.marketTs,
      key: `solo-${m.id}-${locked.startProb}-${Date.now()}`,
    });
  }, [writeReceipt]);

  useEffect(() => {
    if (leagueMode || phase !== "locked") return;
    const end = Date.now() + PREDICT_WINDOW_MS;
    setMsLeft(PREDICT_WINDOW_MS);
    const iv = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) {
        clearInterval(iv);
        setMsLeft(0);
        resolveSolo();
      } else setMsLeft(left);
    }, 200);
    return () => clearInterval(iv);
  }, [leagueMode, phase, resolveSolo]);

  function lockSolo() {
    if (!match) return;
    lockRef.current = { startProb: Math.round(match.current * 10) / 10, guess };
    setPhase("locked");
  }
  function playAgainSolo() {
    setResult(null);
    setGained(0);
    setReceiptId(null);
    if (match) setGuess(Math.round(match.current));
    setPhase("idle");
  }

  // ===== LEAGUE engine: write receipt + mirror standings on resolve ========
  useEffect(() => {
    if (!leagueMode || !sync.round?.resolved || !sync.myResult || !sync.round.actual) return;
    const rd = sync.round;
    const mr = sync.myResult;
    writeReceipt({
      home: rd.home,
      away: rd.away,
      homeCode: rd.homeCode,
      minute: rd.minute,
      startProb: rd.startProb,
      guess: mr.guess,
      actual: rd.actual as number,
      points: mr.points,
      streak: sync.myStreak ?? 0,
      marketMessageId: rd.marketMessageId,
      marketTs: rd.marketTs,
      key: `lg-${rd.id}`,
    });
  }, [leagueMode, sync.round, sync.myResult, sync.myStreak, writeReceipt]);

  // mirror authoritative league standing into local store (landing page)
  useEffect(() => {
    if (!leagueMode || !sync.myMember) return;
    const prev = stateRef.current;
    if (!prev?.player) return;
    const next = { ...prev, player: { ...prev.player, ...sync.myMember } };
    save(next);
    setState(next);
  }, [leagueMode, sync.myMember]);

  useEffect(() => {
    if (leagueMode && sync.phase === "opening") setReceiptId(null);
  }, [leagueMode, sync.phase, sync.round?.id]);

  if (!match || !state?.player) {
    return (
      <p className="py-28 text-center font-display text-lg italic text-ivory-faint">
        Taking your coat…
      </p>
    );
  }

  // ---- live status ---------------------------------------------------------
  const isLive = dataSource === "simulator" ? true : Boolean(match.live);
  const statusLabel =
    dataSource === "simulator"
      ? "SIM"
      : isLive
        ? "LIVE"
        : match.minute > 0
          ? "FT"
          : "PRE";

  // ---- unified view model --------------------------------------------------
  const uiPhase: Phase | "opening" = leagueMode
    ? sync.phase
    : phase;
  const uiGuess = leagueMode ? sync.guess : guess;
  const uiSetGuess = leagueMode ? sync.setGuess : setGuess;
  const uiMsLeft = leagueMode ? sync.msLeft : msLeft;
  const uiLock = leagueMode ? sync.lock : lockSolo;
  const uiStart = leagueMode ? sync.round?.startProb ?? match.current : match.current;

  const uiResult: Result | null = leagueMode
    ? sync.myResult && sync.round?.actual != null
      ? {
          startProb: sync.round.startProb,
          guess: sync.myResult.guess,
          actual: sync.round.actual,
          points: sync.myResult.points,
          streak: sync.myStreak ?? 0,
        }
      : null
    : result;

  const lockedGuess =
    uiPhase === "idle" || uiPhase === "opening"
      ? null
      : leagueMode
        ? sync.round?.guesses[player.address]?.guess ?? sync.myResult?.guess ?? null
        : lockRef.current?.guess ?? result?.guess ?? null;

  const othersReveal =
    leagueMode && uiPhase === "resolved" ? sync.otherGuesses : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      {/* header */}
      <div className="mb-8 flex items-center justify-between border-b border-white/[0.07] pb-5">
        <Link href="/play" className="eyebrow transition-colors hover:text-ivory-dim">
          ← The card
        </Link>
        <span
          className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ivory-faint"
          data-source={dataSource}
        >
          {isLive && (
            <span
              className="h-1 w-1 animate-pulseDot rounded-full bg-gold"
              style={{ boxShadow: "0 0 8px rgba(226,182,91,0.6)" }}
            />
          )}
          {match.minute > 0 && (
            <span className="tabular">
              {match.minute}′ · {match.scoreHome}–{match.scoreAway}
            </span>
          )}
          <span className={isLive ? "text-gold" : ""}>{statusLabel}</span>
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        {/* LEFT: the market */}
        <div>
          <div className="mb-6 text-center md:text-left">
            <p className="font-display text-[30px] font-semibold leading-tight text-ivory">
              {match.home}{" "}
              <span className="italic font-normal text-ivory-faint">v</span>{" "}
              {match.away}
            </p>
            <p className="eyebrow mt-2">{match.home} win probability</p>
            <p className="tabular mt-3 font-num text-[76px] font-light leading-none text-gold md:text-[88px]">
              {Math.round(match.current)}
              <span className="text-3xl text-ivory-faint">%</span>
            </p>

            {/* full 3-way market, so it reads as a match — not one country */}
            {match.awayPct != null && match.drawPct != null && (
              <div className="mt-4 flex items-stretch gap-1.5 md:max-w-[340px]">
                <MarketLeg code={match.homeCode} pct={match.current} you />
                <MarketLeg code="DRAW" pct={match.drawPct} />
                <MarketLeg code={match.awayCode} pct={match.awayPct} />
              </div>
            )}
          </div>

          {/* the thread */}
          <div className="panel p-3">
            <Heartbeat history={match.history} guess={lockedGuess} others={othersReveal} />
          </div>
        </div>

        {/* RIGHT: play + table */}
        <div className="space-y-6">
          {uiPhase === "resolved" && uiResult ? (
            <ShareCard
              match={match}
              startProb={uiResult.startProb}
              guess={uiResult.guess}
              actual={uiResult.actual}
              points={uiResult.points}
              streak={uiResult.streak}
              rank={leagueMode ? sync.myResult?.rank : undefined}
              field={leagueMode ? sync.seated : undefined}
              playerName={state.player.name}
              receiptId={receiptId}
              onPlayAgain={leagueMode ? sync.playAgain : playAgainSolo}
            />
          ) : uiPhase === "opening" ? (
            <div className="panel-strong p-6 text-center">
              <p className="font-display text-lg italic text-ivory-dim">
                Opening the next round…
              </p>
              <p className="eyebrow mt-2">Waiting for the live market</p>
            </div>
          ) : (
            <div>
              <PredictionPad
                current={Math.round(uiStart * 10) / 10}
                guess={uiGuess}
                setGuess={uiSetGuess}
                locked={uiPhase === "locked"}
                msLeft={uiMsLeft}
                onLock={uiLock}
                homeCode={match.homeCode}
              />
              {leagueMode && (
                <p className="eyebrow mt-3 text-center">
                  {sync.seated} {sync.seated === 1 ? "call" : "calls"} locked · same
                  clock for the table
                </p>
              )}
            </div>
          )}

          <Leaderboard
            player={{
              address: state.player.address,
              name: state.player.name,
              points: state.player.points,
              streak: state.player.streak,
            }}
            leagueCode={state.leagueCode}
            leagueName={state.league}
            highlightDelta={uiPhase === "resolved" ? uiResult?.points : undefined}
            refreshKey={uiPhase === "resolved" ? 1 : 0}
          />
        </div>
      </div>
    </main>
  );
}

/** One outcome of the 3-way match market. The one you call is gold. */
function MarketLeg({
  code,
  pct,
  you,
}: {
  code: string;
  pct: number;
  you?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-md border px-2 py-2 text-center ${
        you ? "border-gold/40 bg-gold/[0.06]" : "border-white/[0.08]"
      }`}
    >
      <p className={`eyebrow !text-[9px] ${you ? "!text-gold" : ""}`}>{code}</p>
      <p
        className={`tabular font-num text-lg font-light leading-none ${
          you ? "text-gold" : "text-ivory-dim"
        }`}
      >
        {Math.round(pct)}
      </p>
    </div>
  );
}
