"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("LUNARIS view error", error);
  }, [error]);

  return (
    <div role="alert" className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-critical/30 bg-critical/5 p-5 text-center">
        <p className="label-caps text-critical">View error</p>
        <p className="mt-2 text-xs text-foreground">This view failed to render.</p>
        {error.digest && <p className="mt-1 font-mono text-3xs text-dim">digest {error.digest}</p>}
        <Button className="mt-4" size="sm" variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
