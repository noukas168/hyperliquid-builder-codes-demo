import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Roboto, Ubuntu } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

// Ubuntu and Roboto are the Dwellir brand faces, still used by the Hyperliquid
// wizard at /hyperliquid.
const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ubuntu",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto",
});

// Basis interface text.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

// Every numeral in Basis. A monospace with tabular figures is what keeps
// digits in their column and decimal points aligned down a table.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  // Basis is the root route, so this is its metadata as well as the default
  // for anything without its own. /hyperliquid overrides it.
  title: "Basis, non-custodial spot trading on BNB Chain",
  description:
    "Non-custodial spot trading on BNB Chain. Safety checks on every token, shown before you trade.",
  /**
   * Declared on the root layout, so every route inherits it. The segment
   * layout at /hyperliquid overrides only title and description, and metadata
   * merges rather than replaces, so these icons apply there too.
   *
   * The SVG is listed first for browsers that take it: it stays sharp at any
   * size. The .ico carries 16, 32 and 48px rasters for those that do not.
   */
  icons: {
    icon: [
      { url: "/brand/icon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

const fontVars = `${ubuntu.variable} ${roboto.variable} ${inter.variable} ${jetbrainsMono.variable}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next/font self-hosts every face above and serves it from this origin.
    // The hand-written <link> to fonts.googleapis.com that used to sit here was
    // both redundant and render-blocking, and it was the reason the CSS
    // variables had to name the families literally.
    <html lang="en" className={`next-dark-theme ${fontVars}`}>
      <body className={fontVars}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
