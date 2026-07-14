import { NextResponse } from "next/server";
import { markGoalForTest, seedDemoMarket } from "@/lib/txline-server";

export const dynamic = "force-dynamic";

/**
 * DEV/DEMO ONLY: inject a goal event for a fixture, triggering a goal-aftershock
 * round at any table on that match. Disabled in production so it can't be abused
 * on the live deployment.
 *
 * POST { matchId, seedOnly? }  ·  GET ?matchId=...&seed=1
 * `seed` makes a fixture's market readable (no goal) so a normal round can open.
 */
function enabled() {
  return process.env.VERCEL_ENV !== "production";
}

function trigger(matchId: string | null, seedOnly: boolean) {
  if (!enabled()) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }
  if (seedOnly) {
    seedDemoMarket(matchId);
    return NextResponse.json({ ok: true, matchId, seeded: true });
  }
  const goal = markGoalForTest(matchId);
  return NextResponse.json({ ok: true, matchId, goal });
}

export async function POST(req: Request) {
  const { matchId, seedOnly } = (await req.json().catch(() => ({}))) as {
    matchId?: string;
    seedOnly?: boolean;
  };
  return trigger(matchId ?? null, Boolean(seedOnly));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return trigger(url.searchParams.get("matchId"), url.searchParams.get("seed") === "1");
}
