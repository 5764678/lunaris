/** The lesson route (`/learn`, `/learn/2`, ...): static data only, no API traffic (D10, L3). */
export function isLessonRoute(pathname: string | null): boolean {
  return pathname === "/learn" || (pathname?.startsWith("/learn/") ?? false);
}
