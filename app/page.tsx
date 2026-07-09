"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import { load, signIn, shortAddr, type Player } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [league, setLeague] = useState("The Lads");

  useEffect(() => {
    const s = load();
    setPlayer(s.player);
    setLeague(s.league);
  }, []);

  function handleSignIn(name: string, address?: string) {
    const s = signIn(name, address);
    setPlayer(s.player);
  }

  return (
    <main className="flex min-h-screen flex-col justify-center py-12">
      {/* wordmark */}
      <header className="animate-riseIn text-center">
        <p className="eyebrow mb-5">World Cup · Powered by TxLINE</p>
        <h1 className="font-display text-[64px] font-medium leading-[0.95] tracking-tight text-ivory">
          Ball <span className="italic text-gold">Room</span>
        </h1>
        <div className="rule-gold mx-auto mt-6 w-40" />
        <p className="mx-auto mt-6 max-w-[300px] text-[15px] leading-relaxed text-ivory-dim">
          Read the market, not the match. Call where the live odds move next —
          before your friends do.
        </p>
      </header>

      {/* the door */}
      <section
        className="panel-strong mt-10 animate-riseIn p-6"
        style={{ animationDelay: "120ms" }}
      >
        {player ? (
          <div className="space-y-6">
            <div className="text-center">
              <p className="eyebrow mb-2">At the table</p>
              <p className="font-display text-3xl font-medium text-ivory">
                {player.name}
              </p>
              <p className="tabular mt-1 font-mono text-[10px] tracking-[0.12em] text-ivory-faint">
                {shortAddr(player.address)} · {league}
              </p>
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07] py-4">
              <Stat label="Points" value={player.points} />
              <Stat label="Streak" value={player.streak} />
              <Stat label="Rounds" value={player.rounds} />
            </div>

            <button
              onClick={() => router.push("/play")}
              className="btn btn-primary w-full py-4"
            >
              Enter the Ball Room
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="eyebrow mb-2">Invitation · {league}</p>
              <p className="text-sm leading-relaxed text-ivory-dim">
                Your friend saved you a seat. The wallet is the invitation.
              </p>
            </div>
            <WalletButton onSignIn={handleSignIn} />
          </div>
        )}
      </section>

      {/* the three steps — one idea per line */}
      <section
        className="mt-12 animate-riseIn space-y-5"
        style={{ animationDelay: "240ms" }}
      >
        <Step n="01" title="Pick a live match">
          Every fixture carries a live number — the market&apos;s belief, updated
          as the game breathes.
        </Step>
        <Step n="02" title="Call the next move">
          Where does that number sit in forty-five seconds? Lock your read.
        </Step>
        <Step n="03" title="Closest wins the room">
          Precision scores. Streaks compound. The table remembers.
        </Step>
      </section>

      <footer className="mt-14 text-center">
        <p className="eyebrow">Free to play · Skill only · Nothing staked</p>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="tabular font-num text-[26px] font-light leading-none text-ivory">
        {value}
      </p>
      <p className="eyebrow mt-2">{label}</p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5 border-t border-white/[0.07] pt-5">
      <span className="tabular font-mono text-[11px] leading-6 text-gold">
        {n}
      </span>
      <div>
        <p className="font-display text-lg font-medium leading-6 text-ivory">
          {title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ivory-faint">
          {children}
        </p>
      </div>
    </div>
  );
}
