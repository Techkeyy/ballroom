/**
 * A faint, fixed layer of the hero art behind every page — so the image sits
 * *underneath* the writing app-wide instead of only on the landing. Kept very
 * low-contrast and masked so it reads as texture, never noise.
 */
export default function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero.jpg"
        alt=""
        className="h-full w-full object-cover object-center"
        style={{
          opacity: 0.14,
          filter: "blur(2px) saturate(0.9)",
          WebkitMaskImage:
            "radial-gradient(120% 90% at 50% 12%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)",
          maskImage:
            "radial-gradient(120% 90% at 50% 12%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 520px at 50% -10%, rgba(226,182,91,0.06), transparent 60%), linear-gradient(to bottom, rgba(11,10,14,0.55), #0b0a0e 70%)",
        }}
      />
    </div>
  );
}
