import { NextResponse } from "next/server";
import { dissolveLeague } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/** POST { address (host) } -> host closes the table for everyone. */
export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }
    const ok = await dissolveLeague(params.code, address);
    if (!ok) return NextResponse.json({ error: "only the host can close the table" }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "dissolve error" },
      { status: 500 },
    );
  }
}
