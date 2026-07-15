"use client";

/**
 * Matchday soundtrack — plays /public/matchday.mp3 on a loop. Autoplay is
 * attempted; browsers block audible autoplay, so if it's refused we start on
 * the first user gesture. Volume fades in, and the on/off choice persists.
 */

import { useEffect, useRef, useState } from "react";

const PREF_KEY = "ballroom.sound";
const TRACK = "/matchday.mp3";
const VOLUME = 0.55;

export default function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | undefined>(undefined);
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ramp volume toward a target over ~1.2s.
  function fadeTo(target: number) {
    const el = audioRef.current;
    if (!el) return;
    if (fadeRef.current) window.clearInterval(fadeRef.current);
    const step = (target - el.volume) / 24;
    fadeRef.current = window.setInterval(() => {
      if (!audioRef.current) return;
      const next = audioRef.current.volume + step;
      if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
        audioRef.current.volume = Math.max(0, Math.min(1, target));
        window.clearInterval(fadeRef.current);
        fadeRef.current = undefined;
        if (target === 0) audioRef.current.pause();
      } else {
        audioRef.current.volume = Math.max(0, Math.min(1, next));
      }
    }, 50);
  }

  useEffect(() => {
    setMounted(true);
    const el = new Audio(TRACK);
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    audioRef.current = el;

    if (localStorage.getItem(PREF_KEY) === "off") {
      return () => {
        el.pause();
        audioRef.current = null;
      };
    }

    let gestureBound = false;
    const kick = () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      gestureBound = false;
      if (localStorage.getItem(PREF_KEY) === "off") return;
      el.play()
        .then(() => {
          setOn(true);
          fadeTo(VOLUME);
        })
        .catch(() => {});
    };

    // try autoplay; if the browser refuses, start on the first gesture
    el.play()
      .then(() => {
        setOn(true);
        fadeTo(VOLUME);
      })
      .catch(() => {
        window.addEventListener("pointerdown", kick, { once: true });
        window.addEventListener("keydown", kick, { once: true });
        gestureBound = true;
      });

    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current);
      if (gestureBound) {
        window.removeEventListener("pointerdown", kick);
        window.removeEventListener("keydown", kick);
      }
      el.pause();
      audioRef.current = null;
    };
  }, []);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (on) {
      fadeTo(0); // fadeTo pauses once it hits 0
      setOn(false);
      localStorage.setItem(PREF_KEY, "off");
    } else {
      el.volume = 0;
      el.play()
        .then(() => {
          setOn(true);
          fadeTo(VOLUME);
          localStorage.setItem(PREF_KEY, "on");
        })
        .catch(() => {});
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
