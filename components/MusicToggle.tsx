"use client";

/**
 * Ambient score — generated live with the Web Audio API, so it is entirely
 * original and copyright-free (no audio file, nothing licensed). A warm evolving
 * pad with soft chimes; endless by construction. Autoplay is attempted, and if
 * the browser blocks it we start on the first gesture. The toggle persists.
 */

import { useEffect, useRef, useState } from "react";

const PREF_KEY = "ballroom.sound";

// A warm major-ish pad (C E G B D) — celebratory, not melancholic.
const CHORD = [130.81, 164.81, 196.0, 246.94, 293.66];

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  stop: () => void;
};

function buildEngine(): Engine {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();

  const master = ctx.createGain();
  master.gain.value = 0.0001; // fade in later
  master.connect(ctx.destination);

  // gentle low-pass with a slow sweep for movement
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.6;
  filter.connect(master);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 320;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  // the pad: two slightly-detuned oscillators per chord tone
  const padGain = ctx.createGain();
  padGain.gain.value = 0.10;
  padGain.connect(filter);
  const oscs: OscillatorNode[] = [];
  for (const f of CHORD) {
    for (const detune of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(padGain);
      o.start();
      oscs.push(o);
    }
  }

  // soft chimes drifting over the pad
  let chimeTimer: number | undefined;
  function chime() {
    const note = CHORD[Math.floor(Math.random() * CHORD.length)] * 2; // an octave up
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = note;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    o.connect(g).connect(pan).connect(master);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    o.start(t);
    o.stop(t + 3.4);
    chimeTimer = window.setTimeout(chime, 5000 + Math.random() * 6000);
  }
  chimeTimer = window.setTimeout(chime, 3000);

  return {
    ctx,
    master,
    stop: () => {
      if (chimeTimer) clearTimeout(chimeTimer);
      oscs.forEach((o) => o.stop());
      lfo.stop();
      ctx.close().catch(() => {});
    },
  };
}

export default function MusicToggle() {
  const engineRef = useRef<Engine | null>(null);
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const muted = localStorage.getItem(PREF_KEY) === "off";

    const start = () => {
      if (muted || engineRef.current) return;
      try {
        const eng = buildEngine();
        engineRef.current = eng;
        const t = eng.ctx.currentTime;
        eng.master.gain.setValueAtTime(0.0001, t);
        eng.master.gain.exponentialRampToValueAtTime(0.6, t + 2.5);
        if (eng.ctx.state === "suspended") throw new Error("suspended");
        setOn(true);
      } catch {
        // autoplay blocked — arm a one-shot gesture starter
        engineRef.current?.stop();
        engineRef.current = null;
        const kick = () => {
          window.removeEventListener("pointerdown", kick);
          window.removeEventListener("keydown", kick);
          if (localStorage.getItem(PREF_KEY) === "off") return;
          const eng = buildEngine();
          engineRef.current = eng;
          const t = eng.ctx.currentTime;
          eng.master.gain.setValueAtTime(0.0001, t);
          eng.master.gain.exponentialRampToValueAtTime(0.6, t + 2.5);
          setOn(true);
        };
        window.addEventListener("pointerdown", kick, { once: true });
        window.addEventListener("keydown", kick, { once: true });
      }
    };
    start();

    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  function toggle() {
    if (on) {
      engineRef.current?.stop();
      engineRef.current = null;
      setOn(false);
      localStorage.setItem(PREF_KEY, "off");
    } else {
      const eng = buildEngine();
      engineRef.current = eng;
      const t = eng.ctx.currentTime;
      eng.master.gain.setValueAtTime(0.0001, t);
      eng.master.gain.exponentialRampToValueAtTime(0.6, t + 2);
      eng.ctx.resume?.();
      setOn(true);
      localStorage.setItem(PREF_KEY, "on");
    }
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label={on ? "Mute music" : "Play music"}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-ink-900/70 text-ivory backdrop-blur transition-colors hover:border-gold/40 hover:text-gold"
      style={{ WebkitBackdropFilter: "blur(8px)" }}
    >
      {on ? <SpeakerOn /> : <SpeakerOff />}
    </button>
  );
}

function SpeakerOn() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path
        d="M16 9a3.5 3.5 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path
        d="M17 9.5l4 5M21 9.5l-4 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
