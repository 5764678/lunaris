"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MISSION_MODULES, type MissionModule } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Modules"
      className="flex w-14 shrink-0 flex-col border-r border-border bg-surface xl:w-56"
    >
      <div className="label-caps hidden px-4 pt-4 pb-2 xl:block">Mission modules</div>
      <ul className="flex flex-col gap-0.5 p-2 pt-3 xl:pt-0">
        {MISSION_MODULES.map((module) => (
          <li key={module.id}>
            <NavItem module={module} active={module.href === pathname} />
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

function NavItem({ module, active }: { module: MissionModule; active: boolean }) {
  const Icon = module.icon;
  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden min-w-0 flex-1 truncate xl:inline">{module.title}</span>
      {!module.href && (
        <span className="hidden rounded-sm border border-hairline px-1 font-mono text-3xs text-dim xl:inline">
          {module.milestone}
        </span>
      )}
    </>
  );
  const base =
    "relative flex h-9 items-center justify-center gap-2.5 rounded-md px-2.5 text-xs outline-none xl:justify-start";

  const item = module.href ? (
    <Link
      href={module.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {content}
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={cn(base, "cursor-not-allowed text-dim/80")}
      data-testid={`nav-planned-${module.id}`}
    >
      {content}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-medium text-foreground">{module.title}</p>
        <p className="text-muted-foreground">{module.description}</p>
        <p className="mt-1 font-mono text-3xs uppercase tracking-wider text-dim">
          {module.href
            ? `Available · ${module.milestone}`
            : `Planned · ${module.milestone} — not implemented`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
