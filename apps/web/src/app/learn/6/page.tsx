import type { Metadata } from "next";

import { LearnStepPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn · 6" };

export default function LearnPeriod6Page() {
  return <LearnStepPage period={6} />;
}
