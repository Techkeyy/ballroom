import { NextResponse } from "next/server";
import { fetchWorldCupMatches } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await fetchWorldCupMatches();
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "txline error", matches: [] },
      { status: 502 },
    );
  }
}
