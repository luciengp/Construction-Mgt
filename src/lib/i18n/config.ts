// Framework-free locale config shared by server and client.

export const LANGS = ["en", "th"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export function isLang(v: string | undefined | null): v is Lang {
  return v === "en" || v === "th";
}

export const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  th: "ไทย",
};
