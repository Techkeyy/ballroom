"use client";

/**
 * Solana wallet context. Wallet-Standard auto-detection means we pass an empty
 * `wallets` array — Phantom, Solflare, Backpack, etc. register themselves.
 * Endpoint defaults to devnet (matches TxLINE's devnet program for the free tier).
 */

import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";

export default function SolanaProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet"),
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
