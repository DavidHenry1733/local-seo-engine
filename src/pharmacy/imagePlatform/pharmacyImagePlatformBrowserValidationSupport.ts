/**
 * Browser validation support — slot checklist for Playwright (no render changes).
 */
import fs from "node:fs";
import path from "node:path";
import { browserValidationPlanAbs } from "./pharmacyImagePlatformPaths.ts";
import { IMAGE_PLATFORM_ROLES } from "./pharmacyImagePlatformPaths.ts";
import { listPlatformServiceIds, buildServiceCatalog } from "./pharmacyImagePlatformRequirements.ts";
import { resolveDeterministicPlatformAssignment } from "./pharmacyImagePlatformAssignmentContract.ts";
import { loadPlatformRevision } from "./pharmacyImagePlatformManifestService.ts";

export interface BrowserValidationSlotPlan {
  serviceId: string;
  pageType: "homepage" | "service" | "guide" | "blog";
  pageSlug: string;
  slot: string;
  expectedAssignment: ReturnType<typeof resolveDeterministicPlatformAssignment>;
  catalogSubjectHint: string;
}

export interface BrowserValidationPlan {
  schemaVersion: "1.0";
  generatedAt: string;
  platformRevision: string;
  previewUrlTemplate: string;
  slots: BrowserValidationSlotPlan[];
  instructions: string[];
}

const PAGE_MATRIX: Array<{ pageType: BrowserValidationSlotPlan["pageType"]; pageSlug: string }> = [
  { pageType: "homepage", pageSlug: "index" },
  { pageType: "service", pageSlug: "{serviceId}" },
  { pageType: "guide", pageSlug: "{serviceId}-guide" },
  { pageType: "blog", pageSlug: "what-is-{serviceId}" },
];

export function buildBrowserValidationPlan(serviceId = "pharmacy-first"): BrowserValidationPlan {
  const catalog = buildServiceCatalog(serviceId);
  const slots: BrowserValidationSlotPlan[] = [];

  for (const page of PAGE_MATRIX) {
    const pageSlug = page.pageSlug.replace("{serviceId}", serviceId);
    for (const role of IMAGE_PLATFORM_ROLES) {
      slots.push({
        serviceId,
        pageType: page.pageType,
        pageSlug,
        slot: role,
        expectedAssignment: resolveDeterministicPlatformAssignment({
          serviceId,
          pageType: page.pageType,
          pageSlug,
          slot: role,
          seed: pageSlug,
        }),
        catalogSubjectHint: catalog.roles[role].subjectHint,
      });
    }
  }

  const plan: BrowserValidationPlan = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    platformRevision: loadPlatformRevision(),
    previewUrlTemplate:
      "https://app.pharmaconnect.uk/api/pharmacy-visual-experience/{pageSegment}/?slug={tenantSlug}",
    slots,
    instructions: [
      "Use authenticated canonical preview URLs (existing RC1-R2 route); do not change HTML renderers.",
      "For each slot: screenshot crop, record naturalWidth/Height, compare to expectedAssignment.assetRef when populated.",
      "Until library population completes, expectedAssignment may be null — report MISSING_PLATFORM_ASSET.",
    ],
  };

  fs.mkdirSync(path.dirname(browserValidationPlanAbs()), { recursive: true });
  fs.writeFileSync(browserValidationPlanAbs(), JSON.stringify(plan, null, 2));
  return plan;
}

export function buildAllServicesBrowserValidationSummary(): { serviceIds: string[]; plansWritten: string[] } {
  const plansWritten: string[] = [];
  for (const id of listPlatformServiceIds()) {
    buildBrowserValidationPlan(id);
    plansWritten.push(id);
  }
  return { serviceIds: listPlatformServiceIds(), plansWritten };
}
