import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-panel-sunken px-2.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-dim",
        "focus-visible:border-primary-strong/70 focus-visible:ring-2 focus-visible:ring-ring/30",
        "aria-invalid:border-critical/60 aria-invalid:ring-critical/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
