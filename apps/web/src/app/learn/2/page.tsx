import type { Metadata } from "next";

import { LearnStepPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn · 2" };

export default function LearnPeriod2Page() {
  return <LearnStepPage period={2} />;
}
