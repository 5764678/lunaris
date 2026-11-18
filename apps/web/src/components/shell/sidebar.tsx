"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n";
import { NAV_ITEMS, type NavItem } from "@/lib/modules";
import { cn } from "@/lib/utils";

/** The page itself, or any page under it (/learn/2 keeps "Learn" highlighted). */
function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      data-testid="main-nav"
      aria-label={t.shell.modulesLabel}
      className="flex w-[5rem] shrink-0 flex-col border-r border-border bg-surface xl:w-60"
    >
      <div className="label-caps hidden px-4 pt-4 pb-2 xl:block">LUNARIS</div>
      <ul className="flex flex-col gap-1 p-1.5 pt-3 xl:p-3 xl:pt-0">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <NavLink item={item} active={isActive(item.href, pathname)} />
          </li>
        ))}
      </ul>

      <div className="mt-auto hidden border-t border-hairline p-4 xl:block">
        <p className="label-caps mb-1.5">{t.shell.scopeHeading}</p>
        <p className="text-2xs leading-relaxed text-dim">{t.shell.scopeNote}</p>
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const text = useT().nav[item.id];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          data-testid={`nav-${item.id}`}
          className={cn(
            "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-3xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 xl:h-11 xl:min-h-0 xl:flex-row xl:justify-start xl:gap-2.5 xl:px-2.5 xl:py-0 xl:text-sm",
            active
              ? "bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="max-w-full truncate text-center leading-tight xl:hidden">{text.shortTitle}</span>
          <span className="hidden min-w-0 flex-1 truncate xl:inline">{text.title}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-medium text-foreground">{text.title}</p>
        <p className="text-muted-foreground">{text.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
