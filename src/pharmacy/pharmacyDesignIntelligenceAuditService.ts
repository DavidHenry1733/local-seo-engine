/**
 * Design Intelligence pipeline audit — trace captured → stored → consumed → rendered.
 */
import fs from "node:fs";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import { getPharmacyComponentDnaPath } from "./masterAdminComponentDnaPersistenceService.ts";
import { loadWebsiteImportSources } from "./pharmacyBrandDnaWebsiteImportSources.ts";
import { computeDesignIntelligenceCompleteness } from "./pharmacyDesignIntelligenceCompletenessService.ts";
import { resolveCanonicalFinalRenderRoot } from "./pharmacyCanonicalFinalRenderService.ts";

export type AuditFieldStatus = "Captured" | "Stored" | "Consumed" | "Rendered" | "Missing" | "Replaced" | "Fallback used";

export interface AuditFieldRow {
  field: string;
  captured: boolean;
  stored: boolean;
  consumed: boolean;
  rendered: boolean;
  status: AuditFieldStatus;
  notes?: string;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function readHtml(slug: string): string {
  const root = resolveCanonicalFinalRenderRoot(slug);
  const file = `${root}/pharmacy-first/index.html`;
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

export function auditDesignIntelligencePipeline(slug: string): {
  slug: string;
  completeness: ReturnType<typeof computeDesignIntelligenceCompleteness>;
  rows: AuditFieldRow[];
} {
  const evidence = loadWebsiteDesignEvidence(slug);
  const sources = loadWebsiteImportSources(slug);
  const brand = loadBrandDnaV1File(slug);
  const componentPath = getPharmacyComponentDnaPath(slug);
  const componentStored = fs.existsSync(componentPath);
  const html = readHtml(slug);
  const completeness = computeDesignIntelligenceCompleteness(evidence);

  const checks: Array<{ field: string; captured: unknown; stored: unknown; consumed: unknown; rendered: RegExp | string }> = [
    { field: "logo", captured: evidence?.header.logoUrl, stored: brand?.logoUrl, consumed: brand?.logoUrl, rendered: /logo\.(png|svg|webp|jpg)/i },
    { field: "primaryColour", captured: evidence?.colourSystem.primary[0]?.hex, stored: brand?.colours.primary, consumed: brand?.colours.primary, rendered: brand?.colours.primary || "" },
    { field: "headingFont", captured: evidence?.typography.heading.fontFamily, stored: brand?.typography.headingFont, consumed: brand?.typography.headingFont, rendered: brand?.typography.headingFont?.split(",")[0] || "" },
    { field: "bodyFont", captured: evidence?.typography.body.fontFamily, stored: brand?.typography.bodyFont, consumed: brand?.typography.bodyFont, rendered: brand?.typography.bodyFont?.split(",")[0] || "" },
    { field: "headerBackground", captured: evidence?.header.backgroundColour, stored: brand?.colours.headerBackground, consumed: brand?.colours.headerBackground, rendered: "--brand-primary" },
    { field: "footerBackground", captured: evidence?.footer.backgroundColour, stored: brand?.colours.footerBackground, consumed: brand?.colours.footerBackground, rendered: "site-footer" },
    { field: "navigation", captured: evidence?.navigation.items.length, stored: brand?.navigationLinks?.length, consumed: brand?.navigation?.confirmedItems?.length, rendered: /nav-links/i },
    { field: "heroImage", captured: evidence?.imagery.some((i) => i.role === "hero"), stored: evidence?.assets.some((a) => a.classification === "hero"), consumed: true, rendered: /website-import|data-image-source/i },
    { field: "layoutMaxWidth", captured: evidence?.layout.maxContentWidth, stored: componentStored, consumed: componentStored, rendered: /\.wrap|max-width/i },
    { field: "headerVariant", captured: evidence?.header.hasTopBar, stored: componentStored, consumed: componentStored, rendered: /data-header-variant|topbar/i },
    { field: "footerColumns", captured: evidence?.footer.columnCount, stored: brand?.footer?.columnCount, consumed: componentStored, rendered: /site-footer|brand-footer/i },
  ];

  const rows: AuditFieldRow[] = checks.map((check) => {
    const cap = Boolean(str(check.captured) || check.captured === true);
    const sto = Boolean(str(check.stored) || check.stored === true);
    const con = Boolean(str(check.consumed) || check.consumed === true);
    const ren = typeof check.rendered === "string"
      ? (check.rendered ? html.includes(check.rendered) : false)
      : check.rendered.test(html);

    let status: AuditFieldStatus = "Missing";
    if (cap && sto && con && ren) status = "Rendered";
    else if (cap && sto && con && !ren) status = "Replaced";
    else if (cap && sto && !con) status = "Stored";
    else if (cap && !sto) status = "Captured";
    else if (!cap && ren) status = "Fallback used";
    else if (!cap) status = "Missing";

    if (status === "Replaced" || status === "Fallback used") {
      if (/generic|platform-default|lockdown-v1|placeholder/i.test(html)) {
        status = "Fallback used";
      }
    }

    return { field: check.field, captured: cap, stored: sto, consumed: con, rendered: ren, status, notes: sources?.sourceUrl };
  });

  return { slug, completeness, rows };
}
