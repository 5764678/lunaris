import type { Metadata } from "next";

import { LearnIndexPage } from "@/components/lesson/step-pages";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return <LearnIndexPage />;
}
