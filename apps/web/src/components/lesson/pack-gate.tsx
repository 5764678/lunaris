"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

import type { ResourceState } from "./use-pack-resource";

/** Loading and error states shared by the steps that read the pack. No number is shown until it loaded. */
export function PackGate<T>({
  state,
  reload,
  children,
}: {
  state: ResourceState<T>;
  reload: () => void;
  children: (value: T) => ReactNode;
}) {
  const t = useT().learn.pack;
  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t.loading}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="space-y-2 rounded-md border border-critical p-3 text-sm">
        <p className="font-medium text-critical">{t.error}</p>
        <p lang="en" className="text-muted-foreground">
          {state.message}
        </p>
        <Button type="button" variant="outline" className="h-11 px-4 text-sm" onClick={reload}>
          {t.retry}
        </Button>
      </div>
    );
  }
  return <>{children(state.value)}</>;
}
