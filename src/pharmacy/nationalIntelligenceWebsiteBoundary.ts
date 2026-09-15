/**
 * NI-03A — Website intelligence boundary contract only.
 * Does not merge import V2 and Growth Engine crawl pipelines.
 * Does not build customer-vs-competitor page comparison.
 * Future national evidence items may reference these fields.
 */
import type { NationalEvidenceSourceType } from "./nationalIntelligenceEvidenceProvenance.ts";

export interface NationalWebsiteEvidenceRef {
  tenantSlug: string;
  pageUrl: string;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  detectedServiceId: string | null;
  inventoryCategory: string | null;
  websiteGap: string | null;
  evidenceSource: Extract<NationalEvidenceSourceType, "WEBSITE_IMPORT" | "WEBSITE_INTELLIGENCE">;
}

export const NATIONAL_WEBSITE_EVIDENCE_BOUNDARY =
  "Website intelligence may later attach existing customer page, service, URL, title/H1/meta, inventory and website-gap refs. It is not a GP-01 ranking input in NI-03A.";
