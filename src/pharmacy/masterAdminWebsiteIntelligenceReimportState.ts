/**
 * Shared detection of when Product Owner must deliberately re-run website import
 * to populate repaired Website Business Intelligence (V2) evidence.
 *
 * Reuses existing action: rerun_website_import
 * Does not execute the import.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { classifyWebsitePage } from "./growthEngineWebsiteClassifier.ts";
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";

export type WebsiteIntelligenceReimportKind =
  | "none"
  | "evidence_quality"
  | "intelligence_v2_unpopulated";

export interface WebsiteIntelligenceReimportState {
  required: boolean;
  kind: WebsiteIntelligenceReimportKind;
  reason: string;
  actionId: "rerun_website_import" | null;
  targetUrl: string;
  summary: string;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function pathFromUrl(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function isPreV2CommercialFalsePositive(sourceUrl: string, pageTitle = "", h1 = ""): boolean {
  const path = pathFromUrl(sourceUrl).toLowerCase();
  if (!path || path === "/") return false;
  const category = classifyWebsitePage(path, pageTitle || h1, "");
  return category !== "service-page";
}

/**
 * True when persisted commercialServiceEvidence still contains pages that the
 * repaired classifier would not treat as dedicated services.
 */
export function commercialServiceEvidenceNeedsV2Repair(
  commercial: Array<{ sourceUrl?: string; pageTitle?: string; h1?: string; serviceName?: string }>,
  pages: WebsitePageInventoryItem[] = [],
): boolean {
  if (!Array.isArray(commercial) || !commercial.length) return false;
  const pageByUrl = new Map(pages.map((p) => [p.url.replace(/\/$/, ""), p]));
  return commercial.some((row) => {
    const url = str(row.sourceUrl);
    if (!url) return false;
    const page = pageByUrl.get(url.replace(/\/$/, ""));
    return isPreV2CommercialFalsePositive(url, page?.title || row.pageTitle || "", page?.h1 || row.h1 || "");
  });
}

export function resolveWebsiteIntelligenceReimportState(slug: string): WebsiteIntelligenceReimportState {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const ws = buildWebsiteSourceSummary(safe);
  const targetUrl = str(ws.canonicalWebsite || data.website) || "";
  const none: WebsiteIntelligenceReimportState = {
    required: false,
    kind: "none",
    reason: "",
    actionId: null,
    targetUrl,
    summary: "",
  };

  if (!ws.websiteImported) return none;

  const snap = (data.websiteImportSnapshot || null) as Record<string, unknown> | null;
  const intel = (snap?.intelligence || null) as Record<string, unknown> | null;
  const eq = (intel?.evidenceQuality || null) as {
    safeForBusinessProfileReview?: boolean;
    blockers?: string[];
  } | null;
  const reimportBlocker = (eq?.blockers || []).some((b) => /re-?import required/i.test(String(b)));
  if (eq && eq.safeForBusinessProfileReview === false && reimportBlocker) {
    return {
      required: true,
      kind: "evidence_quality",
      reason: eq.blockers?.[0] || "Evidence quality requires website re-import",
      actionId: "rerun_website_import",
      targetUrl,
      summary:
        "Evidence quality blocked — re-import required. Use Re-import Website to refresh Business Intelligence evidence.",
    };
  }

  const commercial = Array.isArray(intel?.commercialServiceEvidence)
    ? (intel!.commercialServiceEvidence as Array<{ sourceUrl?: string; pageTitle?: string; h1?: string }>)
    : [];
  const pages = Array.isArray((intel?.structure as { pages?: WebsitePageInventoryItem[] } | undefined)?.pages)
    ? ((intel!.structure as { pages: WebsitePageInventoryItem[] }).pages || [])
    : [];
  const needsCommercialRepair = commercialServiceEvidenceNeedsV2Repair(commercial, pages);
  // Only require V2 re-import when persisted commercial evidence still contains
  // pre-repair false positives (articles/pricing/offers/landings as services).
  // Do not force every historical tenant merely because new optional V2 arrays are empty.
  if (needsCommercialRepair) {
    return {
      required: true,
      kind: "intelligence_v2_unpopulated",
      reason:
        "Persisted commercial service evidence predates Website Intelligence V2 classification repair",
      actionId: "rerun_website_import",
      targetUrl,
      summary:
        "Website Intelligence V2 repair is deployed — fresh website re-import required before Business Profile Review. Use Re-import Website.",
    };
  }

  return none;
}

export function isStaleBranchSelectionEvidenceMessage(message: string): boolean {
  return /multiple pharmacy branches detected/i.test(str(message));
}
