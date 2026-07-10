"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import { load, signIn, setLeague as seatAtLeague, shortAddr, type Player } from "@/lib/store";
import { createLeague, leagueLink } from "@/lib/league";

export default function Home() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [league, setLeague] = useState("Solo");
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = load();
    setPlayer(s.player);
    setLeague(s.league);
    setLeagueCode(s.leagueCode);
  }, []);

  function handleSignIn(name: string, address?: string) {
    const s = signIn(name, address);
    setPlayer(s.player);
  }

  async function handleCreateTable() {
    if (!player || creating) return;
    setCreating(true);
    try {
      const l = await createLeague(`${player.name}'s Table`, player.address, player.name);
      seatAtLeague(l.code, l.name);
      setLeague(l.name);
      setLeagueCode(l.code);
    } finally {
      setCreating(false);
    }
  }

  function copyInvite() {
    if (!leagueCode) return;
    navigator.clipboard?.writeText(leagueLink(leagueCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main>
      {/* ===== HERO: image underneath, writing layered on top ===== */}
      <section className="relative min-h-[100svh] w-full overflow-hidden">
        {/* image layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.png"
          alt="Ball Room — the beautiful game meets the egoist striker"
          className="absolute inset-0 h-full w-full object-cover object-[center_22%] md:object-[center_28%]"
        />
        {/* scrims: darken bottom & left so the writing reads, feather the top */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, #0b0a0e 2%, rgba(11,10,14,0.72) 26%, rgba(11,10,14,0.15) 55%, rgba(11,10,14,0.45) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(to right, rgba(11,10,14,0.85) 0%, rgba(11,10,14,0.35) 42%, transparent 70%)",
          }}
        />

        {/* overlaid content — bottom-left on desktop, not a centered column */}
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-14 md:px-10 md:pb-20">
          <div className="grid w-full items-end gap-10 md:grid-cols-[1.1fr_minmax(320px,0.9fr)]">
            {/* left: the pitch */}
            <div className="animate-riseIn max-w-xl">
              <p className="eyebrow" style={{ textShadow: "0 1px 16px rgba(0,0,0,0.9)" }}>
                World Cup · Powered by TxLINE
              </p>
              <h1 className="mt-4 font-display text-[68px] font-medium leading-[0.9] tracking-tight text-ivory md:text-[92px]">
                Ball <span className="italic text-gold">Room</span>
              </h1>
              <p className="mt-6 max-w-md font-display text-[24px] font-medium leading-[1.15] text-ivory md:text-[30px]">
                Read the market, <span className="italic text-gold">not the match.</span>
              </p>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ivory-dim">
                Call where the live World Cup odds move next — before your friends
                do. Free to play, skill only, nothing staked.
              </p>
            </div>

            {/* right: the door (floats over the image) */}
            <div
              className="panel-strong animate-riseIn p-6 backdrop-blur-md md:p-7"
              style={{
                animationDelay: "120ms",
                background: "rgba(15,14,20,0.72)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              {player ? (
                <div className="space-y-5">
                  <div>
                    <p className="eyebrow mb-2 !text-gold">
                      {leagueCode ? "At the table" : "Signed in"}
                    </p>
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

                  {leagueCode ? (
                    <button onClick={copyInvite} className="btn btn-ghost w-full py-3">
                      {copied ? "Invite copied" : `Invite to table ${leagueCode}`}
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateTable}
                      disabled={creating}
                      className="btn btn-ghost w-full py-3 disabled:opacity-50"
                    >
                      {creating ? "Setting the table" : "Open your own table"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="eyebrow mb-2 !text-gold">Take a seat</p>
                    <p className="text-sm leading-relaxed text-ivory-dim">
                      Your wallet is the invitation. Pick a name your table will
                      know you by.
                    </p>
                  </div>
                  <WalletButton onSignIn={handleSignIn} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS: wide 3-up on ink ===== */}
      <section className="border-t border-white/[0.07] px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-3">How the room works</p>
          <h2 className="mb-12 max-w-xl font-display text-[34px] font-medium leading-tight text-ivory md:text-[44px]">
            Three moves. One shared clock.
          </h2>
          <div className="grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.05] md:grid-cols-3">
            <Step n="01" title="Pick a live match">
              Every fixture carries a live number — the market&apos;s belief,
              updated as the game breathes.
            </Step>
            <Step n="02" title="Call the next move">
              Where does that number sit in ninety seconds? Lock your read against
              the table.
            </Step>
            <Step n="03" title="Closest wins the room">
              Precision scores. Streaks compound. Every call becomes a receipt,
              proven on Solana.
            </Step>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-6 py-10 text-center">
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
    <div className="bg-ink-950/60 p-7">
      <span className="tabular font-mono text-[11px] text-gold">{n}</span>
      <p className="mt-4 font-display text-[22px] font-semibold leading-tight text-ivory">
        {title}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-ivory-dim">{children}</p>
    </div>
  );
}
