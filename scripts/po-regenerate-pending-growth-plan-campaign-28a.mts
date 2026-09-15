#!/usr/bin/env npx tsx
/**
 * FLU-APPROVED-BANK-COPY-QUALITY-28A — regenerate current pending Flu campaign after bank correction.
 * ONLY operator inputs: tenant slug + intent phrase.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { selectCampaignBuilderService } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
} from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import {
  loadServiceVariantPack,
  resolveApprovedServiceBank,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { withApprovedBankServicePageContract } from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUT = "/tmp/flu28a-po-regen-result.json";

const PRODUCT_OWNER_INPUT = {
  tenantSlug: "yorkshire-pharmacy-and-health-clinic",
  intent: "regenerate the current pending Growth Plan campaign after its approved bank correction",
} as const;

function sha(p: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function loadRawProfile(slug: string) {
  const doc = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`), "utf8"),
  ) as { data?: Record<string, unknown> };
  return normalizeProfileData(doc.data || {});
}

function resolvePendingGrowthPlanCampaign(slug: string) {
  const builder = loadCampaignBuilderSession(slug);
  const serviceId = builder.selectedServiceId;
  const contextPath = path.join(
    ROOT,
    "data/growth-engine",
    `${slug}-campaign-generation-context-${serviceId || "missing"}.json`,
  );
  const hasFrozenContext = Boolean(serviceId && fs.existsSync(contextPath));
  const frozen = hasFrozenContext
    ? (JSON.parse(fs.readFileSync(contextPath, "utf8")) as {
        serviceId: string;
        campaignName: string;
        targetAreas: string[];
        frozenAt: string;
      })
    : null;
  return {
    selectionRule:
      "campaign-builder selectedServiceId + frozen campaign-generation-context for current pending Growth Plan campaign",
    builder: {
      selectedServiceId: builder.selectedServiceId,
      step: builder.step,
      contextFrozenAt: builder.contextFrozenAt,
    },
    frozenContext: frozen
      ? {
          serviceId: frozen.serviceId,
          campaignName: frozen.campaignName,
          targetAreas: frozen.targetAreas,
          frozenAt: frozen.frozenAt,
          contextPath,
        }
      : null,
    selected:
      serviceId && frozen
        ? {
            serviceId,
            serviceName: frozen.campaignName,
            workflowAction: "regenerate-pending-campaign-after-bank-correction",
            packageStatus: "pending-po-review",
            priorityRationale:
              "Current pending Growth Plan campaign resolved from campaign builder session and frozen generation context",
          }
        : null,
  };
}

function inventoryOptionalAssets(slug: string, serviceId: string) {
  const packsDir = path.join(ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "packs");
  const pagesDir = path.join(ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "pages");
  const packNames = fs.existsSync(packsDir) ? fs.readdirSync(packsDir) : [];
  const pageNames = fs.existsSync(pagesDir)
    ? fs.readdirSync(pagesDir).filter((d) => fs.statSync(path.join(pagesDir, d)).isDirectory())
    : [];
  return { packNames, pageNames };
}

async function main() {
  const slug = PRODUCT_OWNER_INPUT.tenantSlug;
  const expectedFluBank = fs
    .readFileSync(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations/APPROVED_HASH"),
      "utf8",
    )
    .trim();

  const sourceWatch = [
    path.join(ROOT, "docs/pharmacy-master-library/flu-vaccinations-master-v1.md"),
  ];
  const sourceBefore = Object.fromEntries(sourceWatch.map((p) => [p, sha(p)]));

  const bpProtectPaths = {
    visual: `${ROOT}/output/pharmacy-visual-experience/${slug}/blood-pressure-checks/index.html`,
    faq: `${ROOT}/output/pharmacy-content-ecosystem/${slug}/blood-pressure-checks/pages/blood-pressure-checks-faqs/index.html`,
    pkg: `${ROOT}/data/pharmacy-content-packages/${slug}/blood-pressure-checks.json`,
  };
  const bpBefore = Object.fromEntries(Object.entries(bpProtectPaths).map(([k, p]) => [k, sha(p)]));

  const selection = resolvePendingGrowthPlanCampaign(slug);
  if (!selection.selected?.serviceId) {
    const fail = {
      ok: false,
      failReason: "Growth Plan did not independently resolve a current pending campaign",
      productOwnerInput: PRODUCT_OWNER_INPUT,
      selection,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const serviceId = selection.selected.serviceId;
  if (serviceId !== "flu-vaccinations") {
    const fail = {
      ok: false,
      failReason: `FAIL: independently selected service "${serviceId}" !== expected pending Flu campaign`,
      productOwnerInput: PRODUCT_OWNER_INPUT,
      selection,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const raw = loadRawProfile(slug);
  const hierarchyBefore = resolveLocalLocationHierarchy(slug, serviceId, raw);
  const areasSelected = hierarchyBefore.ok
    ? hierarchyBefore.clusters.map((c) => ({ slug: c.slug, name: c.name }))
    : [];
  const expectedAreas = [
    "darfield",
    "wombwell",
    "thurnscoe",
    "grimethorpe",
    "goldthorpe",
    "worsbrough",
    "hoyland",
    "cudworth",
  ];
  const areaSlugs = areasSelected.map((a) => a.slug);
  const areasOk =
    expectedAreas.every((a) => areaSlugs.includes(a)) && areaSlugs.length === expectedAreas.length;
  if (!areasOk) {
    const fail = {
      ok: false,
      failReason: "FAIL: independently selected localities do not match stored Yorkshire Flu campaign localities",
      productOwnerInput: PRODUCT_OWNER_INPUT,
      selection,
      areasSelected,
      expectedAreas,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const bank = resolveApprovedServiceBank(serviceId);
  if (!bank || bank.hash !== expectedFluBank) {
    const fail = {
      ok: false,
      failReason: `FAIL: Flu bank hash ${bank?.hash || "missing"} !== corrected approved bank ${expectedFluBank}`,
      productOwnerInput: PRODUCT_OWNER_INPUT,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }
  const pack = loadServiceVariantPack(serviceId)!;
  const servicePageContract = withApprovedBankServicePageContract(pack).servicePage;

  selectCampaignBuilderService(slug, serviceId);
  const customerContext = buildCustomerCampaignGenerationContext(slug, serviceId);
  freezeCustomerCampaignGenerationContext(customerContext);

  const pkg = await generateContentPackage(slug, serviceId, {
    customerContext,
    scope: "mvp-core-pages",
  });
  if (!pkg.ok) {
    const fail = { ok: false, step: "generateContentPackage", error: pkg.error, selection };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const ctx = buildContentGenerationContext(slug, serviceId);
  const locals = generateLocalLocationHierarchyPages(ctx);
  if (!locals.ok) {
    const fail = {
      ok: false,
      step: "generateLocalLocationHierarchyPages",
      blockedReason: locals.blockedReason,
      selection,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }
  mergeLocalAssetsIntoEcosystemIndex(slug, serviceId, locals);

  const bpAfter = Object.fromEntries(Object.entries(bpProtectPaths).map(([k, p]) => [k, sha(p)]));
  const sourceAfter = Object.fromEntries(sourceWatch.map((p) => [p, sha(p)]));
  const optional = inventoryOptionalAssets(slug, serviceId);

  const serviceVisual = `${ROOT}/output/pharmacy-visual-experience/${slug}/${serviceId}/index.html`;
  const visualHtml = fs.readFileSync(serviceVisual, "utf8");
  const darfieldHtml = fs.readFileSync(
    `${ROOT}/output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/darfield/index.html`,
    "utf8",
  );
  const cudworthHtml = fs.readFileSync(
    `${ROOT}/output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/cudworth/index.html`,
    "utf8",
  );
  const forbidden =
    /\b(appointment|walk-?in|commission(?:ing|ed)?|free\b|nhs-funded|nhs\s+flu|book\s+online)\b/i;
  const allowedNhs111 = /\bNHS\s*111\b/i;
  function claimHits(html: string) {
    const stripped = html
      .replace(/--nhs\b[^;{]*/gi, "")
      .replace(/var\(--nhs\)/gi, "")
      .replace(/\.tag\.nhs\b/gi, "")
      .replace(allowedNhs111, "URGENT_CARE_REF");
    const matches = stripped.match(new RegExp(forbidden, "gi")) || [];
    return [...new Set(matches.map((m) => m.toLowerCase()))];
  }

  const bpLeak = /blood\s*pressure/i;
  const result = {
    ok: true,
    task: "FLU-APPROVED-BANK-COPY-QUALITY-28A",
    productOwnerInput: PRODUCT_OWNER_INPUT,
    independentlySelected: {
      service: selection.selected,
      areas: areasSelected,
      contentBank: { hash: bank.hash, path: bank.absolutePath },
      servicePageContract: {
        contractId: servicePageContract.contractId,
        sectionCount: servicePageContract.sections.length,
        faqCount: servicePageContract.faqs.length,
      },
    },
    mvpScope: "mvp-core-pages",
    optionalAssetsDisconnected: ["gbp", "social", "email", "blogs", "guides", "faq-page", "video"],
    optionalAssetInventoryAfter: optional,
    forbiddenClaimHits: {
      service: claimHits(visualHtml),
      darfield: claimHits(darfieldHtml),
      cudworth: claimHits(cudworthHtml),
    },
    bpLeakage: {
      service: bpLeak.test(visualHtml),
      darfield: bpLeak.test(darfieldHtml),
      cudworth: bpLeak.test(cudworthHtml),
    },
    bpProtectedUnchanged: Object.fromEntries(
      Object.keys(bpProtectPaths).map((k) => [k, bpBefore[k] === bpAfter[k]]),
    ),
    sourceUnchanged: Object.fromEntries(
      sourceWatch.map((p) => [p, sourceBefore[p] === sourceAfter[p]]),
    ),
    packageDiagnostics: pkg.manifest?.adminDiagnostics || [],
    localPagesGenerated: locals.localClusterEntries.length,
  };

  const claimFail = Object.values(result.forbiddenClaimHits).some((h) => h.length > 0);
  const leakFail = Object.values(result.bpLeakage).some(Boolean);
  const protectFail = Object.values(result.bpProtectedUnchanged).some((v) => !v);
  const sourceFail = Object.values(result.sourceUnchanged).some((v) => !v);
  const optionalFail =
    optional.packNames.some((n) => /social-posts|gbp-posts|email-sequence|video-script/i.test(n)) ||
    optional.pageNames.some((n) => /guide|blog|faqs|content-ecosystem/i.test(n) && n !== serviceId);

  if (claimFail || leakFail || protectFail || sourceFail || optionalFail) {
    result.ok = false;
    (result as { failReasons?: string[] }).failReasons = [
      claimFail ? "forbidden claims present" : "",
      leakFail ? "BP leakage" : "",
      protectFail ? "BP protected artifact changed" : "",
      sourceFail ? "source changed during generation" : "",
      optionalFail ? "optional assets present after MVP generation" : "",
    ].filter(Boolean);
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
