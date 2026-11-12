import { DEFAULT_LANGUAGE, isLanguage, type Language } from "./messages";

/**
 * The chosen language lives in localStorage and nowhere else: no cookie, no route prefix, so
 * every page stays statically renderable. The server and the first client render always use
 * the default (Thai); `useLanguage` switches after hydration, so there is no hydration mismatch.
 */
export const LANGUAGE_STORAGE_KEY = "lunaris.lang";

const listeners = new Set<() => void>();

export function readStoredLanguage(): Language {
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(raw) ? raw : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE; // storage blocked or unavailable (private window, LINE in-app browser)
  }
}

let memoryOverride: Language | null = null;

export function getLanguageSnapshot(): Language {
  return memoryOverride ?? readStoredLanguage();
}

export function getServerLanguageSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

export function setLanguage(next: Language): void {
  memoryOverride = next; // keeps working when storage throws
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    /* the in-memory choice still applies until the page is closed */
  }
  for (const listener of listeners) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      memoryOverride = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: forget the in-memory choice. */
export function resetLanguageForTests(): void {
  memoryOverride = null;
  listeners.clear();
}
