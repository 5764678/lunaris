import Link from "next/link";

/**
 * An explicit "in progress" page for a nav destination whose view another session is
 * still building. It says what is coming and where the same outputs already appear;
 * it shows no values of its own.
 */
export function PageInProgress({
  title,
  task,
  coming,
  availableNow,
}: {
  title: string;
  task: string;
  coming: string;
  availableNow: { label: string; href: string }[];
}) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6" data-testid="page-in-progress">
        <header className="space-y-1.5">
          <p className="label-caps">In progress · {task}</p>
          <h1 className="text-lg font-medium text-foreground">{title}</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">{coming}</p>
        </header>
        <div className="hatch rounded-md border border-dashed border-border p-4">
          <p className="font-mono text-3xs uppercase tracking-[0.14em] text-dim">
            This page has no content yet
          </p>
          <p className="mt-2 text-2xs text-muted-foreground">
            The same computed outputs are already available here:
          </p>
          <ul className="mt-1.5 space-y-1">
            {availableNow.map((link) => (
              <li key={link.href + link.label}>
                <Link
                  href={link.href}
                  className="text-2xs text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
