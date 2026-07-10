import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ORIGINS: Record<string, string> = {
  mainnet: "https://txline.txodds.com",
  devnet: "https://txline-dev.txodds.com",
};

/**
 * Exchange a confirmed on-chain subscription for a TxLINE API token.
 * IMPORTANT: the wallet signature is bound to a specific guest JWT
 * (`${txSig}:${leagues}:${jwt}`), so the client sends that same JWT here and we
 * forward it verbatim in the Authorization header.
 */
export async function POST(req: Request) {
  try {
    const { txSig, walletSignature, leagues, jwt, network } = (await req.json()) as {
      txSig: string;
      walletSignature: string;
      leagues: number[];
      jwt: string;
      network?: string;
    };
    if (!txSig || !walletSignature || !jwt) {
      return NextResponse.json(
        { error: "txSig, walletSignature and jwt required" },
        { status: 400 },
      );
    }
    const origin = ORIGINS[network ?? "devnet"] ?? ORIGINS.devnet;
    const res = await fetch(`${origin}/api/token/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      // leagues [] = the standard free World Cup bundle
      body: JSON.stringify({ txSig, walletSignature, leagues: leagues ?? [] }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `token/activate ${res.status}: ${await res.text()}` },
        { status: 502 },
      );
    }
    const body = (await res.json()) as { token?: string } | string;
    const token = typeof body === "string" ? body : body.token;
    // NOTE: persist per-user server-side in M4; MVP surfaces it so it can be
    // dropped into TXLINE_API_TOKEN.
    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "activate error" },
      { status: 502 },
    );
  }
}
