import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/shell/app-shell";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LUNARIS — Lunar Mission Intelligence",
    template: "%s · LUNARIS",
  },
  description:
    "LUNARIS — Lunar Mission Intelligence & Surface Operations Platform. A preliminary " +
    "mission-planning and research tool built on NASA lunar datasets. Not a certified " +
    "spacecraft landing system.",
  applicationName: "LUNARIS",
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
