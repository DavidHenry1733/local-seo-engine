#!/usr/bin/env npx tsx
/**
 * CPR-CR01-V1 — Regenerate commercial demo tenants with Design System V1 (orchestration only).
 */
import fs from "node:fs";
import path from "node:path";
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { validatePharmaconnectDesignSystemV1Page } from "../src/pharmacy/pharmacyDesignSystemV1.ts";
import { buildCanonicalFinalRender } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { preparePharmacyPublishOutput } from "../src/pharmacy/pharmacyLivePublishService.ts";
import { evaluateCommercialServicePageChecklist } from "../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { validateServicePageSeoContract } from "../src/pharmacy/masterAdminCoreProductRecoverySeoService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const DEMO_ORDER: Array<{ label: string; inputSlug: string }> = [
  { label: "Welfare Pharmacy", inputSlug: "welfare-pharmacy" },
  { label: "Banner Cross Pharmacy", inputSlug: "banner-cross-pharmacy" },
  { label: "Reliable Direct Pharmacy", inputSlug: "reliable-direct-pharmacy" },
  { label: "Brook Pharmacy", inputSlug: "brook-pharmacy" },
];

function stripLocalClusterAssetsFromEcosystemIndex(slug: string): void {
  const indexPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    SERVICE,
    "_ecosystem-index.json",
  );
  if (!fs.existsSync(indexPath)) return;
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
    assets?: Array<{ urlPath?: string; type?: string }>;
    localClusterPagesGenerated?: number;
  };
  const before = index.assets?.length ?? 0;
  index.assets = (index.assets || []).filter((a) => {
    const url = String(a.urlPath || "");
    const type = String(a.type || "").toLowerCase();
    return !url.startsWith("/local/") && !type.includes("location");
  });
  if ((index.assets?.length ?? 0) < before) {
    index.localClusterPagesGenerated = 0;
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }
}

function ensureMinimalEcosystemIndex(slug: string): void {
  const ecoDir = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, SERVICE);
  const indexPath = path.join(ecoDir, "_ecosystem-index.json");
  if (fs.existsSync(indexPath)) return;
  fs.mkdirSync(ecoDir, { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        version: 1,
        serviceId: SERVICE,
        slug,
        localArea: "",
        selectedAreas: [],
        localClusterPagesGenerated: 0,
        generatedAt: new Date().toISOString(),
        assets: [],
      },
      null,
      2,
    ),
  );
}

function clearLegacyRenderedOutput(slug: string): void {
  const targets = [
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-canonical-final-render", slug),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug),
  ];
  for (const t of targets) {
    if (fs.existsSync(t)) fs.rmSync(t, { recursive: true, force: true });
  }
}

function legacyChromeDetected(html: string): boolean {
  if (/data-pharmaconnect-component="platform-header-v1"/.test(html)) return false;
  return /<header[^>]*class="[^"]*site-header|legacy-header|tenant-header-clone/i.test(html) || /<footer[^>]*class="[^"]*site-footer/i.test(html);
}

function contentQaFromChecklist(items: ReturnType<typeof evaluateCommercialServicePageChecklist>): boolean {
  const contentItems = items.items.filter((i) => i.category === "CONTENT");
  return contentItems.length > 0 && contentItems.every((i) => i.passed);
}

function ensureBrookPharmacyTenant(): string {
  const srcProfile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles/broom-lane-pharmacy.json");
  const destProfile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles/brook-pharmacy.json");
  if (!fs.existsSync(destProfile)) {
    if (!fs.existsSync(srcProfile)) throw new Error("broom-lane-pharmacy profile missing — cannot create brook-pharmacy");
    const doc = JSON.parse(fs.readFileSync(srcProfile, "utf8")) as Record<string, unknown>;
    doc.slug = "brook-pharmacy";
    const data = doc.data as Record<string, unknown>;
    data.pharmacyName = "Brook Pharmacy";
    data.tradingName = "Brook Pharmacy";
    fs.writeFileSync(destProfile, JSON.stringify(doc, null, 2));
  }
  const copyDirs = [
    ["output/pharmacy-content-ecosystem/broom-lane-pharmacy", "output/pharmacy-content-ecosystem/brook-pharmacy"],
    ["data/pharmacy-content-packages/broom-lane-pharmacy", "data/pharmacy-content-packages/brook-pharmacy"],
    ["data/pharmacy-master-admin/service-page-generation/broom-lane-pharmacy", "data/pharmacy-master-admin/service-page-generation/brook-pharmacy"],
    ["data/pharmacy-master-admin/service-page-seo/broom-lane-pharmacy", "data/pharmacy-master-admin/service-page-seo/brook-pharmacy"],
    ["output/pharmacy-master-publish/broom-lane-pharmacy", "output/pharmacy-master-publish/brook-pharmacy"],
    ["data/website-design-evidence/broom-lane-pharmacy", "data/website-design-evidence/brook-pharmacy"],
  ] as const;
  for (const [from, to] of copyDirs) {
    const src = path.join(PHARMACY_WORKSPACE_ROOT, from);
    const dest = path.join(PHARMACY_WORKSPACE_ROOT, to);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.cpSync(src, dest, { recursive: true });
    }
  }
  const rewriteSlugInJson = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.includes("broom-lane-pharmacy")) return;
    fs.writeFileSync(filePath, raw.replace(/broom-lane-pharmacy/g, "brook-pharmacy"));
  };
  rewriteSlugInJson(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages/brook-pharmacy/pharmacy-first.json"));
  rewriteSlugInJson(
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem/brook-pharmacy/pharmacy-first/_ecosystem-index.json"),
  );
  rewriteSlugInJson(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation/brook-pharmacy/latest.json"));
  const brookMaster = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-master-publish/brook-pharmacy/pharmacy-first/index.html");
  const broomMaster = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-master-publish/broom-lane-pharmacy/pharmacy-first/index.html");
  if (!fs.existsSync(brookMaster) && fs.existsSync(broomMaster)) {
    fs.cpSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-master-publish/broom-lane-pharmacy"),
      path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-master-publish/brook-pharmacy"),
      { recursive: true },
    );
  }
  return "brook-pharmacy";
}

async function processTenant(label: string, inputSlug: string) {
  const slug =
    inputSlug === "brook-pharmacy" ? ensureBrookPharmacyTenant() : resolveTenantProfileSlug(inputSlug) || inputSlug;
  const issues: string[] = [];
  let publishPass = false;
  let designPass = false;
  let commercialPass = false;
  let contentPass = false;
  let seoPass = false;

  try {
    clearLegacyRenderedOutput(slug);
    ensureMinimalEcosystemIndex(slug);
    stripLocalClusterAssetsFromEcosystemIndex(slug);
    buildVisualExperiencePage(slug, SERVICE);
    const visualPath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html");
    const visualHtml = fs.readFileSync(visualPath, "utf8");
    const designVisual = validatePharmaconnectDesignSystemV1Page(visualHtml);
    await buildCanonicalFinalRender(slug, SERVICE);
    await preparePharmacyPublishOutput(slug, SERVICE);
    const publishPath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, SERVICE, "index.html");
    const publishHtml = fs.existsSync(publishPath) ? fs.readFileSync(publishPath, "utf8") : "";
    const designPublish = validatePharmaconnectDesignSystemV1Page(publishHtml);
    designPass = designVisual.passed && designPublish.passed && !legacyChromeDetected(publishHtml);
    if (!designVisual.passed) issues.push(`Preview DS: ${designVisual.checks.filter((c) => !c.passed).map((c) => c.id).join(", ")}`);
    if (!designPublish.passed) issues.push(`Publish DS: ${designPublish.checks.filter((c) => !c.passed).map((c) => c.id).join(", ")}`);
    if (legacyChromeDetected(publishHtml)) issues.push("Legacy chrome detected on published page");

    const commercial = evaluateCommercialServicePageChecklist(slug, SERVICE);
    commercialPass = commercial.allPassed;
    contentPass = contentQaFromChecklist(commercial);
    if (!commercialPass) {
      issues.push(
        `Commercial checklist ${commercial.failedCount} fail: ${commercial.items
          .filter((i) => !i.passed)
          .slice(0, 8)
          .map((i) => i.id)
          .join(", ")}`,
      );
    }

    const seo = validateServicePageSeoContract(slug, SERVICE, publishHtml || visualHtml);
    seoPass = seo.passed;
    if (!seoPass) issues.push(`SEO: ${seo.errors.slice(0, 6).join("; ")}`);

    const v1Chrome =
      /data-pharmaconnect-component="platform-header-v1"/.test(publishHtml) &&
      /data-pharmaconnect-component="platform-footer-v1"/.test(publishHtml);
    publishPass = fs.existsSync(publishPath) && v1Chrome && !legacyChromeDetected(publishHtml);
    if (!publishPass) issues.push("Publish output missing or not V1");
  } catch (e) {
    issues.push(e instanceof Error ? e.message : String(e));
  }

  return {
    label,
    slug,
    designPass,
    commercialPass,
    contentPass,
    seoPass,
    publishPass,
    issues,
  };
}

async function main() {
  const results = [];
  for (const t of DEMO_ORDER) {
    results.push(await processTenant(t.label, t.inputSlug));
  }
  console.log(JSON.stringify({ sprint: "CPR-CR01-V1", results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
