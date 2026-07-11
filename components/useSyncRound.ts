"use client";

/**
 * Client engine for server-authoritative synchronized league rounds.
 * Everyone at the table plays the same round, on the same clock; the server
 * reads the live market and scores all guesses at once.
 *
 * Which market "leg" (home/draw/away) a round calls is decided when that
 * round OPENS — it can't change mid-round (everyone must be calling the same
 * number). `nextLeg`/`setNextLeg` here choose what the *next* round asks;
 * `round.leg` is the leg the *current* round actually locked in.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  openRound,
  fetchRound,
  lockGuess,
  fetchLeague,
  type LeagueRound,
  type RoundResult,
  type Leg,
} from "@/lib/league";

export type SyncPhase = "opening" | "idle" | "locked" | "resolved";

type Meta = { home: string; away: string; homeCode: string };

export function useSyncRound(
  code: string | null,
  matchId: string,
  meta: Meta,
  player: { address: string; name: string },
) {
  const [round, setRound] = useState<LeagueRound | null>(null);
  const [guess, setGuess] = useState(50);
  const [now, setNow] = useState(Date.now());
  const [myStreak, setMyStreak] = useState<number | undefined>();
  const [myMember, setMyMember] = useState<
    { points: number; streak: number; bestStreak: number; rounds: number } | null
  >(null);
  const [nextLeg, setNextLeg] = useState<Leg>("home");
  const lastResolvedId = useRef<string | null>(null);
  const touched = useRef(false);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const legRef = useRef<Leg>(nextLeg);
  legRef.current = nextLeg;

  const addr = player.address;

  // open a round on mount
  useEffect(() => {
    if (!code) return;
    let alive = true;
    openRound(code, matchId, metaRef.current, legRef.current).then((r) => {
      if (alive && r) setRound(r);
    });
    return () => {
      alive = false;
    };
  }, [code, matchId]);

  // poll the shared round (also carries the desired next-leg for when the
  // reveal window naturally elapses and the server auto-opens a fresh one)
  useEffect(() => {
    if (!code) return;
    let alive = true;
    const iv = setInterval(async () => {
      const r = await fetchRound(code, matchId, metaRef.current, legRef.current);
      if (alive && r) setRound(r);
    }, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [code, matchId]);

  // clock
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // default the slider to the round's opening number
  useEffect(() => {
    if (round && !round.resolved && !round.guesses[addr] && !touched.current) {
      setGuess(Math.round(round.startProb));
    }
  }, [round?.id, round?.resolved, addr]); // eslint-disable-line react-hooks/exhaustive-deps

  // read my streak once when a round resolves
  useEffect(() => {
    if (code && round?.resolved && lastResolvedId.current !== round.id) {
      lastResolvedId.current = round.id;
      fetchLeague(code).then((l) => {
        const m = l?.members[addr];
        if (m) {
          setMyStreak(m.streak);
          setMyMember({
            points: m.points,
            streak: m.streak,
            bestStreak: m.bestStreak,
            rounds: m.rounds,
          });
        }
      });
    }
  }, [code, round?.resolved, round?.id, addr]);

  const mine = round?.guesses[addr];
  const resolved = Boolean(round?.resolved);
  const phase: SyncPhase = !round
    ? "opening"
    : resolved
      ? "resolved"
      : mine
        ? "locked"
        : "idle";
  const msLeft = round ? Math.max(0, round.deadline - now) : 0;
  const myResult: RoundResult | null =
    resolved && round?.results ? (round.results[addr] ?? null) : null;

  const lock = useCallback(async () => {
    if (!code || !round) return;
    // optimistic
    setRound({
      ...round,
      guesses: {
        ...round.guesses,
        [addr]: { name: player.name, guess, at: Date.now() },
      },
    });
    const r = await lockGuess(code, matchId, round.id, addr, player.name, guess);
    if (r) setRound(r);
  }, [code, round, guess, addr, player.name, matchId]);

  const playAgain = useCallback(async () => {
    if (!code) return;
    touched.current = false;
    setMyStreak(undefined);
    const r = await openRound(code, matchId, metaRef.current, legRef.current);
    if (r) setRound(r);
  }, [code, matchId]);

  /**
   * Switch the market leg. If the live round has no calls yet the server
   * re-opens it on the new leg immediately (instant); otherwise it queues the
   * leg for the next round.
   */
  const changeLeg = useCallback(
    async (leg: Leg) => {
      setNextLeg(leg);
      legRef.current = leg;
      if (!code) return;
      touched.current = false;
      const r = await openRound(code, matchId, metaRef.current, leg);
      if (r) setRound(r);
    },
    [code, matchId],
  );

  const setGuessTouched = useCallback((v: number) => {
    touched.current = true;
    setGuess(v);
  }, []);

  const otherGuesses = round
    ? Object.entries(round.guesses)
        .filter(([a]) => a !== addr)
        .map(([, g]) => g.guess)
    : [];

  return {
    round,
    phase,
    guess,
    setGuess: setGuessTouched,
    lock,
    msLeft,
    myResult,
    myStreak,
    myMember,
    playAgain,
    changeLeg,
    otherGuesses,
    seated: round ? Object.keys(round.guesses).length : 0,
    nextLeg,
    setNextLeg,
  };
}
