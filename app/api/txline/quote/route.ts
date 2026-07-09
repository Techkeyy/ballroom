import { NextResponse } from "next/server";
import { requestPurchaseQuote } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { buyerPubkey, txlineAmount } = (await req.json()) as {
      buyerPubkey: string;
      txlineAmount: number;
    };
    if (!buyerPubkey) {
      return NextResponse.json({ error: "buyerPubkey required" }, { status: 400 });
    }
    const quote = await requestPurchaseQuote(buyerPubkey, txlineAmount ?? 50);
    return NextResponse.json(quote);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "quote error" },
      { status: 502 },
    );
  }
}
