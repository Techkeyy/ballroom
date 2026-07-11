import { NextResponse } from "next/server";
import { getFeed, postToFeed, getLeague, FEED_EMOJI } from "@/lib/league-server";

export const dynamic = "force-dynamic";

/**
 * GET  -> { items }   the table feed (oldest first)
 * POST { kind:"chat"|"react", address, name, text?, emoji? } -> { items }
 * Only seated members may post.
 */
export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const items = await getFeed(params.code);
  return NextResponse.json({ items });
}

export async function POST(
  req: Request,
  { params }: { params: { code: string } },
) {
  try {
    const { kind, address, name, text, emoji } = (await req.json()) as {
      kind?: "chat" | "react";
      address?: string;
      name?: string;
      text?: string;
      emoji?: string;
    };
    if (!address || !name || (kind !== "chat" && kind !== "react")) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    // membership check — only people at the table can post
    const league = await getLeague(params.code);
    if (!league || !league.members[address]) {
      return NextResponse.json({ error: "not seated at this table" }, { status: 403 });
    }
    const seatName = name.slice(0, 24);

    if (kind === "chat") {
      const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
      if (!clean) return NextResponse.json({ error: "empty message" }, { status: 400 });
      const items = await postToFeed(params.code, { kind: "chat", name: seatName, text: clean });
      return NextResponse.json({ items });
    }

    // react
    if (!emoji || !FEED_EMOJI.includes(emoji as (typeof FEED_EMOJI)[number])) {
      return NextResponse.json({ error: "unknown reaction" }, { status: 400 });
    }
    const items = await postToFeed(params.code, { kind: "react", name: seatName, emoji });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "feed error" },
      { status: 500 },
    );
  }
}
