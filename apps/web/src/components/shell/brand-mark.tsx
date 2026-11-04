import { cn } from "@/lib/utils";

/**
 * LUNARIS mark: the lunar disk with its horizon line and the south pole marked —
 * the region the platform is built around.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-6", className)}>
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 16a10.5 10.5 0 0 0 21 0" fill="currentColor" fillOpacity="0.22" />
      <path d="M5.5 16h21" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.75" />
      <circle cx="16" cy="26.5" r="1.7" fill="#e6eaef" />
    </svg>
  );
}
