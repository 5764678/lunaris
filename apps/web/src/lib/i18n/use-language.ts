"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getLanguageSnapshot,
  getServerLanguageSnapshot,
  setLanguage,
  subscribeLanguage,
} from "./language-store";
import { CATALOGUE, type Language, type Messages } from "./messages";

export interface UseLanguage {
  lang: Language;
  /** The whole catalogue for the current language, fully typed: `t.nav.learn.title`. */
  t: Messages;
  setLang: (next: Language) => void;
}

/** The current language and its messages. Works anywhere in client components; no provider. */
export function useLanguage(): UseLanguage {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguageSnapshot, getServerLanguageSnapshot);
  return { lang, t: CATALOGUE[lang], setLang: setLanguage };
}

/** Shorthand when only the messages are needed. */
export function useT(): Messages {
  return useLanguage().t;
}

/** Keeps `<html lang>` in step with the language. Mount once, in the providers. */
export function LanguageSync() {
  const { lang } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
