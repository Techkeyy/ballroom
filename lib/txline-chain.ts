/**
 * TxLINE on-chain constants + the `subscribe` instruction builder, shared by
 * the in-app wallet flow (lib/txline-activate.ts) and scripts/activate-freetier.mjs.
 * Values from documentation/worldcup + the published txoracle IDL.
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

export type TxlineNetwork = "mainnet" | "devnet";

export const TXLINE_CONFIG = {
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
} as const;

// Free World Cup tiers: 1 = 60s delay (mainnet+devnet), 12 = real-time (mainnet).
export const FREE_TIER_DELAYED = 1;
export const FREE_TIER_REALTIME = 12;

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

// `subscribe` discriminator from the published txoracle IDL.
const SUBSCRIBE_DISC = [254, 28, 191, 138, 156, 179, 183, 53];

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  const [addr] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return addr;
}

/** Build the free-tier `subscribe(serviceLevel, weeks)` instruction. */
export function buildSubscribeIx(
  network: TxlineNetwork,
  user: PublicKey,
  serviceLevel: number,
  weeks = 4,
): TransactionInstruction {
  const { programId, txlTokenMint } = TXLINE_CONFIG[network];

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );

  const data = Buffer.alloc(11);
  Buffer.from(SUBSCRIBE_DISC).copy(data, 0);
  data.writeUInt16LE(serviceLevel, 8);
  data.writeUInt8(weeks, 10);

  return new TransactionInstruction({
    programId,
    data,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
      { pubkey: txlTokenMint, isSigner: false, isWritable: false },
      { pubkey: ata(user, txlTokenMint), isSigner: false, isWritable: true },
      { pubkey: ata(tokenTreasuryPda, txlTokenMint), isSigner: false, isWritable: true },
      { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  });
}

/** Activation message the wallet signs: `${txSig}:${leagues.join(",")}:${jwt}` */
export function activationMessage(
  txSig: string,
  leagues: number[],
  jwt: string,
): Uint8Array {
  return new TextEncoder().encode(`${txSig}:${leagues.join(",")}:${jwt}`);
}
