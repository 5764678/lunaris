import type { Metadata } from "next";

import { LearnStepPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn · 3" };

export default function LearnPeriod3Page() {
  return <LearnStepPage period={3} />;
}
