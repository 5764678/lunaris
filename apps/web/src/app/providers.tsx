"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10_000 },
      mutations: { retry: 0 },
    },
  });
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
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
