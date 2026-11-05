"use client";

import type { DatasetStatus } from "@lunaris/shared-types";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DATASET_STATUS: Record<
  DatasetStatus,
  { label: string; dot: string; text: string; hint: string }
> = {
  missing: {
    label: "Missing",
    dot: "bg-dim",
    text: "text-dim",
    hint: "Not present in the local data store.",
  },
  untracked: {
    label: "Untracked",
    dot: "bg-warn",
    text: "text-warn",
    hint: "Files present without an acquisition record — provenance unknown, not used.",
  },
  incomplete: {
    label: "Incomplete",
    dot: "bg-critical",
    text: "text-critical",
    hint: "Acquisition record exists but files are missing or differ in size.",
  },
  acquired: {
    label: "Acquired",
    dot: "bg-ok",
    text: "text-ok",
    hint: "All files present and consistent with the acquisition record.",
  },
  remote_window: {
    label: "Remote",
    dot: "bg-ok",
    text: "text-muted-foreground",
    hint: "Read as windows over HTTP byte ranges; never downloaded whole.",
  },
};

export function DatasetStatusPill({ status, className }: { status: DatasetStatus; className?: string }) {
  const view = DATASET_STATUS[status];
  return (
    <span
      title={view.hint}
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-3xs uppercase tracking-[0.08em]",
        view.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", view.dot)} aria-hidden="true" />
      {view.label}
    </span>
  );
}

export function CopyCommand({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md border border-hairline bg-panel-sunken pl-2",
        className,
      )}
    >
      <code className="min-w-0 flex-1 truncate font-mono text-3xs text-muted-foreground">{command}</code>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Copy command: ${command}`}
        onClick={() => {
          void navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          });
        }}
      >
        {copied ? <Check className="text-ok" /> : <Copy />}
      </Button>
    </div>
  );
}
