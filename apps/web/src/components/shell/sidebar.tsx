"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS, type NavItem } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Modules"
      className="flex w-[4.75rem] shrink-0 flex-col border-r border-border bg-surface xl:w-56"
    >
      <div className="label-caps hidden px-4 pt-4 pb-2 xl:block">LUNARIS</div>
      <ul className="flex flex-col gap-0.5 p-2 pt-3 xl:pt-0">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <NavLink item={item} active={item.href === pathname} />
          </li>
        ))}
      </ul>

      <div className="mt-auto hidden border-t border-hairline p-4 xl:block">
        <p className="label-caps mb-1.5">Scope</p>
        <p className="text-2xs leading-relaxed text-dim">
          Preliminary mission-planning and research tool. Not a certified spacecraft landing system.
        </p>
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          data-testid={`nav-${item.id}`}
          className={cn(
            "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-3xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 xl:h-9 xl:min-h-0 xl:flex-row xl:justify-start xl:gap-2.5 xl:px-2.5 xl:py-0 xl:text-xs",
            active
              ? "bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="max-w-full truncate text-center leading-tight xl:hidden">{item.shortTitle}</span>
          <span className="hidden min-w-0 flex-1 truncate xl:inline">{item.title}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-medium text-foreground">{item.title}</p>
        <p className="text-muted-foreground">{item.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
