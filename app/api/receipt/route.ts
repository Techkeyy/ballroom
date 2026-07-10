import { NextResponse } from "next/server";
import { saveReceipt, type ReceiptProof } from "@/lib/receipts-server";
import { fetchOddsValidation } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

/** Freeze a resolved round as a shareable receipt. Returns { id }. */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const num = (k: string) => {
      const v = Number(b[k]);
      if (!isFinite(v)) throw new Error(`${k} must be a number`);
      return v;
    };
    const str = (k: string, max: number) => String(b[k] ?? "").slice(0, max);

    // Anchor the round to the TxLINE oracle message that resolved it: fetch the
    // Merkle proof (batch root is committed on Solana). Best-effort — the
    // receipt still saves without it (e.g. simulator mode).
    let proof: ReceiptProof | undefined;
    const messageId = str("marketMessageId", 64);
    const marketTs = Number(b["marketTs"]);
    if (messageId && isFinite(marketTs) && marketTs > 0) {
      const validation = await fetchOddsValidation(messageId, marketTs);
      if (validation) {
        proof = { messageId, ts: marketTs, validation, fetchedAt: Date.now() };
      }
    }

    const receipt = await saveReceipt(
      {
        playerName: str("playerName", 24) || "A player",
        home: str("home", 32),
        away: str("away", 32),
        homeCode: str("homeCode", 3),
        minute: Math.max(0, Math.min(130, num("minute"))),
        startProb: Math.max(0, Math.min(100, num("startProb"))),
        guess: Math.max(0, Math.min(100, num("guess"))),
        actual: Math.max(0, Math.min(100, num("actual"))),
        points: Math.max(0, Math.min(100, Math.round(num("points")))),
        streak: Math.max(0, Math.min(999, Math.round(num("streak")))),
        verdict: str("verdict", 16),
      },
      proof,
    );
    return NextResponse.json({ id: receipt.id, proven: Boolean(proof) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "receipt error" },
      { status: 400 },
    );
  }
}
