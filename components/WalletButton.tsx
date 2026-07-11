"use client";

/**
 * Solana sign-in.
 *
 * Primary path: connect a real wallet (Phantom/Solflare/Backpack via Wallet
 * Standard) and sign a one-time message to prove ownership (SIWS-style). The
 * wallet's public key becomes the player identity.
 *
 * Fallback path: "continue as guest" mints a throwaway address so the game is
 * still fully playable in a browser with no wallet extension (e.g. for the demo
 * capture / judges without Phantom).
 *
 * Live-data unlock (paid tier) is a separate on-chain step — see lib/txline-activate.ts.
 */

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export default function WalletButton({
  onSignIn,
  defaultName = "",
  ctaLabel = "Sign in with Solana",
}: {
  onSignIn: (name: string, address?: string) => void;
  /** Pre-fill the name field (e.g. this device's existing player name). */
  defaultName?: string;
  ctaLabel?: string;
}) {
  const { wallets, select, connect, connected, connecting, publicKey, signMessage } =
    useWallet();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const nameOk = name.trim().length >= 2;

  async function connectWallet() {
    setError(null);
    if (!nameOk) {
      setError("Pick a name your table will recognise first.");
      return;
    }
    const available = wallets.filter((w) => w.readyState === "Installed");
    const choice =
      available.find((w) => w.adapter.name === "Phantom") ?? available[0];
    if (!choice) {
      setError("No Solana wallet detected. Install Phantom — or continue as guest.");
      return;
    }
    try {
      setBusy(true);
      pending.current = true;
      select(choice.adapter.name);
      // autoConnect usually finishes the connect after select; nudge it if not.
      if (!connected) await connect().catch(() => {});
    } catch {
      setError("Couldn't connect the wallet. Try again, or continue as guest.");
      pending.current = false;
      setBusy(false);
    }
  }

  // Once connected, prove ownership with a signed message, then sign in.
  useEffect(() => {
    if (!pending.current || !connected || !publicKey) return;
    pending.current = false;
    (async () => {
      const address = publicKey.toBase58();
      try {
        if (signMessage) {
          const nonce = Math.random().toString(36).slice(2);
          const msg = new TextEncoder().encode(
            `Sign in to Ball Room\nwallet: ${address}\nnonce: ${nonce}`,
          );
          await signMessage(msg); // proof of ownership (SIWS-lite)
        }
        onSignIn(name, address);
      } catch {
        setError("Signature declined. You can retry or continue as guest.");
      } finally {
        setBusy(false);
      }
    })();
  }, [connected, publicKey, signMessage, name, onSignIn]);

  return (
    <div className="w-full space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name for the league"
        autoComplete="off"
        className="w-full rounded-md border border-white/[0.12] bg-ink-950/60 px-4 py-3.5 text-sm text-ivory placeholder-ivory-faint outline-none transition-colors focus:border-gold/50"
      />

      <button
        type="button"
        onClick={connectWallet}
        disabled={busy || connecting || !nameOk}
        className="btn btn-primary w-full py-4 disabled:opacity-50"
      >
        {busy || connecting ? "Connecting" : ctaLabel}
      </button>

      {error && (
        <p className="text-center text-[11px] leading-relaxed text-rose">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => nameOk && onSignIn(name.trim())}
        disabled={!nameOk}
        className="btn btn-ghost w-full py-3 disabled:opacity-40"
      >
        Continue as guest
      </button>

      <p className="pt-1 text-center text-[11px] leading-relaxed text-ivory-faint">
        The wallet is your identity — no email, no password. Nothing staked,
        ever.
      </p>
    </div>
  );
}
