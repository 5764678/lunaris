import type { Metadata } from "next";

import { LearnStepPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn · 4" };

export default function LearnPeriod4Page() {
  return <LearnStepPage period={4} />;
}
