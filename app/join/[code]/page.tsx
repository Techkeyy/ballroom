"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import { fetchLeague, joinLeague, type League } from "@/lib/league";
import { load, signIn, setLeague } from "@/lib/store";

type Phase = "loading" | "notfound" | "signin" | "joining" | "error";

export default function JoinPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [league, setLeagueState] = useState<League | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState("");

  // Look the table up. If this device is ALREADY a seated member of THIS
  // table, skip straight in — otherwise always ask who's joining (never
  // silently reuse a name/identity from some other context: playing solo
  // earlier, or opening the link on someone else's browser).
  useEffect(() => {
    fetchLeague(code).then((l) => {
      if (!l) {
        setPhase("notfound");
        return;
      }
      setLeagueState(l);
      const s = load();
      if (s.player && l.members[s.player.address]) {
        setLeague(l.code, l.name);
        router.replace("/play");
        return;
      }
      setSuggestedName(s.player?.name ?? "");
      setPhase("signin");
    });
  }, [code, router]);

  async function seat(address: string, playerName: string) {
    setPhase("joining");
    try {
      const l = await joinLeague(code, address, playerName);
      setLeague(l.code, l.name);
      router.replace("/play");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't take the seat.");
      setPhase("error");
    }
  }

  function handleSignIn(name: string, address?: string) {
    const s = signIn(name, address);
    if (s.player) seat(s.player.address, s.player.name);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <header className="animate-riseIn text-center">
        <p className="eyebrow mb-5">You are invited</p>
        <h1 className="font-display text-[44px] font-semibold leading-tight text-ivory">
          {league?.name ?? "…"}
        </h1>
        <div className="rule-gold mx-auto mt-6 w-40" />
        {league && (
          <p className="tabular mt-4 font-mono text-[11px] tracking-[0.14em] text-ivory-dim">
            TABLE {league.code} · {Object.keys(league.members).length}{" "}
            {Object.keys(league.members).length === 1 ? "SEAT" : "SEATS"} TAKEN
          </p>
        )}
        {league && Object.keys(league.members).length > 0 && (
          <p className="mt-2 text-[13px] text-ivory-dim">
            Already seated: {Object.values(league.members).map((m) => m.name).join(", ")}
          </p>
        )}
      </header>

      <section className="panel-strong mt-10 animate-riseIn p-6" style={{ animationDelay: "120ms" }}>
        {phase === "loading" && (
          <p className="py-6 text-center font-display text-lg italic text-ivory-faint">
            Checking the guest list…
          </p>
        )}

        {phase === "notfound" && (
          <div className="space-y-4 text-center">
            <p className="text-sm leading-relaxed text-ivory-dim">
              No table with code{" "}
              <span className="tabular font-mono text-ivory">{String(code).toUpperCase()}</span>.
              The link may be wrong, or the table closed.
            </p>
            <button onClick={() => router.push("/")} className="btn btn-ghost w-full py-3">
              Go to the front door
            </button>
          </div>
        )}

        {phase === "signin" && (
          <div className="space-y-6">
            <p className="text-center text-sm leading-relaxed text-ivory-dim">
              {suggestedName
                ? `Joining as "${suggestedName}"? Confirm the name below, or change it — then take your seat.`
                : "Type the name your table will know you by, then take your seat."}
            </p>
            <WalletButton
              onSignIn={handleSignIn}
              defaultName={suggestedName}
              ctaLabel="Join with Solana"
            />
          </div>
        )}

        {phase === "joining" && (
          <p className="py-6 text-center font-display text-lg italic text-ivory-faint">
            Pulling out your chair…
          </p>
        )}

        {phase === "error" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-rose">{error}</p>
            <button onClick={() => setPhase("signin")} className="btn btn-ghost w-full py-3">
              Try again
            </button>
          </div>
        )}
      </section>

      <footer className="mt-14 text-center">
        <p className="eyebrow">Free to play · Skill only · Nothing staked</p>
      </footer>
    </main>
  );
}
