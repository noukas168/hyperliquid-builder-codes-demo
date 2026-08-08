import type { Metadata } from "next";
import { Roboto, Ubuntu } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

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

export const metadata: Metadata = {
  // Basis is the root route, so this is its metadata as well as the default
  // for anything without its own. /hyperliquid overrides it.
  title: "Basis, non-custodial spot trading on BNB Chain",
  description:
    "Non-custodial spot trading on BNB Chain. Safety checks on every token, shown before you trade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`next-dark-theme ${ubuntu.variable} ${roboto.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;600;700&family=Roboto:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${ubuntu.variable} ${roboto.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
