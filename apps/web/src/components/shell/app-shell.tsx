import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/** Fixed mission-control frame: top bar, module navigation, workspace. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh min-h-[560px] grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-background">
      <TopBar />
      <Sidebar />
      <main id="workspace" className="min-h-0 min-w-0 overflow-y-auto lg:overflow-hidden">
        {children}
      </main>
    </div>
  );
}
