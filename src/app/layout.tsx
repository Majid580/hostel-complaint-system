import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { publicEnv } from "@/lib/config/env";
import "./globals.css";

/**
 * One family, three roles. IBM Plex was drawn for an engineering company, which
 * is what this is: a maintenance record system for a university of engineering.
 * The condensed cut earns its place on a 360px screen as much as it does
 * stylistically.
 */
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${publicEnv.appName} · ${publicEnv.instituteName}`,
    template: `%s · ${publicEnv.appName}`,
  },
  description:
    "File, track and resolve hostel maintenance complaints with photos and voice notes — with a transparent, accountable timeline for every request.",
  applicationName: publicEnv.appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: publicEnv.appName, statusBarStyle: "default" },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#15161f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by the proxy. Reading it opts every route into dynamic rendering,
  // which is the price of a nonce-based Content-Security-Policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plex.variable} ${plexCondensed.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
