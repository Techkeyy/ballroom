import { NextResponse } from "next/server";
import { fetchMatchPoint } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { fixtureId: string } },
) {
  try {
    const point = await fetchMatchPoint(params.fixtureId);
    if (!point) return NextResponse.json({ error: "no market" }, { status: 404 });
    return NextResponse.json(point);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "txline error" },
      { status: 502 },
    );
  }
}
