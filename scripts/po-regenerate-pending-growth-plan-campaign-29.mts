#!/usr/bin/env npx tsx
/**
 * APPROVED-CORE-PAGE-SHARED-RENDERER-QUALITY-29 — regenerate pending Flu campaign after shared renderer correction.
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
import { resolvePharmacyImageForSlot } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUT = "/tmp/flu29-po-regen-result.json";

const PRODUCT_OWNER_INPUT = {
  tenantSlug: "yorkshire-pharmacy-and-health-clinic",
  intent: "regenerate the current pending Growth Plan campaign after shared renderer correction",
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
            workflowAction: "regenerate-pending-campaign-after-shared-renderer-correction",
            packageStatus: "pending-po-review",
            priorityRationale:
              "Current pending Growth Plan campaign resolved from campaign builder session and frozen generation context",
          }
        : null,
  };
}

function extractVisibleCopy(html: string) {
  const strip = (s: string) =>
    s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const faqs = [...html.matchAll(/<h3 class="faq-q">([^<]+)<\/h3><p class="faq-a">([^<]+)<\/p>/g)].map((m) => ({
    question: strip(m[1]!),
    answer: strip(m[2]!),
  }));
  const processSteps = [
    ...html.matchAll(
      /data-step="(\d+)"[\s\S]*?<h3 class="card-title-line-1">([^<]+)<\/h3>[\s\S]*?<p class="card-body">([^<]+)<\/p>/g,
    ),
  ].map((m) => ({ step: m[1], title: strip(m[2]!), body: strip(m[3]!) }));
  const heroImg = html.match(/data-platform-asset-id="([^"]+)"|data-library-ref="image-platform\/([^"]+)"/);
  return { faqs, processSteps, heroAssetId: heroImg?.[1] || heroImg?.[2] || null };
}

async function main() {
  const slug = PRODUCT_OWNER_INPUT.tenantSlug;
  const expectedFluBank = fs
    .readFileSync(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations/APPROVED_HASH"),
      "utf8",
    )
    .trim();

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
  const serviceVisual = `${ROOT}/output/pharmacy-visual-experience/${slug}/${serviceId}/index.html`;
  const darfieldHtml = fs.readFileSync(
    `${ROOT}/output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/darfield/index.html`,
    "utf8",
  );
  const cudworthHtml = fs.readFileSync(
    `${ROOT}/output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/cudworth/index.html`,
    "utf8",
  );
  const visualHtml = fs.readFileSync(serviceVisual, "utf8");

  const rendererDefects: string[] = [];
  const checkHtml = (label: string, html: string) => {
    const body = html.match(/<main[\s\S]*<\/main>/i)?.[0] || html.match(/<body[\s\S]*<\/body>/i)?.[0] || html;
    if (/id="pharmacy-trust-cards"/.test(body)) rendererDefects.push(`${label}: generic trust cards section present`);
    if (/id="pharmacy-trust-cards"[\s\S]*?(Private Consultation Room|trained pharmacists|GPhC Registered Pharmacy|Pharmacist-led assessment)/i.test(body)) {
      rendererDefects.push(`${label}: injected generic trust/profile claim in trust cards`);
    }
    if (/Local guidance for |For [A-Za-z]+ residents:|pharmacy access —|Darfield patients —/i.test(body)) {
      rendererDefects.push(`${label}: locality-prefixed FAQ question`);
    }
    if (/data-template-block="process"[\s\S]*?<h3 class="card-title-line-1">Step \d+<\/h3>[\s\S]*?<p class="card-body">How The Service Works/i.test(body)) {
      rendererDefects.push(`${label}: process title/body run-on`);
    }
    if (/pf-hero-consultation-room|consultation-room\.webp/i.test(body) && label.includes("service")) {
      rendererDefects.push(`${label}: cross-service Pharmacy First consultation-room hero`);
    }
  };
  checkHtml("service", visualHtml);
  checkHtml("darfield", darfieldHtml);
  checkHtml("cudworth", cudworthHtml);

  const heroResolved = resolvePharmacyImageForSlot(slug, serviceId, "hero", { campaignId: serviceId });
  const imageProvenance = {
    assetPath: heroResolved.assetPath,
    imageKey: heroResolved.imageKey,
    source: heroResolved.source,
    schemaUsage: heroResolved.schemaUsage,
    libraryRef: heroResolved.libraryRef,
  };

  const result = {
    ok: rendererDefects.length === 0,
    task: "APPROVED-CORE-PAGE-SHARED-RENDERER-QUALITY-29",
    productOwnerInput: PRODUCT_OWNER_INPUT,
    independentlySelected: {
      service: selection.selected,
      areas: areasSelected,
      contentBank: { hash: bank.hash, path: bank.absolutePath },
      servicePageContract: {
        contractId: servicePageContract.contractId,
        sectionCount: servicePageContract.sections.length,
        processStepCount: servicePageContract.processSteps.length,
        faqCount: servicePageContract.faqs.length,
      },
    },
    mvpScope: "mvp-core-pages",
    imageProvenance,
    rendererDefects,
    visibleCopy: {
      service: extractVisibleCopy(visualHtml),
      darfield: extractVisibleCopy(darfieldHtml),
      cudworth: extractVisibleCopy(cudworthHtml),
    },
    bpProtectedUnchanged: Object.fromEntries(
      Object.keys(bpProtectPaths).map((k) => [k, bpBefore[k] === bpAfter[k]]),
    ),
    localPagesGenerated: locals.localClusterEntries.length,
  };

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  fs.writeFileSync("/tmp/flu29-copy.json", JSON.stringify(result.visibleCopy, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
