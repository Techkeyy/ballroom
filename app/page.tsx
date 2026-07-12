"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import { load, signIn, setLeague as seatAtLeague, shortAddr, type Player } from "@/lib/store";
import { createLeague, leagueLink } from "@/lib/league";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Home() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [league, setLeague] = useState("Solo");
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState("");

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

  function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    router.push(`/join/${code}`);
  }

  const primaryCta = () => (player ? router.push("/play") : scrollToId("enter"));

  return (
    <main>
      {/* ===== HERO ===== */}
      <section id="top" className="relative min-h-[100svh] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.jpg"
          alt="Ball Room"
          className="absolute inset-0 h-full w-full object-cover object-[70%_center] md:object-center"
        />
        {/* scrims for legibility */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, #0b0a0e 4%, rgba(11,10,14,0.55) 30%, transparent 62%, rgba(11,10,14,0.5) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(11,10,14,0.85) 0%, rgba(11,10,14,0.4) 40%, transparent 72%)",
          }}
        />

        {/* bottom-left title block — Activision-style */}
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 md:px-10 md:pb-24">
          <div className="animate-riseIn max-w-2xl">
            <p className="eyebrow" style={{ textShadow: "0 1px 16px rgba(0,0,0,0.9)" }}>
              World Cup · Powered by TxLINE
            </p>
            <h1 className="wordmark mt-4 leading-[0.8] text-ivory">
              <span className="block text-[68px] md:text-[136px]">Ball</span>
              <span className="block text-[68px] text-gold md:text-[136px]">Room</span>
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ivory-dim md:text-[18px]">
              Read the market, not the match. Race your friends to call where the
              live World Cup odds move next — free to play, skill only.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={primaryCta} className="btn btn-primary px-8 py-4">
                {player ? "Enter the Ball Room" : "Take a seat"}
              </button>
              <button onClick={() => scrollToId("how")} className="btn btn-ghost px-8 py-4">
                How it works
              </button>
            </div>
          </div>
        </div>

        {/* scroll cue dots (functional — jump to the three steps) */}
        <div className="absolute inset-x-0 bottom-6 z-10 hidden items-center justify-center gap-2.5 md:flex">
          {["step-1", "step-2", "step-3"].map((id) => (
            <button
              key={id}
              onClick={() => scrollToId(id)}
              aria-label={`Go to ${id}`}
              className="h-1.5 w-1.5 rounded-full bg-ivory/30 transition-colors hover:bg-gold"
            />
          ))}
        </div>
      </section>

      {/* ===== ENTER — the door (sign-in / dashboard / code) ===== */}
      <section
        id="enter"
        className="scroll-mt-20 border-t border-white/[0.07] px-6 py-20 md:px-10 md:py-24"
      >
        <div className="mx-auto grid max-w-6xl items-start gap-12 md:grid-cols-[1fr_minmax(340px,0.85fr)]">
          <div>
            <p className="eyebrow mb-3">{player ? "You're in" : "Get in"}</p>
            <h2 className="max-w-md font-display text-[34px] font-medium leading-tight text-ivory md:text-[46px]">
              {player ? "Pick up where you left off." : "One name. One wallet. One table."}
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ivory-dim">
              {player
                ? "Jump into today's card, or bring friends to your table."
                : "Sign in with Solana, pick a name your table will know you by, and you're seated. Nothing staked, ever."}
            </p>
          </div>

          <div className="panel-strong p-6 md:p-7">
            {player ? (
              <div className="space-y-5">
                <div>
                  <p className="eyebrow mb-2 !text-gold">
                    {leagueCode ? "At the table" : "Signed in"}
                  </p>
                  <p className="font-display text-3xl font-medium text-ivory">{player.name}</p>
                  <p className="tabular mt-1 font-mono text-[10px] tracking-[0.12em] text-ivory-faint">
                    {shortAddr(player.address)} · {league}
                  </p>
                </div>

                <div className="grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07] py-4">
                  <Stat label="Points" value={player.points} />
                  <Stat label="Streak" value={player.streak} />
                  <Stat label="Rounds" value={player.rounds} />
                </div>

                <button onClick={() => router.push("/play")} className="btn btn-primary w-full py-4">
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
                    Your wallet is the invitation. Pick a name your table will know you by.
                  </p>
                </div>
                <WalletButton onSignIn={handleSignIn} />
              </div>
            )}

            {/* someone told you the code instead of sending a link */}
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <p className="eyebrow mb-2">Have a table code?</p>
              <form onSubmit={joinByCode} className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="XYZ12"
                  maxLength={8}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="tabular w-0 flex-1 rounded-md border border-white/[0.12] bg-ink-950/60 px-3 py-2.5 text-sm uppercase tracking-[0.1em] text-ivory placeholder-ivory-faint outline-none transition-colors focus:border-gold/50"
                />
                <button type="submit" disabled={!codeInput.trim()} className="btn btn-ghost px-4 disabled:opacity-40">
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="scroll-mt-20 border-t border-white/[0.07] px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-3">How the room works</p>
          <h2 className="mb-12 max-w-xl font-display text-[34px] font-medium leading-tight text-ivory md:text-[44px]">
            Three moves. One shared clock.
          </h2>
          <div className="grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.05] md:grid-cols-3">
            <Step id="step-1" n="01" title="Pick a live match">
              Every fixture carries a live number — the market&apos;s belief, updated
              as the game breathes.
            </Step>
            <Step id="step-2" n="02" title="Call the next move">
              Where does that number sit in ninety seconds? Lock your read against
              the table.
            </Step>
            <Step id="step-3" n="03" title="Closest wins the room">
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
      <p className="tabular font-num text-[26px] font-light leading-none text-ivory">{value}</p>
      <p className="eyebrow mt-2">{label}</p>
    </div>
  );
}

function Step({
  id,
  n,
  title,
  children,
}: {
  id?: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 bg-ink-950/60 p-7">
      <span className="tabular font-mono text-[11px] text-gold">{n}</span>
      <p className="mt-4 font-display text-[22px] font-semibold leading-tight text-ivory">{title}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-ivory-dim">{children}</p>
    </div>
  );
}
