"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What a horizontally scrolling box is showing: all of its content, or all but the far right. */
export type ScrollState = "fits" | "more" | "end";

/**
 * Browsers report fractional positions, so the last pixel is not counted: a box that overflows by
 * one pixel or less "fits", and a box scrolled to within one pixel of its end is "at the end".
 */
export function scrollState(box: {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}): ScrollState {
  const furthest = box.scrollWidth - box.clientWidth;
  if (furthest <= 1) return "fits";
  return box.scrollLeft < furthest - 1 ? "more" : "end";
}

/**
 * A box that scrolls sideways and says so. While content is hidden on the right it fades the right
 * edge and shows a "More columns" button above the box; the button hides again at the far end (its
 * row stays, so the table does not jump). The box has a scrollbar that stays visible, a name for
 * screen readers, and can be focused so the arrow keys scroll it.
 *
 * It watches the box and its first child, so the table should be that first child.
 */
export function HorizontalScroll({
  label,
  moreLabel = "More columns",
  testId,
  className,
  children,
}: {
  /** Accessible name of the scrolling region, e.g. "Comparison table (scrolls sideways)". */
  label: string;
  moreLabel?: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<ScrollState>("fits");
  // Height of a classic scrollbar, so the fade stops above it. Zero for overlay scrollbars.
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const next = scrollState(box);
      setState(next);
      setBarHeight(Math.max(0, box.offsetHeight - box.clientHeight - 2 * box.clientTop));
      // The button hides at the far end. Keep keyboard focus in the region instead of dropping it.
      if (next !== "more" && document.activeElement === cueRef.current) box.focus({ preventScroll: true });
    };
    // A ResizeObserver reports the size once when it starts, which is the first measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    box.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      box.removeEventListener("scroll", measure);
    };
  }, []);

  function showMore() {
    const box = boxRef.current;
    if (!box) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollBy({ left: Math.max(240, box.clientWidth * 0.7), behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <div className={className}>
      {state !== "fits" && (
        <div className="mb-1.5 flex h-6 justify-end">
          <Button
            ref={cueRef}
            type="button"
            size="xs"
            variant="secondary"
            onClick={showMore}
            className={cn(state === "end" && "invisible")}
            data-testid={testId ? `${testId}-more` : undefined}
          >
            {moreLabel} <ChevronRight />
          </Button>
        </div>
      )}
      <div className="relative">
        <div
          ref={boxRef}
          role="region"
          aria-label={label}
          tabIndex={0}
          data-testid={testId}
          data-scroll-state={state}
          className="scrollbar-visible overflow-x-auto rounded-md border border-hairline outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {children}
        </div>
        {state === "more" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-px right-px w-10 rounded-r-[5px] bg-linear-to-l from-background/90 to-transparent"
            style={{ bottom: barHeight + 1 }}
          />
        )}
      </div>
    </div>
  );
}
