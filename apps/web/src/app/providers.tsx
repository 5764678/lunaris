"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { queryKeys } from "@/lib/api/queries";
import { LanguageSync } from "@/lib/i18n";
import { retryWhileWaking } from "@/lib/api/waking";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // One retry, and no giving up while a sleeping server wakes (see `retryWhileWaking`).
        retry: (failureCount, error) =>
          retryWhileWaking(failureCount, error, {
            serverAnswered: (client.getQueryState(queryKeys.health)?.dataUpdatedAt ?? 0) > 0,
            sincePageLoadMs: performance.now(),
          }),
        refetchOnWindowFocus: true,
        staleTime: 10_000,
      },
      mutations: { retry: 0 },
    },
  });
  return client;
}

function getQueryClient() {
  // Isolate server renders; reuse one client in the browser (Next.js guidance).
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <TooltipProvider>
        <LanguageSync />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
