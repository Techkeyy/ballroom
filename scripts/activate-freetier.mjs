/**
 * Self-activate the TxLINE FREE World Cup tier on devnet — no payment, no user wallet.
 *
 * Documented flow (documentation/worldcup):
 *   1. local keypair + devnet SOL airdrop
 *   2. on-chain `subscribe(serviceLevel, weeks)` on the txoracle program
 *   3. guest JWT  -> sign `${txSig}:${leagues.join(",")}:${jwt}`  (leagues=[] => `${txSig}::${jwt}`)
 *   4. POST /api/token/activate -> long-lived API token
 *
 * Usage:  node scripts/activate-freetier.mjs [--network devnet|mainnet] [--level 1|12]
 * Output: prints the API token and writes/updates .env.local
 *
 * NOTE: keypair is stored at .ballroom-keypair.json (gitignored). Mainnet needs
 * real SOL for fees — use your own funded wallet there (level 12 = real-time).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import nacl from "tweetnacl";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
const NETWORK = argOf("--network", "devnet");
const SERVICE_LEVEL_ID = Number(argOf("--level", "1")); // 1 = WC 60s delay (free)
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = []; // standard bundle

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
};
const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];

const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// subscribe discriminator from the published devnet IDL
const SUBSCRIBE_DISC = Buffer.from([254, 28, 191, 138, 156, 179, 183, 53]);

function ata(owner, mint, allowOffCurve = false) {
  const [addr] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM,
  );
  if (!allowOffCurve && !PublicKey.isOnCurve(owner.toBytes())) {
    throw new Error("owner off curve");
  }
  return addr;
}

function loadKeypair() {
  const file = path.resolve(".ballroom-keypair.json");
  if (fs.existsSync(file)) {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8")));
    return Keypair.fromSecretKey(secret);
  }
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify([...kp.secretKey]));
  console.log("Generated new keypair ->", file);
  return kp;
}

async function ensureSol(connection, pubkey) {
  const bal = await connection.getBalance(pubkey);
  console.log(`Balance: ${bal / LAMPORTS_PER_SOL} SOL`);
  // Real need: ~0.00204 SOL ATA rent + dust for fees.
  if (bal >= 0.0025 * LAMPORTS_PER_SOL) return;
  if (NETWORK !== "devnet") {
    throw new Error("Mainnet wallet needs SOL for fees — fund it and retry.");
  }
  console.log("Requesting devnet airdrop…");
  const amounts = [1, 0.5, 0.1];
  for (const amt of amounts) {
    try {
      const sig = await connection.requestAirdrop(pubkey, amt * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`Airdropped ${amt} SOL`);
      return;
    } catch (e) {
      console.log(`Airdrop ${amt} SOL failed (${e.message?.slice(0, 80)}), retrying smaller…`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw new Error(
    `Airdrop exhausted. Fund ${pubkey.toBase58()} manually at https://faucet.solana.com (devnet) and re-run.`,
  );
}

async function main() {
  console.log(`Network: ${NETWORK} · service level ${SERVICE_LEVEL_ID} · ${DURATION_WEEKS} weeks`);
  const connection = new Connection(rpcUrl, "confirmed");
  const kp = loadKeypair();
  console.log("Wallet:", kp.publicKey.toBase58());

  await ensureSol(connection, kp.publicKey);

  // --- PDAs / accounts (as documented) ---
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );
  const userTokenAccount = ata(kp.publicKey, txlTokenMint);
  const tokenTreasuryVault = ata(tokenTreasuryPda, txlTokenMint, true);

  // --- instruction data: disc + u16 LE serviceLevel + u8 weeks ---
  const data = Buffer.alloc(11);
  SUBSCRIBE_DISC.copy(data, 0);
  data.writeUInt16LE(SERVICE_LEVEL_ID, 8);
  data.writeUInt8(DURATION_WEEKS, 10);

  const keys = [
    { pubkey: kp.publicKey, isSigner: true, isWritable: true }, // user
    { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
    { pubkey: txlTokenMint, isSigner: false, isWritable: false },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ATA_PROGRAM, isSigner: false, isWritable: false },
  ];

  // The program requires the user's TxL ATA to exist (AccountNotInitialized
  // 0xbc4 otherwise) — create it idempotently in the same tx.
  const ataIx = createAssociatedTokenAccountIdempotentInstruction(
    kp.publicKey, // payer
    userTokenAccount,
    kp.publicKey, // owner
    txlTokenMint,
    TOKEN_2022,
    ATA_PROGRAM,
  );

  const ix = new TransactionInstruction({ programId, keys, data });
  const tx = new Transaction().add(ataIx, ix);
  console.log("Sending subscribe tx…");
  const txSig = await connection.sendTransaction(tx, [kp]);
  await connection.confirmTransaction(txSig, "confirmed");
  console.log("Subscribed on-chain:", txSig);

  // --- guest JWT ---
  const authRes = await fetch(`${apiOrigin}/auth/guest/start`, { method: "POST" });
  if (!authRes.ok) throw new Error(`guest/start ${authRes.status}`);
  const { token: jwt } = await authRes.json();
  console.log("Guest JWT acquired");

  // --- sign `${txSig}:${leagues}:${jwt}` ---
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const sigBytes = nacl.sign.detached(
    new TextEncoder().encode(messageString),
    kp.secretKey,
  );
  const walletSignature = Buffer.from(sigBytes).toString("base64");

  // --- activate ---
  const actRes = await fetch(`${apiOrigin}/api/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
  });
  const actText = await actRes.text();
  if (!actRes.ok) {
    throw new Error(`token/activate ${actRes.status}: ${actText}`);
  }
  // Response may be raw text (e.g. "txoracle_api_…") or JSON {token}.
  let apiToken;
  try {
    const parsed = JSON.parse(actText);
    apiToken = parsed.token ?? parsed;
  } catch {
    apiToken = actText.replace(/^"|"$/g, "");
  }
  console.log("\n=== API TOKEN ACTIVATED ===\n");

  // --- write .env.local ---
  const envFile = path.resolve(".env.local");
  const lines = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, "utf8").split(/\r?\n/)
    : [];
  const setVar = (k, v) => {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  };
  setVar("TXLINE_BASE_URL", `${apiOrigin}/api`);
  setVar("TXLINE_API_TOKEN", apiToken);
  setVar("NEXT_PUBLIC_TXLINE_MOCK", "false");
  fs.writeFileSync(envFile, lines.filter(Boolean).join("\n") + "\n");
  console.log("Wrote .env.local (mock OFF, live TxLINE ON)");
  console.log("Restart `npm run dev` to pick it up.");
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
