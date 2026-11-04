"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        "inline-flex items-center gap-px rounded-md border border-border bg-panel-sunken/80 p-0.5 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-[4px] px-2 font-mono text-3xs uppercase tracking-[0.1em] text-dim outline-none transition-colors",
        "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=on]:bg-accent data-[state=on]:text-primary",
        "[&_svg]:size-3 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
