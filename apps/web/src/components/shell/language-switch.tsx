"use client";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Two-button language switch for the top bar. Thai first, because Thai is the default. */
export function LanguageSwitch() {
  const { lang, t, setLang } = useLanguage();
  return (
    <div
      role="group"
      aria-label={t.language.label}
      className="flex h-7 items-center rounded-md border border-border bg-panel p-0.5"
    >
      {(["th", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          data-testid={`lang-${code}`}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={cn(
            "h-full rounded-sm px-2 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            lang === code ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.language[code]}
        </button>
      ))}
    </div>
  );
}
