import { NextResponse } from "next/server";
import { fetchWorldCupMatches } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const tzOffsetMin = Number(new URL(req.url).searchParams.get("tz") ?? "0") || 0;
    const matches = await fetchWorldCupMatches(tzOffsetMin);
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "txline error", matches: [] },
      { status: 502 },
    );
  }
}
