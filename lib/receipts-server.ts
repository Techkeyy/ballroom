/**
 * Receipt persistence — SERVER ONLY.
 * A receipt is one resolved round, frozen so it can be shared as /r/[id]
 * (page + OG image). Vercel KV in production, globalThis Map in dev.
 */

export type ReceiptProof = {
  messageId: string;
  ts: number;
  /** Raw TxLINE validation payload: { odds, summary, subTreeProof, mainTreeProof }.
   * The batch Merkle root is anchored on Solana by the TxODDS oracle. */
  validation: unknown;
  fetchedAt: number;
};

export type Receipt = {
  id: string;
  playerName: string;
  home: string;
  away: string;
  homeCode: string;
  minute: number;
  startProb: number;
  guess: number;
  actual: number;
  points: number;
  streak: number;
  verdict: string;
  at: number;
  proof?: ReceiptProof;
};

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

const g = globalThis as unknown as { __ballroomReceipts?: Map<string, Receipt> };
const localStore = (g.__ballroomReceipts ??= new Map<string, Receipt>());

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newId(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

export async function saveReceipt(
  data: Omit<Receipt, "id" | "at" | "proof">,
  proof?: ReceiptProof,
): Promise<Receipt> {
  const receipt: Receipt = { ...data, id: newId(), at: Date.now(), proof };
  if (HAS_KV) {
    const { kv } = await import("@vercel/kv");
    await kv.set(`receipt:${receipt.id}`, receipt, { ex: 60 * 24 * 60 * 60 });
  } else {
    localStore.set(receipt.id, receipt);
  }
  return receipt;
}

/** Canonical sample receipt — a stable design preview at /r/demo that works in
 * every runtime (edge OG route can't see the node dev fallback store). Values
 * are the first real round ever played, vs the live France–Morocco market. */
const DEMO: Receipt = {
  id: "demo",
  playerName: "Israel",
  home: "France",
  away: "Morocco",
  homeCode: "FRA",
  minute: 54,
  startProb: 56.7,
  guess: 57,
  actual: 56.1,
  points: 91,
  streak: 1,
  verdict: "Sniper",
  at: 1783631400000,
};

export async function getReceipt(id: string): Promise<Receipt | null> {
  if (id === "demo") return DEMO;
  if (HAS_KV) {
    const { kv } = await import("@vercel/kv");
    return (await kv.get<Receipt>(`receipt:${id}`)) ?? null;
  }
  return localStore.get(id) ?? null;
}
