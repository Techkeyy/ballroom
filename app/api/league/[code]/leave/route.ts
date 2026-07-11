import { NextResponse } from "next/server";
import { leaveLeague } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/** POST { address } -> remove this member from the table. */
export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }
    await leaveLeague(params.code, address);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "leave error" },
      { status: 500 },
    );
  }
}
