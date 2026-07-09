/**
 * In-app unlock of the FREE TxLINE World Cup tier with the connected wallet.
 *
 * Documented flow (documentation/worldcup) — no payment, no TxL needed:
 *   1. on-chain `subscribe(serviceLevel, weeks)` signed by the user's wallet
 *   2. GET /api/txline/jwt          -> guest JWT (proxied; avoids CORS)
 *   3. wallet.signMessage(`${txSig}:${leagues}:${jwt}`)   <- JWT-bound signature
 *   4. POST /api/txline/activate { txSig, walletSignature, leagues, jwt }
 *      -> long-lived API token (server persists it for the data routes)
 *
 * The same wallet that signed into Ball Room signs the TxLINE subscription —
 * "sign up through Solana" and "subscribe to TxLINE" are one continuous action.
 */

import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  buildSubscribeIx,
  activationMessage,
  FREE_TIER_DELAYED,
  type TxlineNetwork,
} from "./txline-chain";

export type ActivateWallet = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>;
};

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

export async function activateFreeTier(
  connection: Connection,
  wallet: ActivateWallet,
  opts: {
    network?: TxlineNetwork;
    serviceLevel?: number;
    weeks?: number;
    leagues?: number[];
  } = {},
): Promise<string> {
  const {
    network = "devnet",
    serviceLevel = FREE_TIER_DELAYED,
    weeks = 4,
    leagues = [], // standard bundle
  } = opts;

  // 1. on-chain subscribe (free — registers the wallet's subscription)
  const ix = buildSubscribeIx(network, wallet.publicKey, serviceLevel, weeks);
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await wallet.signTransaction(tx);
  const txSig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(txSig, "confirmed");

  // 2. guest JWT (must be the SAME one that gets signed and sent to activate)
  const { jwt } = (await fetch(`/api/txline/jwt?network=${network}`).then((r) =>
    r.json(),
  )) as { jwt: string };
  if (!jwt) throw new Error("Could not obtain TxLINE guest JWT");

  // 3. JWT-bound ownership signature
  const sig = await wallet.signMessage(activationMessage(txSig, leagues, jwt));
  const walletSignature = bytesToB64(sig);

  // 4. activate -> API token (server persists it)
  const res = (await fetch("/api/txline/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txSig, walletSignature, leagues, jwt, network }),
  }).then((r) => r.json())) as { token?: string; error?: string };
  if (res.error || !res.token) throw new Error(res.error ?? "activation failed");
  return res.token;
}
