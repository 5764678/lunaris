"use client";

import { usePathname } from "next/navigation";

import { isLessonRoute } from "@/lib/lesson/route";

import { WakingBanner } from "./waking-banner";

/**
 * The waking-server banner polls the API. The lesson route never calls the API (D10, L3), so
 * it has no banner and no polling there; every other page is unchanged.
 */
export function WakingBannerGate() {
  return isLessonRoute(usePathname()) ? null : <WakingBanner />;
}
