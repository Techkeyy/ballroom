import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReceipt } from "@/lib/receipts-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const r = await getReceipt(params.id);
  if (!r) return { title: "Ball Room — receipt" };
  const move = Math.round((r.actual - r.startProb) * 10) / 10;
  return {
    title: `${r.playerName} called it — Ball Room`,
    description: `${r.home} ${r.minute}′: market moved ${r.startProb}→${r.actual} (${move >= 0 ? "+" : ""}${move}). Called ${r.guess}, off by ${Math.abs(Math.round((r.guess - r.actual) * 10) / 10)}. ${r.verdict}, +${r.points} pts.`,
  };
}

export default async function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const r = await getReceipt(params.id);
  if (!r) notFound();

  const err = Math.round(Math.abs(r.guess - r.actual) * 10) / 10;
  const gold = r.points >= 90;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <header className="mb-8 text-center">
        <p className="eyebrow mb-3">A receipt from the Ball Room</p>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ivory">
          {r.playerName} <span className="italic font-normal text-gold">called it</span>
        </h1>
      </header>

      {/* the engraved ticket */}
      <div
        className={`animate-riseIn rounded-[10px] border p-1.5 ${
          gold ? "border-gold/50" : "border-white/[0.12]"
        }`}
      >
        <div
          className={`rounded-[7px] border bg-ink-800 p-6 ${
            gold ? "border-gold/25" : "border-white/[0.07]"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow !text-gold">Ball Room</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
              {r.verdict}
            </span>
          </div>

          <p className="font-display text-xl font-semibold leading-tight text-ivory">
            {r.home}
            <span className="italic font-normal text-ivory-faint"> v </span>
            {r.away}
            <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-ivory-faint">
              {r.minute}′
            </span>
          </p>

          <div className="my-6 grid grid-cols-3 border-y border-white/[0.08] py-4">
            <Field label="Market moved" value={`${r.startProb}→${r.actual}`} />
            <Field label="They called" value={String(r.guess)} accent />
            <Field label="Off by" value={String(err)} />
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-ivory-dim">{r.playerName}</p>
              <p className="eyebrow mt-1">Streak {r.streak}</p>
            </div>
            <p className="tabular font-num text-[40px] font-light leading-none text-gold">
              +{r.points}
            </p>
          </div>

          {r.proof && (
            <a
              href={`/api/receipt/${r.id}/verify`}
              className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4 transition-colors hover:border-gold/30"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-gold"
                  style={{ boxShadow: "0 0 8px rgba(226,182,91,0.6)" }}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                  Oracle-attested · root anchored on Solana
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ivory-faint">
                Verify →
              </span>
            </a>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="mb-4 text-sm leading-relaxed text-ivory-dim">
          Think you read the market better? The table is open.
        </p>
        <Link href="/" className="btn btn-primary inline-block px-10 py-4">
          Take a seat
        </Link>
      </div>

      <footer className="mt-12 text-center">
        <p className="eyebrow">Live World Cup odds by TxLINE · Free to play</p>
      </footer>
    </main>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`tabular font-num text-xl font-light leading-none ${
          accent ? "text-gold" : "text-ivory"
        }`}
      >
        {value}
      </p>
      <p className="eyebrow mt-2 !text-[10px] !tracking-[0.14em]">{label}</p>
    </div>
  );
}
