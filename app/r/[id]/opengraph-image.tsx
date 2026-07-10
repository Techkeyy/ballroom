import { ImageResponse } from "next/og";
import { getReceipt } from "@/lib/receipts-server";

// Edge: next/og's node runtime hits a Windows path bug in dev, and edge is the
// canonical runtime for OG images on Vercel anyway.
export const runtime = "edge";
export const alt = "Ball Room receipt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ---- Google Fonts as TTF (Satori can't take woff2) -------------------------

const fontCache = new Map<string, Promise<ArrayBuffer>>();

function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;
  const p = (async () => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}`;
    // No modern UA header -> Google serves truetype sources.
    const css = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Satori)" },
    }).then((r) => r.text());
    const m = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/);
    if (!m) throw new Error(`no ttf source for ${key}`);
    return fetch(m[1]).then((r) => r.arrayBuffer());
  })();
  fontCache.set(key, p);
  return p;
}

// ---- the ticket -------------------------------------------------------------

const INK = "#0b0a0e";
const INK2 = "#16141d";
const IVORY = "#efece6";
const DIM = "#b3aeba";
const FAINT = "#7d7787";
const GOLD = "#e2b65b";

export default async function Image({ params }: { params: { id: string } }) {
  const [r, serif, grotesk, mono] = await Promise.all([
    getReceipt(params.id),
    loadGoogleFont("Cormorant Garamond", 600),
    loadGoogleFont("Space Grotesk", 300),
    loadGoogleFont("IBM Plex Mono", 500),
  ]);

  const err = r ? Math.round(Math.abs(r.guess - r.actual) * 10) / 10 : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: INK,
          padding: 48,
        }}
      >
        {/* outer gold frame */}
        <div
          style={{
            flex: 1,
            display: "flex",
            border: `2px solid ${GOLD}80`,
            borderRadius: 18,
            padding: 10,
          }}
        >
          {/* inner ticket */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background: INK2,
              border: `1px solid ${GOLD}40`,
              borderRadius: 12,
              padding: "44px 56px",
            }}
          >
            {/* header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "IBM Plex Mono",
                  fontSize: 22,
                  letterSpacing: 8,
                  color: GOLD,
                }}
              >
                BALL ROOM
              </span>
              <span
                style={{
                  fontFamily: "IBM Plex Mono",
                  fontSize: 20,
                  letterSpacing: 6,
                  color: r && r.points >= 90 ? GOLD : DIM,
                }}
              >
                {r ? r.verdict.toUpperCase() : "RECEIPT"}
              </span>
            </div>

            {r ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "auto",
                  gap: 36,
                }}
              >
                {/* matchup + the claim */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontFamily: "Cormorant Garamond",
                      fontSize: 58,
                      color: IVORY,
                      lineHeight: 1.1,
                    }}
                  >
                    {r.home} v {r.away} · {r.minute}′
                  </span>
                  <span
                    style={{
                      fontFamily: "Cormorant Garamond",
                      fontSize: 36,
                      fontStyle: "italic",
                      color: GOLD,
                      marginTop: 8,
                    }}
                  >
                    {r.playerName} called it
                  </span>
                </div>

                {/* the numbers */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 64,
                    borderTop: `1px solid ${IVORY}22`,
                    paddingTop: 34,
                  }}
                >
                  <Stat label="MARKET MOVED" value={`${r.startProb}→${r.actual}`} />
                  <Stat label="THEY CALLED" value={String(r.guess)} gold />
                  <Stat label="OFF BY" value={String(err)} />
                  <span
                    style={{
                      fontFamily: "Space Grotesk",
                      fontSize: 88,
                      color: GOLD,
                      lineHeight: 0.9,
                      marginLeft: "auto",
                    }}
                  >
                    +{r.points}
                  </span>
                </div>
              </div>
            ) : (
              <span
                style={{
                  fontFamily: "Cormorant Garamond",
                  fontSize: 52,
                  fontStyle: "italic",
                  color: DIM,
                }}
              >
                Read the market, not the match.
              </span>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant Garamond", data: serif, weight: 600 },
        { name: "Space Grotesk", data: grotesk, weight: 300 },
        { name: "IBM Plex Mono", data: mono, weight: 500 },
      ],
    },
  );
}

function Stat({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontFamily: "Space Grotesk",
          fontSize: 44,
          color: gold ? GOLD : IVORY,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "IBM Plex Mono",
          fontSize: 16,
          letterSpacing: 4,
          color: FAINT,
          marginTop: 12,
        }}
      >
        {label}
      </span>
    </div>
  );
}
