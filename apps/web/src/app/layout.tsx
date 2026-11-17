import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/shell/app-shell";
import { config } from "@/lib/config";
import "@/lib/i18n/thai-font.css";

import { Providers } from "./providers";
import "./globals.css";

const TITLE = "LUNARIS — Lunar Mission Intelligence";
const DESCRIPTION =
  "LUNARIS — Lunar Mission Intelligence & Surface Operations Platform. A preliminary " +
  "mission-planning and research tool built on NASA lunar datasets. Not a certified " +
  "spacecraft landing system.";

export const metadata: Metadata = {
  // Makes the link-preview image URL absolute (see opengraph-image.tsx).
  metadataBase: new URL(config.siteUrl),
  title: {
    default: TITLE,
    template: "%s · LUNARIS",
  },
  description: DESCRIPTION,
  applicationName: "LUNARIS",
  openGraph: {
    type: "website",
    siteName: "LUNARIS",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Browser chrome colour; metadata cannot read a CSS token, so this repeats --background.
  themeColor: "#f6f3ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
