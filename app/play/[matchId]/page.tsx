"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Heartbeat from "@/components/Heartbeat";
import PredictionPad from "@/components/PredictionPad";
import Leaderboard from "@/components/Leaderboard";
import ShareCard from "@/components/ShareCard";
import { getMatch, subscribeToMatch, dataSource, type Match } from "@/lib/txline";
import {
  PREDICT_WINDOW_MS,
  scoreGuess,
  scoreCrowd,
  nextStreak,
  verdict,
} from "@/lib/game";
import { load, save, type Persisted } from "@/lib/store";
import { reportRoundToLeague } from "@/lib/league";

type Phase = "idle" | "locked" | "resolved";

type Result = {
  startProb: number;
  guess: number;
  actual: number;
  points: number;
  streak: number;
};

export default function MatchPage() {
  const router = useRouter();
  const { matchId } = useParams<{ matchId: string }>();

  const [match, setMatch] = useState<Match | null>(null);
  const [state, setState] = useState<Persisted | null>(null);
  const [guess, setGuess] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msLeft, setMsLeft] = useState(PREDICT_WINDOW_MS);
  const [result, setResult] = useState<Result | null>(null);
  const [gained, setGained] = useState(0);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // refs so the resolve timer reads live values without re-subscribing
  const matchRef = useRef<Match | null>(null);
  const lockRef = useRef<{ startProb: number; guess: number } | null>(null);

  // ---- bootstrap: auth + initial match + default guess -------------------
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

  // ---- live odds subscription -------------------------------------------
  useEffect(() => {
    if (!matchId) return;
    const unsub = subscribeToMatch(matchId, (_pt, m) => {
      setMatch(m);
      matchRef.current = m;
    });
    return unsub;
  }, [matchId]);

  // ---- resolve a locked round -------------------------------------------
  const resolve = useCallback(() => {
    const locked = lockRef.current;
    const m = matchRef.current;
    if (!locked || !m) return;

    const actual = Math.round(m.current * 10) / 10;
    const points = scoreGuess(locked.guess, actual);

    setState((prev) => {
      if (!prev || !prev.player) return prev;
      const { crowdMedianPoints } = scoreCrowd(locked.startProb, actual, prev.bots);
      const beatCrowd = points >= crowdMedianPoints;

      // advance the bot crowd too, so the board is alive
      const bots = prev.bots.map((b) => {
        const bp = scoreGuess(
          // bots re-guess against this same round
          Math.max(2, Math.min(98, locked.startProb + (Math.random() - 0.5) * (24 - b.skill * 18))),
          actual,
        );
        return { ...b, points: b.points + bp };
      });

      const streak = nextStreak(prev.player.streak, beatCrowd);
      const player = {
        ...prev.player,
        points: prev.player.points + points,
        streak,
        bestStreak: Math.max(prev.player.bestStreak, streak),
        rounds: prev.player.rounds + 1,
      };

      const next = { ...prev, bots, player };
      save(next);

      // Share the result with the real table, if seated at one (best-effort).
      if (prev.leagueCode && prev.player) {
        const code = prev.leagueCode;
        const addr = prev.player.address;
        queueMicrotask(() => reportRoundToLeague(code, addr, points, beatCrowd));
      }

      // Freeze the round as a shareable receipt (best-effort).
      queueMicrotask(async () => {
        try {
          const res = await fetch("/api/receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerName: player.name,
              home: m.home,
              away: m.away,
              homeCode: m.homeCode,
              minute: m.minute,
              startProb: locked.startProb,
              guess: locked.guess,
              actual,
              points,
              streak,
              verdict: verdict(points).label,
              // ties the receipt to the exact oracle message that resolved it
              marketMessageId: m.marketMessageId,
              marketTs: m.marketTs,
            }),
          });
          const body = (await res.json()) as { id?: string };
          if (body.id) setReceiptId(body.id);
        } catch {
          /* copy-text fallback still works */
        }
      });

      setGained(points);
      setResult({
        startProb: locked.startProb,
        guess: locked.guess,
        actual,
        points,
        streak,
      });
      return next;
    });

    setPhase("resolved");
    lockRef.current = null;
  }, []);

  // ---- countdown ---------------------------------------------------------
  useEffect(() => {
    if (phase !== "locked") return;
    const end = Date.now() + PREDICT_WINDOW_MS;
    setMsLeft(PREDICT_WINDOW_MS);
    const iv = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) {
        clearInterval(iv);
        setMsLeft(0);
        resolve();
      } else {
        setMsLeft(left);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [phase, resolve]);

  function lock() {
    if (!match) return;
    lockRef.current = { startProb: Math.round(match.current * 10) / 10, guess };
    setPhase("locked");
  }

  function playAgain() {
    setResult(null);
    setGained(0);
    setReceiptId(null);
    if (match) setGuess(Math.round(match.current));
    setPhase("idle");
  }

  if (!match || !state?.player) {
    return (
      <p className="py-28 text-center font-display text-lg italic text-ivory-faint">
        Taking your coat…
      </p>
    );
  }

  const lockedGuess = phase === "idle" ? null : lockRef.current?.guess ?? result?.guess ?? null;

  return (
    <main className="py-8">
      {/* header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/play"
          className="eyebrow transition-colors hover:text-ivory-dim"
        >
          ← The card
        </Link>
        <span
          className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ivory-faint"
          data-source={dataSource}
        >
          <span
            className="h-1 w-1 animate-pulseDot rounded-full bg-gold"
            style={{ boxShadow: "0 0 8px rgba(226,182,91,0.6)" }}
          />
          <span className="tabular">
            {match.minute}′ · {match.scoreHome}–{match.scoreAway}
          </span>
          <span className={dataSource === "txline" ? "text-gold" : ""}>
            {dataSource === "txline" ? "LIVE" : "SIM"}
          </span>
        </span>
      </div>

      {/* the matchup */}
      <div className="mb-6 text-center">
        <p className="font-display text-[27px] font-semibold leading-tight text-ivory">
          {match.home} <span className="italic font-normal text-ivory-faint">v</span>{" "}
          {match.away}
        </p>
        <p className="eyebrow mt-2">{match.homeCode} win probability</p>
        <p className="tabular mt-3 font-num text-[76px] font-light leading-none text-gold">
          {Math.round(match.current)}
          <span className="text-3xl text-ivory-faint">%</span>
        </p>
      </div>

      {/* the thread */}
      <div className="panel mb-4 p-3">
        <Heartbeat history={match.history} guess={lockedGuess} />
      </div>

      {/* play / result */}
      {phase === "resolved" && result ? (
        <ShareCard
          match={match}
          startProb={result.startProb}
          guess={result.guess}
          actual={result.actual}
          points={result.points}
          streak={result.streak}
          playerName={state.player.name}
          receiptId={receiptId}
          onPlayAgain={playAgain}
        />
      ) : (
        <PredictionPad
          current={Math.round(match.current * 10) / 10}
          guess={guess}
          setGuess={setGuess}
          locked={phase === "locked"}
          msLeft={msLeft}
          onLock={lock}
        />
      )}

      {/* the table */}
      <div className="mt-6">
        <Leaderboard
          player={{
            address: state.player.address,
            name: state.player.name,
            points: state.player.points,
          }}
          bots={state.bots}
          leagueCode={state.leagueCode}
          leagueName={state.league}
          highlightDelta={phase === "resolved" ? gained : undefined}
        />
      </div>
    </main>
  );
}
