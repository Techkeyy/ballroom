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

import { useCallback, useEffect, useRef, useState } from "react";
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
  const {
    wallets,
    wallet,
    select,
    connect,
    connected,
    connecting,
    publicKey,
    signMessage,
  } = useWallet();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Two-stage intent flags, because select()/connect()/sign are each a
  // separate render: user wants to connect, then (once connected) to sign in.
  const wantConnect = useRef(false);
  const wantSignIn = useRef(false);

  const nameOk = name.trim().length >= 2;

  function pickWallet() {
    const usable = wallets.filter(
      (w) => w.readyState === "Installed" || w.readyState === "Loadable",
    );
    return usable.find((w) => w.adapter.name === "Phantom") ?? usable[0] ?? null;
  }

  function onConnectError() {
    setError(
      "Couldn't open the wallet. Approve the popup, or continue as guest.",
    );
    wantConnect.current = false;
    wantSignIn.current = false;
    setBusy(false);
  }

  // Prove ownership with a signed message, then hand the address up.
  const proveAndSignIn = useCallback(async () => {
    if (!publicKey) return;
    wantSignIn.current = false;
    const address = publicKey.toBase58();
    try {
      if (signMessage) {
        const nonce = Math.random().toString(36).slice(2);
        const msg = new TextEncoder().encode(
          `Sign in to Ball Room\nwallet: ${address}\nnonce: ${nonce}`,
        );
        await signMessage(msg); // proof of ownership (SIWS-lite)
      }
      onSignIn(name.trim(), address);
    } catch {
      setError("Signature declined. You can retry or continue as guest.");
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage, name, onSignIn]);

  function connectWallet() {
    setError(null);
    if (!nameOk) {
      setError("Pick a name your table will recognise first.");
      return;
    }
    const choice = pickWallet();
    if (!choice) {
      setError("No Solana wallet detected. Install Phantom — or continue as guest.");
      return;
    }
    setBusy(true);
    wantSignIn.current = true;

    if (connected && publicKey) {
      // already connected from a previous session — go straight to signing
      void proveAndSignIn();
      return;
    }
    if (wallet?.adapter.name === choice.adapter.name) {
      // wallet already selected but not connected — connect now
      connect().catch(onConnectError);
      return;
    }
    // Fresh selection: defer connect() to the effect below, once the provider
    // has actually registered the chosen wallet (calling connect() synchronously
    // here races the select() and throws WalletNotSelected — no popup).
    wantConnect.current = true;
    select(choice.adapter.name);
  }

  // Stage 1 → 2: the wallet is now selected, so it's safe to connect (popup).
  useEffect(() => {
    if (!wantConnect.current || !wallet || connected || connecting) return;
    wantConnect.current = false;
    connect().catch(onConnectError);
  }, [wallet, connected, connecting, connect]);

  // Stage 2 → 3: connected, so prove ownership and sign in.
  useEffect(() => {
    if (wantSignIn.current && connected && publicKey) void proveAndSignIn();
  }, [connected, publicKey, proveAndSignIn]);

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
