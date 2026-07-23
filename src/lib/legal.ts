import { createClient } from "@/lib/supabase/server";
import { compareVersions } from "@/domain/legalGate";

export const PLATFORM_TERMS_SLUG = "platform-terms";

export interface LegalDocument {
  slug: string;
  version: string;
  bodyMd: string;
  effectiveAt: string;
}

/**
 * The current (highest-version) platform terms. Readable pre-auth via the
 * legal_documents RLS select policy.
 */
export async function getCurrentTerms(): Promise<LegalDocument | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select("slug, version, body_md, effective_at")
    .eq("slug", PLATFORM_TERMS_SLUG);
  if (error || !data || data.length === 0) return null;

  const latest = [...data].sort((a, b) =>
    compareVersions(a.version, b.version)
  )[data.length - 1];
  return {
    slug: latest.slug,
    version: latest.version,
    bodyMd: latest.body_md,
    effectiveAt: latest.effective_at,
  };
}
