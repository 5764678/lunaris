"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  groupSources,
  linkify,
  referenceLine,
  type DatasetGroup,
  type Reference,
  type SourceInput,
} from "@/lib/references";
import { cn } from "@/lib/utils";

function isHttps(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

const LINK =
  "text-foreground underline decoration-dotted underline-offset-2 hover:text-primary [overflow-wrap:anywhere]";

/** Plain text with DOIs and web addresses turned into links. */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        part.href && isHttps(part.href) ? (
          <a key={i} href={part.href} target="_blank" rel="noreferrer noopener" className={LINK}>
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** One reference in the app's single style, with its DOI as a link. */
export function ReferenceItem({ reference }: { reference: Reference }) {
  return (
    <span data-testid="reference">
      <Linkified text={reference.text} />
      {reference.doi && reference.url && (
        <>
          {" "}
          <a href={reference.url} target="_blank" rel="noreferrer noopener" className={LINK}>
            doi:{reference.doi}
          </a>
        </>
      )}
    </span>
  );
}

export function ReferenceList({ references, className }: { references: Reference[]; className?: string }) {
  return (
    <ul className={cn("space-y-1.5", className)}>
      {references.map((ref) => (
        <li key={ref.doi ?? ref.text}>
          <ReferenceItem reference={ref} />
        </li>
      ))}
    </ul>
  );
}

function DatasetBlock({ group }: { group: DatasetGroup }) {
  return (
    <li className="space-y-1" data-testid="cell-evidence-source">
      <p className="text-foreground">
        {isHttps(group.pageUrl) ? (
          <a
            href={group.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-primary"
          >
            {group.name}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : (
          group.name
        )}
      </p>
      {group.references.length > 0 && (
        <ReferenceList references={group.references} className="pl-3 text-3xs text-muted-foreground" />
      )}
    </li>
  );
}

/** The datasets behind a value, each once, with each reference printed once under it. */
export function SourceList({ sources }: { sources: readonly SourceInput[] }) {
  const groups = groupSources(sources);
  if (groups.length === 0) return null;
  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <DatasetBlock key={g.id} group={g} />
      ))}
    </ul>
  );
}

/** Files, versions and checksums: for someone checking the exact bytes, not for the main reading. */
export function SourceFiles({ sources }: { sources: readonly SourceInput[] }) {
  const groups = groupSources(sources);
  const files = groups.flatMap((g) => g.files);
  if (files.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {files.map((f, i) => (
        <li key={`${f.title}-${i}`} className="text-3xs text-muted-foreground">
          {isHttps(f.url) ? (
            <a href={f.url} target="_blank" rel="noreferrer noopener" className={LINK}>
              {f.title}
            </a>
          ) : (
            f.title
          )}
          {(f.sha256 || f.version) && (
            <span className="block font-mono break-all text-dim">
              {f.sha256 ? `SHA-256 ${f.sha256}` : f.version}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Copies every reference as plain text, one per line, for a submission form or a report. */
export function CopyReferencesButton({
  references,
  intro,
}: {
  references: Reference[];
  /** Text copied before the references, such as a list of the data used. */
  intro?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      data-testid="copy-references"
      onClick={() => {
        const text = [intro, references.map(referenceLine).join("\n\n")].filter(Boolean).join("\n\n");
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2_000);
          })
          .catch(() => setCopied(false));
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy all"}
    </Button>
  );
}
