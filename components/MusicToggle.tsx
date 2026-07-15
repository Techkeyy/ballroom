"use client";

/**
 * Matchday score — a lively, carnival-inspired groove generated live with the
 * Web Audio API: samba-style percussion (surdo, shaker, agogô bells), a bouncy
 * bassline, brass-ish stabs on a bright C–Am–F–G vamp, and a low stadium-crowd
 * hum underneath. Entirely synthesized at runtime — no audio files, nothing
 * licensed, endless by construction (a *style* can't be copyrighted; an actual
 * anthem can, so we borrow none). Autoplay is attempted, and if the browser
 * blocks it we start on the first gesture. The toggle persists.
 */

import { useEffect, useRef, useState } from "react";

const PREF_KEY = "ballroom.sound";

const BPM = 116;
const STEP_S = 60 / BPM / 4; // one 16th note

// One bar each: C — Am — F — G (bass root + mid-register triad for the stabs).
const BARS = [
  { root: 65.41, chord: [261.63, 329.63, 392.0] }, // C
  { root: 55.0, chord: [220.0, 261.63, 329.63] }, // Am
  { root: 87.31, chord: [349.23, 440.0, 523.25] }, // F
  { root: 98.0, chord: [392.0, 493.88, 587.33] }, // G
];
const BELL_STEPS = new Set([0, 3, 6, 10, 12]); // son-clave-ish agogô pattern
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0]; // C-major pentatonic, up top

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

  // shared white-noise buffer for all percussion + the crowd bed
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  /** Short filtered-noise hit (shaker / hats). */
  function shaker(t: number, peak: number) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 5500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    const p = ctx.createStereoPanner();
    p.pan.value = 0.18;
    src.connect(f).connect(g).connect(p).connect(master);
    src.start(t, Math.random(), 0.1);
  }

  /** Deep samba surdo — a pitch-dropping sine thump. */
  function surdo(t: number, peak: number) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(84, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.32);
  }

  /** Agogô-style bell ping, alternating high/low and left/right. */
  function bell(t: number, hi: boolean) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = hi ? 1244.5 : 830.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.038, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    const p = ctx.createStereoPanner();
    p.pan.value = hi ? 0.35 : -0.3;
    o.connect(g).connect(p).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** Bouncy bass pluck. */
  function bass(t: number, freq: number) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g);
    o2.connect(f).connect(g);
    g.connect(master);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.26);
    o2.stop(t + 0.26);
  }

  /** Brass-ish chord stab (detuned saws through a lowpass). */
  function stab(t: number, freqs: number[]) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2200;
    f.connect(g).connect(master);
    for (const fr of freqs) {
      for (const d of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = fr;
        o.detune.value = d;
        o.connect(f);
        o.start(t);
        o.stop(t + 0.25);
      }
    }
  }

  /** Bright pentatonic sparkle for the turnaround bar. */
  function spark(t: number, freq: number) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.2 - 0.6;
    o.connect(g).connect(p).connect(master);
    o.start(t);
    o.stop(t + 0.6);
  }

  // stadium air: a slow-breathing lowpassed noise bed under everything
  const crowd = ctx.createBufferSource();
  crowd.buffer = noiseBuf;
  crowd.loop = true;
  const cf = ctx.createBiquadFilter();
  cf.type = "lowpass";
  cf.frequency.value = 380;
  const cg = ctx.createGain();
  cg.gain.value = 0.016;
  const clfo = ctx.createOscillator();
  const clfoG = ctx.createGain();
  clfo.frequency.value = 0.06;
  clfoG.gain.value = 0.008;
  clfo.connect(clfoG).connect(cg.gain);
  crowd.connect(cf).connect(cg).connect(master);
  crowd.start();
  clfo.start();

  // ---- 16th-note lookahead sequencer over a 4-bar loop --------------------
  function playStep(globalStep: number, t: number) {
    const bar = Math.floor(globalStep / 16) % BARS.length;
    const s = globalStep % 16;
    const { root, chord } = BARS[bar];

    shaker(t, s % 2 === 0 ? 0.045 : 0.025); // driving 16ths, accented 8ths
    if (s === 4 || s === 12) surdo(t, 0.5); // surdo on 2 & 4
    if (s === 15) surdo(t, 0.16); // pickup ghost
    if (BELL_STEPS.has(s)) bell(t, s === 3 || s === 10);
    if (s === 0 || s === 3) bass(t, root);
    if (s === 6) bass(t, root * 1.5);
    if (s === 10) bass(t, root * 2);
    if (s === 14) bass(t, root * 1.5);
    if (s === 2 || s === 10) stab(t, chord);
    if (bar === BARS.length - 1 && s >= 8 && s % 2 === 0) {
      spark(t, PENTA[(s / 2) % PENTA.length]); // turnaround sparkle run
    }
  }

  let step = 0;
  let nextTime = ctx.currentTime + 0.06;
  const seq = window.setInterval(() => {
    while (nextTime < ctx.currentTime + 0.12) {
      playStep(step, nextTime);
      step = (step + 1) % (BARS.length * 16);
      nextTime += STEP_S;
    }
  }, 25);

  return {
    ctx,
    master,
    stop: () => {
      clearInterval(seq);
      ctx.close().catch(() => {}); // closing the context stops every node
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
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-ink-900/70 text-ivory backdrop-blur transition-colors hover:border-gold/40 hover:text-gold md:bottom-auto md:top-4"
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
