"use client";

/**
 * The table feed — game-aware banter for a league. Auto-events (opens, seats,
 * locks, round winners) arrive from the server; players add short messages and
 * emoji reactions. Polls alongside the leaderboard. League play only.
 */

import { useEffect, useRef, useState } from "react";
import { fetchFeed, postChat, postReact, FEED_EMOJI, type FeedItem } from "@/lib/league";

export default function TableFeed({
  code,
  player,
}: {
  code: string;
  player: { address: string; name: string };
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetchFeed(code).then((f) => {
        if (alive) setItems(f);
      });
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [code]);

  // keep pinned to the newest unless the reader has scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    atBottom.current = true;
    const next = await postChat(code, player.address, player.name, text);
    if (next) setItems(next);
    setSending(false);
  }

  async function react(emoji: string) {
    atBottom.current = true;
    const next = await postReact(code, player.address, player.name, emoji);
    if (next) setItems(next);
  }

  return (
    <div className="panel flex flex-col p-4">
      <p className="eyebrow mb-3">Table talk</p>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mb-3 max-h-56 min-h-[96px] space-y-2 overflow-y-auto pr-1"
      >
        {items.length === 0 ? (
          <p className="py-6 text-center font-display text-sm italic text-ivory-faint">
            Quiet table. Say something.
          </p>
        ) : (
          items.map((it) => <FeedLine key={it.id} it={it} me={player.name} />)
        )}
      </div>

      <div className="mb-2 flex gap-1.5">
        {FEED_EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => react(e)}
            className="rounded-md border border-white/[0.08] px-2 py-1 text-sm transition-colors hover:border-gold/40"
            aria-label={`react ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the table…"
          maxLength={140}
          className="w-0 flex-1 rounded-md border border-white/[0.12] bg-ink-950/60 px-3 py-2.5 text-sm text-ivory placeholder-ivory-faint outline-none transition-colors focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="btn btn-ghost px-4 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function FeedLine({ it, me }: { it: FeedItem; me: string }) {
  if (it.kind === "event") {
    return (
      <p className="text-[13px] leading-snug text-ivory-faint">
        <span className="text-gold/70">·</span> {it.text}
      </p>
    );
  }
  if (it.kind === "react") {
    return (
      <p className="text-[13px] leading-snug text-ivory-dim">
        <span className="text-ivory">{it.name}</span> {it.emoji}
      </p>
    );
  }
  // chat
  const mine = it.name === me;
  return (
    <p className="text-[13px] leading-snug text-ivory-dim">
      <span className={mine ? "font-medium text-gold" : "text-ivory"}>{it.name}</span>{" "}
      {it.text}
    </p>
  );
}
