import { NextResponse } from "next/server";
import { kickMember } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/** POST { address (host), target } -> host removes a member. */
export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { address, target } = (await req.json()) as {
      address?: string;
      target?: string;
    };
    if (!address || !target) {
      return NextResponse.json({ error: "address and target required" }, { status: 400 });
    }
    const league = await kickMember(params.code, address, target);
    return NextResponse.json({ league });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "kick error" },
      { status: 500 },
    );
  }
}
