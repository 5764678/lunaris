import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LearnStepPage } from "@/components/lesson/step-pages";
import { PERIODS, parsePeriod } from "@/components/lesson/steps";

export const metadata: Metadata = { title: "Learn" };

export function generateStaticParams() {
  return PERIODS.map((p) => ({ period: String(p) }));
}

export default async function LearnPeriodPage({ params }: PageProps<"/learn/[period]">) {
  const { period } = await params;
  const parsed = parsePeriod(period);
  if (parsed === null) notFound();
  return <LearnStepPage period={parsed} />;
}
