import { NextResponse } from "next/server";
import { createLeague } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/** Create a league. Body: { name, address, playerName } -> { league } */
export async function POST(req: Request) {
  try {
    const { name, address, playerName } = (await req.json()) as {
      name?: string;
      address?: string;
      playerName?: string;
    };
    if (!address || !playerName) {
      return NextResponse.json(
        { error: "address and playerName required" },
        { status: 400 },
      );
    }
    const league = await createLeague(name ?? "", { address, name: playerName });
    return NextResponse.json({ league });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "league error" },
      { status: 500 },
    );
  }
}
