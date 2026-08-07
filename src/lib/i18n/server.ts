import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LANG, isLang, LANG_COOKIE, type Lang } from "./config";
import { getDict } from "./dictionaries";

export function getLang(): Lang {
  const value = cookies().get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export function getServerDict() {
  return getDict(getLang());
}

/**
 * Pick the locale-appropriate value for DB content that stores an English
 * column plus an optional Thai (`*_th`) column. Falls back to English whenever
 * the Thai translation is missing.
 */
export function localize(
  en: string | null,
  th: string | null,
  lang: Lang
): string {
  if (lang === "th" && th && th.trim()) return th;
  return en ?? "";
}
