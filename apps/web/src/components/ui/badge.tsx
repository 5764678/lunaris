import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-3xs font-medium uppercase tracking-[0.08em] [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        info: "border-info/30 bg-info/10 text-info",
        ok: "border-ok/30 bg-ok/10 text-ok",
        warn: "border-warn/35 bg-warn/10 text-warn",
        critical: "border-critical/35 bg-critical/10 text-critical",
        muted: "border-hairline bg-panel-sunken text-dim",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
