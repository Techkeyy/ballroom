import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Space_Grotesk,
  Inter,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";
import SolanaProvider from "@/components/SolanaProvider";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-num",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Ball Room — read the market, not the match",
  description:
    "Race your friends to call where the live World Cup odds move next. Powered by TxLINE consensus odds, signed in with Solana. Free to play, skill only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${grotesk.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="parquet font-sans text-ivory antialiased">
        <SolanaProvider>
          <div className="mx-auto min-h-screen w-full max-w-md px-5">
            {children}
          </div>
        </SolanaProvider>
      </body>
    </html>
  );
}
