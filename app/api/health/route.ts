import { NextResponse } from "next/server";
import { storageMode } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic. If `storage` reads "memory" in production, league/round state is
 * NOT shared across serverless invocations — friends will intermittently fail
 * to see each other or the table. Connect Vercel KV (Storage tab) to fix.
 */
export async function GET() {
  const useMock = (process.env.NEXT_PUBLIC_TXLINE_MOCK ?? "true").toLowerCase() !== "false";
  return NextResponse.json({
    storage: storageMode,
    dataSource: useMock ? "simulator" : "txline",
    env: process.env.VERCEL_ENV ?? "local",
  });
}
