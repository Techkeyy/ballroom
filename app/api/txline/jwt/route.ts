import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ORIGINS: Record<string, string> = {
  mainnet: "https://txline.txodds.com",
  devnet: "https://txline-dev.txodds.com",
};

/** Proxy a fresh TxLINE guest JWT to the browser (avoids CORS). */
export async function GET(req: Request) {
  const network = new URL(req.url).searchParams.get("network") ?? "devnet";
  const origin = ORIGINS[network] ?? ORIGINS.devnet;
  try {
    const res = await fetch(`${origin}/auth/guest/start`, { method: "POST" });
    if (!res.ok) throw new Error(`guest/start ${res.status}`);
    const { token } = (await res.json()) as { token: string };
    return NextResponse.json({ jwt: token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "jwt error" },
      { status: 502 },
    );
  }
}
