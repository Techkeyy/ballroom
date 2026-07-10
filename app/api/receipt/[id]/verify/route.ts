import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/receipts-server";
import { fetchOddsValidation, type OddsProof } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

/**
 * Independent re-attestation of a receipt.
 *
 * A receipt stores the TxLINE odds update (by messageId/ts) that resolved the
 * round, plus its Merkle proof — the batch root is committed on Solana by the
 * TxODDS oracle. This endpoint re-fetches the proof from TxLINE right now and
 * checks the stored odds record matches what the oracle serves today.
 *
 * Honest scope: this proves the receipt's numbers are the oracle's numbers
 * (attested + Merkle-provable), it does not execute the on-chain verifier —
 * that path is documented in TxLINE's on-chain validation examples.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const receipt = await getReceipt(params.id);
  if (!receipt) {
    return NextResponse.json({ error: "no such receipt" }, { status: 404 });
  }
  if (!receipt.proof) {
    return NextResponse.json({
      id: receipt.id,
      proven: false,
      reason: "receipt has no oracle proof (round played in rehearsal mode)",
    });
  }

  const stored = receipt.proof.validation as OddsProof | null;
  const fresh = await fetchOddsValidation(receipt.proof.messageId, receipt.proof.ts);

  // Validation odds carry raw `Prices` (no derived Pct) — compare those.
  const storedPrices = stored?.odds?.Prices ?? null;
  const freshPrices = fresh?.odds?.Prices ?? null;
  const attested =
    Boolean(storedPrices && freshPrices) &&
    JSON.stringify(storedPrices) === JSON.stringify(freshPrices) &&
    stored?.odds?.MessageId === fresh?.odds?.MessageId;

  return NextResponse.json({
    id: receipt.id,
    proven: attested,
    oracle: {
      messageId: receipt.proof.messageId,
      ts: receipt.proof.ts,
      bookmaker: stored?.odds?.Bookmaker ?? null,
      prices: storedPrices,
      reAttestedNow: Boolean(fresh),
    },
    merkle: {
      subTreeProofLength: stored?.subTreeProof?.length ?? 0,
      mainTreeProofLength: stored?.mainTreeProof?.length ?? 0,
      summary: stored?.summary ?? null,
      note: "Batch root committed on Solana by the TxODDS oracle (txoracle program).",
    },
    receipt: {
      match: `${receipt.home} v ${receipt.away}`,
      minute: receipt.minute,
      startProb: receipt.startProb,
      actual: receipt.actual,
      guess: receipt.guess,
      points: receipt.points,
    },
  });
}
