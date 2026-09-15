/**
 * CPR-03 / CR03 — Commercial Gold Standard Service Page checklist (active generation validator).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readServicePageGenerationRecord } from "./masterAdminCoreProductRecoveryService.ts";
import { readServicePageSeoPlan } from "./masterAdminCoreProductRecoverySeoService.ts";
import { validateServicePageOutputScope } from "./masterAdminCoreProductRecoveryOutputScopeService.ts";
import { validateCommercialPageContractV1, assertCommercialPageContractV1ForGeneration } from "./masterAdminCommercialPageContractV1Service.ts";
import { validatePharmaconnectDesignSystemV1Page } from "./pharmacyDesignSystemV1.ts";
import { validateRenderedHtmlPresentation } from "./pharmacyBusinessFieldSanitizer.ts";

export interface CommercialChecklistItem {
  id: string;
  category: "BRANDING" | "CONTENT" | "SEO" | "IMAGES" | "LINKS" | "TECHNICAL" | "CONTRACT";
  label: string;
  passed: boolean;
  detail?: string;
  /** When false, failure is advisory only (not a generation error). */
  blocksGeneration?: boolean;
}

export interface CommercialServicePageChecklist {
  version: 1;
  slug: string;
  serviceId: string;
  items: CommercialChecklistItem[];
  passedCount: number;
  failedCount: number;
  allPassed: boolean;
  generationErrors: string[];
  contractPassed: boolean;
}

const LOCK_PATH = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-framework-lock.json");

/** Checklist rows that never block generation completion (manual / out-of-band). */
const NON_BLOCKING_CHECKLIST_IDS = new Set(["tech_console"]);

function item(
  id: string,
  category: CommercialChecklistItem["category"],
  label: string,
  passed: boolean,
  detail?: string,
  blocksGeneration = true,
): CommercialChecklistItem {
  return {
    id,
    category,
    label,
    passed,
    detail,
    blocksGeneration: blocksGeneration && !NON_BLOCKING_CHECKLIST_IDS.has(id),
  };
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) || []).length;
}

function loadVisualHtml(slug: string, serviceId: string): string {
  const visualPath = path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  return fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
}

export function evaluateCommercialServicePageChecklist(slug: string, serviceId: string): CommercialServicePageChecklist {
  const html = loadVisualHtml(slug, serviceId);
  const hasHtml = html.length > 0;
  const contract = validateCommercialPageContractV1(html);
  const seoPlan = readServicePageSeoPlan(slug, serviceId);
  const record = readServicePageGenerationRecord(slug, serviceId);
  const scope = validateServicePageOutputScope(slug, serviceId);
  const manifestPath = path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
  const registryPath = record
    ? path.join(
        WORKSPACE_ROOT,
        "data/pharmacy-master-admin/service-page-generation",
        slug,
        record.campaignId
          ? path.join("by-campaign", record.campaignId, "latest.json")
          : serviceId === "pharmacy-first"
            ? "latest.json"
            : path.join("by-service", serviceId, "latest.json"),
      )
    : path.join(
        WORKSPACE_ROOT,
        "data/pharmacy-master-admin/service-page-generation",
        slug,
        serviceId === "pharmacy-first" ? "latest.json" : path.join("by-service", serviceId, "latest.json"),
      );

  const items: CommercialChecklistItem[] = [];

  for (const check of contract.checks) {
    items.push(
      item(`contract_${check.id}`, "CONTRACT", check.label, check.passed, check.detail, true),
    );
  }

  items.push(
    item(
      "brand_header_v1",
      "BRANDING",
      "Platform header present",
      /platform-header-v1/.test(html),
      undefined,
      true,
    ),
    item(
      "brand_footer_v1",
      "BRANDING",
      "Platform footer present",
      /platform-footer-v1/.test(html),
      undefined,
      true,
    ),
    item(
      "brand_colours",
      "BRANDING",
      "Brand colours in page CSS",
      /--brand-primary|var\(--brand/i.test(html),
      undefined,
      true,
    ),
    item(
      "presentation_hours_clean",
      "CONTENT",
      "Opening hours free of CSS contamination",
      hasHtml && !/monospace,monospace;font-size:1em/.test(html),
      undefined,
      true,
    ),
    item(
      "presentation_no_stock_icon",
      "IMAGES",
      "No stock/icon URLs in photograph slots",
      hasHtml && !/<img[^>]+src="[^"]*\/isteam\/stock\//i.test(html),
      undefined,
      true,
    ),
    item(
      "presentation_layout_css",
      "TECHNICAL",
      "Commercial layout CSS bundled",
      hasHtml && /\.hero-image-wrap|\.pharmacy-local-grid|\.grid-3/.test(html),
      undefined,
      true,
    ),
    item(
      "presentation_ds_qa",
      "TECHNICAL",
      "Design System V1 presentation QA",
      hasHtml && validatePharmaconnectDesignSystemV1Page(html).passed,
      undefined,
      true,
    ),
    item(
      "presentation_contract",
      "TECHNICAL",
      "Rendered presentation contract",
      hasHtml && validateRenderedHtmlPresentation(html).passed,
      undefined,
      true,
    ),
  );

  items.push(
    item("seo_title", "SEO", "Unique title", Boolean(seoPlan?.title || record?.pageTitle)),
    item("seo_meta", "SEO", "Meta description", Boolean(seoPlan?.metaDescription)),
    item("seo_canonical", "SEO", "Canonical URL", Boolean(seoPlan?.canonicalUrl || record?.canonicalUrl)),
    item("seo_h1", "SEO", "Exactly one H1", hasHtml && countMatches(html, /<h1\b[^>]*>/gi) === 1),
    item("seo_hierarchy", "SEO", "H2 hierarchy", hasHtml && countMatches(html, /<h2\b[^>]*>/gi) >= 1),
    item("seo_service_schema", "SEO", "Service schema in HTML", /"@type"\s*:\s*"Service"/i.test(html) || contract.checks.find((c) => c.id === "schema_service")?.passed === true),
    item("seo_local_schema", "SEO", "LocalBusiness / Pharmacy schema", /LocalBusiness|Pharmacy|MedicalBusiness/i.test(html)),
    item("seo_breadcrumb_schema", "SEO", "Breadcrumb schema", /BreadcrumbList/i.test(html)),
  );

  const hasRenderedImages = hasHtml && countMatches(html, /<img\b/gi) >= 1;
  // Pharmacy First keeps the hard image contract. Other campaigns defer until Image Platform stocks them.
  const requireRenderedImages = serviceId === "pharmacy-first" || hasRenderedImages;
  items.push(
    item(
      "img_hero",
      "IMAGES",
      "Hero image slot",
      !requireRenderedImages || hasRenderedImages,
      requireRenderedImages ? undefined : "deferred — no production inventory for service",
      requireRenderedImages,
    ),
    item(
      "img_alt",
      "IMAGES",
      "Image alt text",
      !requireRenderedImages || (hasHtml && /<img\b[^>]+alt=["'][^"']+["']/i.test(html)),
      requireRenderedImages ? undefined : "deferred — no production inventory for service",
      requireRenderedImages,
    ),
  );

  items.push(
    item("links_internal", "LINKS", "Internal links", contract.checks.find((c) => c.id === "internal_links")?.passed === true),
    item("links_contact", "LINKS", "Contact links", contract.checks.find((c) => c.id === "contact_links")?.passed === true),
    item("links_booking", "LINKS", "Booking links", contract.checks.find((c) => c.id === "booking_links")?.passed === true),
  );

  items.push(
    item("tech_manifest", "TECHNICAL", "Content manifest", fs.existsSync(manifestPath)),
    item("tech_registry", "TECHNICAL", "Generation registry", fs.existsSync(registryPath)),
    item("tech_scope", "TECHNICAL", "Service-page scope", scope.ok, scope.status),
    item("tech_console", "TECHNICAL", "Zero console errors (manual PO check)", false, "Browser verification required", false),
  );

  const blockingItems = items.filter((i) => i.blocksGeneration !== false);
  const passedCount = blockingItems.filter((i) => i.passed).length;
  const generationErrors = blockingItems.filter((i) => !i.passed).map((i) => `${i.id}: ${i.label}${i.detail ? ` (${i.detail})` : ""}`);

  return {
    version: 1,
    slug,
    serviceId,
    items,
    passedCount,
    failedCount: blockingItems.length - passedCount,
    allPassed: generationErrors.length === 0,
    generationErrors,
    contractPassed: contract.passed,
  };
}

export function assertCommercialChecklistForGeneration(slug: string, serviceId: string, html?: string): void {
  if (html) {
    assertCommercialPageContractV1ForGeneration(html);
  }
  const checklist = evaluateCommercialServicePageChecklist(slug, serviceId);
  if (!checklist.allPassed) {
    throw new Error(`Generation blocked — Commercial Checklist: ${checklist.generationErrors.join("; ")}`);
  }
}

export function readServicePageFrameworkLock(): {
  locked: boolean;
  version: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  slug: string | null;
} {
  if (!fs.existsSync(LOCK_PATH)) {
    return { locked: false, version: null, lockedAt: null, lockedBy: null, slug: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as {
      locked?: boolean;
      version?: string;
      lockedAt?: string;
      lockedBy?: string;
      slug?: string;
    };
    return {
      locked: raw.locked === true,
      version: raw.version || null,
      lockedAt: raw.lockedAt || null,
      lockedBy: raw.lockedBy || null,
      slug: raw.slug || null,
    };
  } catch {
    return { locked: false, version: null, lockedAt: null, lockedBy: null, slug: null };
  }
}

export function lockServicePageFrameworkV1(slug: string, operator: string, checklist: CommercialServicePageChecklist): boolean {
  if (!checklist.allPassed) return false;
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  const tmp = `${LOCK_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        locked: true,
        version: "SERVICE PAGE FRAMEWORK V1",
        lockedAt: new Date().toISOString(),
        lockedBy: operator,
        slug,
        checklistPassed: checklist.passedCount,
        checklistTotal: checklist.items.filter((i) => i.blocksGeneration !== false).length,
      },
      null,
      2,
    ),
  );
  fs.renameSync(tmp, LOCK_PATH);
  return true;
}
