"use client";

import { createContext, useContext } from "react";
import type { Lang } from "./config";
import { getDict, type Dict } from "./dictionaries";

interface LanguageValue {
  lang: Lang;
  dict: Dict;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <LanguageContext.Provider value={{ lang, dict: getDict(lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Lang {
  const ctx = useContext(LanguageContext);
  return ctx?.lang ?? "en";
}

export function useDict(): Dict {
  const ctx = useContext(LanguageContext);
  return ctx?.dict ?? getDict("en");
}
