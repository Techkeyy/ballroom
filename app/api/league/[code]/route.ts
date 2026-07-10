import { NextResponse } from "next/server";
import { getLeague, joinLeague, reportRound } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/** League state (polled by the leaderboard). */
export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const league = await getLeague(params.code);
  if (!league) return NextResponse.json({ error: "no such table" }, { status: 404 });
  return NextResponse.json({ league });
}

/** Join. Body: { address, playerName } */
export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { address, playerName } = (await req.json()) as {
      address?: string;
      playerName?: string;
    };
    if (!address || !playerName) {
      return NextResponse.json(
        { error: "address and playerName required" },
        { status: 400 },
      );
    }
    const league = await joinLeague(params.code, { address, name: playerName });
    if (!league) return NextResponse.json({ error: "no such table" }, { status: 404 });
    return NextResponse.json({ league });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "join error" },
      { status: 500 },
    );
  }
}

/** Report a resolved round. Body: { address, gained, beatCrowd } */
export async function PUT(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { address, gained, beatCrowd } = (await req.json()) as {
      address?: string;
      gained?: number;
      beatCrowd?: boolean;
    };
    if (!address || typeof gained !== "number") {
      return NextResponse.json(
        { error: "address and gained required" },
        { status: 400 },
      );
    }
    const league = await reportRound(params.code, address, gained, Boolean(beatCrowd));
    if (!league) return NextResponse.json({ error: "not a member" }, { status: 404 });
    return NextResponse.json({ league });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "report error" },
      { status: 500 },
    );
  }
}
