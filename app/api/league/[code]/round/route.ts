import { NextResponse } from "next/server";
import { getOrOpenRound, lockRoundGuess } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/**
 * GET  ?matchId&home&away&homeCode          -> current synchronized round
 * POST { matchId, home, away, homeCode, open }  -> open/return a round
 * PUT  { matchId, roundId, address, name, guess } -> lock a guess
 */
export async function GET(
  req: Request,
  { params }: { params: { code: string } },
) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });
  const round = await getOrOpenRound(params.code, matchId, {
    home: url.searchParams.get("home") ?? "",
    away: url.searchParams.get("away") ?? "",
    homeCode: url.searchParams.get("homeCode") ?? "",
  });
  return NextResponse.json({ round });
}

export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { matchId, home, away, homeCode, open } = (await req.json()) as {
      matchId?: string;
      home?: string;
      away?: string;
      homeCode?: string;
      open?: boolean;
    };
    if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });
    const round = await getOrOpenRound(
      params.code,
      matchId,
      { home: home ?? "", away: away ?? "", homeCode: homeCode ?? "" },
      { open: Boolean(open) },
    );
    return NextResponse.json({ round });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "round error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { matchId, roundId, address, name, guess } = (await req.json()) as {
      matchId?: string;
      roundId?: string;
      address?: string;
      name?: string;
      guess?: number;
    };
    if (!matchId || !roundId || !address || typeof guess !== "number") {
      return NextResponse.json(
        { error: "matchId, roundId, address, guess required" },
        { status: 400 },
      );
    }
    const round = await lockRoundGuess(
      params.code,
      matchId,
      roundId,
      address,
      name ?? "player",
      guess,
    );
    return NextResponse.json({ round });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "lock error" },
      { status: 500 },
    );
  }
}
