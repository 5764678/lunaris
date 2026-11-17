import type { Metadata } from "next";

import { LearnStepPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn · 5" };

export default function LearnPeriod5Page() {
  return <LearnStepPage period={5} />;
}
