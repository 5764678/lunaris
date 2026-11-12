"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-panel-sunken/90 p-0.5 backdrop-blur-sm",
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
        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-2xs font-medium text-muted-foreground outline-none transition-colors",
        "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=on]:bg-accent data-[state=on]:font-semibold data-[state=on]:text-primary",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
