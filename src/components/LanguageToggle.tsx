"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANGS, LANG_COOKIE, LANG_LABEL, type Lang } from "@/lib/i18n/config";
import { useLang } from "@/lib/i18n/LanguageProvider";

/**
 * Language switch for the app header. Writes the choice to a year-long cookie
 * and refreshes so both server components (which read the cookie) and client
 * components (which read the context) pick up the new locale.
 */
export function LanguageToggle() {
  const current = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(lang: Lang) {
    if (lang === current) return;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center rounded-full bg-white/15 p-0.5 text-[11px] font-semibold">
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          disabled={pending}
          onClick={() => choose(lang)}
          aria-pressed={current === lang}
          className={`rounded-full px-2 py-0.5 transition-colors ${
            current === lang ? "bg-white text-navy" : "text-white/80"
          }`}
        >
          {LANG_LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
