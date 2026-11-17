import type { Metadata } from "next";

import { LearnStepPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn · 1" };

export default function LearnPeriod1Page() {
  return <LearnStepPage period={1} />;
}
